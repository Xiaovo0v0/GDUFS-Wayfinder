// 极简 PNG 编解码 —— 只为截图管线服务，不追求通用性。
//   decodePng(buf)  -> { width, height, data }   data 是 RGBA8（无 alpha 的 PNG 补 255）
//   encodePng(img)  -> Buffer                    filter 0，slightly 大但够用
//   countTransparent(img, thr) / samplePixel(img, x, y) / composeOver(front, back)
//
// 只支持 8 bit、非隔行、colorType 2(RGB) / 6(RGBA)。Chromium 的
// Page.captureScreenshot 输出的就是这两种，遇到别的直接抛错而不是猜。
//
// 为什么需要它：这台机器没有 GPU（Edge 和 headless shell 都走软件光栅），
// fixed 不透明浮层下方会丢块，截出来是透明像素。tools/shot.mjs --compose
// 用本模块在 Node 里把「纯场景」补进透明处，不再依赖浏览器里的 canvas。

import zlib from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function unfilter(filter, line, prev, bpp) {
  if (filter === 0) return;
  for (let i = 0; i < line.length; i++) {
    const a = i >= bpp ? line[i - bpp] : 0;
    const b = prev[i];
    if (filter === 1) line[i] = (line[i] + a) & 0xff;
    else if (filter === 2) line[i] = (line[i] + b) & 0xff;
    else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 0xff;
    else if (filter === 4) line[i] = (line[i] + paeth(a, b, i >= bpp ? prev[i - bpp] : 0)) & 0xff;
    else throw new Error('未知 PNG 行过滤器 ' + filter);
  }
}

export function decodePng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error('不是 PNG 文件');
  let off = 8, w = 0, h = 0, depth = 0, color = 0, interlace = 0, seenIhdr = false;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; color = data[9]; interlace = data[12];
      seenIhdr = true;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (!seenIhdr) throw new Error('PNG 缺 IHDR');
  if (depth !== 8) throw new Error('本模块只支持 8 bit PNG，实际 ' + depth);
  if (color !== 2 && color !== 6) throw new Error('本模块只支持 RGB/RGBA PNG，实际 colorType ' + color);
  if (interlace) throw new Error('本模块不支持隔行 PNG');

  const ch = color === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  if (raw.length < (stride + 1) * h) throw new Error('PNG 像素数据不足');

  const data = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    unfilter(f, line, prev, ch);
    for (let x = 0; x < w; x++) {
      const i = x * ch, o = (y * w + x) * 4;
      data[o] = line[i];
      data[o + 1] = line[i + 1];
      data[o + 2] = line[i + 2];
      data[o + 3] = ch === 4 ? line[i + 3] : 255;
    }
    prev = line;
  }
  return { width: w, height: h, data };
}

export function encodePng(img) {
  const { width: w, height: h, data } = img;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filter
  ihdr[12] = 0;  // 非隔行
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 统计「透明洞」像素数：软件光栅丢失的块在 PNG 里是 alpha=0。
export function countTransparent(img, thr = 8) {
  let n = 0;
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < thr) n++;
  return n;
}

export function samplePixel(img, x, y) {
  const o = (Math.round(y) * img.width + Math.round(x)) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]];
}

// 把 front 盖到 back 上（同 tools/shot.mjs --compose 的语义）：
// front 不透明处保留 front，透明处露出 back。
export function composeOver(front, back) {
  if (front.width !== back.width || front.height !== back.height) {
    throw new Error(`尺寸不一致：${front.width}x${front.height} vs ${back.width}x${back.height}`);
  }
  const out = Buffer.alloc(front.width * front.height * 4);
  const f = front.data, b = back.data;
  for (let i = 0; i < out.length; i += 4) {
    const a = f[i + 3];
    if (a === 255) {
      out[i] = f[i]; out[i + 1] = f[i + 1]; out[i + 2] = f[i + 2];
    } else if (a === 0) {
      out[i] = b[i]; out[i + 1] = b[i + 1]; out[i + 2] = b[i + 2];
    } else {
      const k = a / 255, j = 1 - k;
      out[i] = Math.round(f[i] * k + b[i] * j);
      out[i + 1] = Math.round(f[i + 1] * k + b[i + 1] * j);
      out[i + 2] = Math.round(f[i + 2] * k + b[i + 2] * j);
    }
    out[i + 3] = 255;
  }
  return { width: front.width, height: front.height, data: out };
}
