// 把片头卡 + 两段录屏 + 片尾卡拼成 MP4。
//   node tools/encode_video.mjs
// 依赖：tools/bin/ffmpeg.exe（或 PATH 里的 ffmpeg）
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO = 'C:/Users/86134/Desktop/gdufs';
const VID = path.join(REPO, 'artifacts/video');
const FF = fs.existsSync(path.join(REPO, 'tools/bin/ffmpeg.exe'))
  ? path.join(REPO, 'tools/bin/ffmpeg.exe')
  : fs.existsSync(path.join(REPO, 'tools/bin/ffmpeg/bin/ffmpeg.exe'))
    ? path.join(REPO, 'tools/bin/ffmpeg/bin/ffmpeg.exe')
    : 'ffmpeg';
const OUT = path.join(REPO, 'deliverables/演示视频.mp4');

const items = [];
const pushCard = (file, dur) => items.push({ file, dur });
const pushSeg = (dir) => {
  const timing = JSON.parse(fs.readFileSync(path.join(VID, dir, 'timing.json'), 'utf8'));
  for (const f of timing) items.push({ file: path.join(VID, dir, 'frames', f.file).replace(/\\/g, '/'), dur: f.dur });
};

pushCard(path.join(VID, 'cards/title.png').replace(/\\/g, '/'), 5.0);
pushSeg('seg_main');
pushSeg('seg_en');
pushCard(path.join(VID, 'cards/end.png').replace(/\\/g, '/'), 4.5);

const listFile = path.join(VID, 'concat.txt');
const lines = [];
for (const it of items) {
  lines.push(`file '${it.file}'`);
  lines.push(`duration ${it.dur.toFixed(3)}`);
}
// concat 解复用器要求最后一张重复一次
lines.push(`file '${items[items.length - 1].file}'`);
fs.writeFileSync(listFile, lines.join('\n') + '\n', 'utf8');

const total = items.reduce((s, i) => s + i.dur, 0);
console.log('片段数', items.length, '总时长', total.toFixed(1) + 's');

const args = [
  '-y',
  '-f', 'concat', '-safe', '0', '-i', listFile,
  '-vf', 'scale=1440:810:force_original_aspect_ratio=decrease,pad=1440:810:(ow-iw)/2:(oh-ih)/2:color=white,fps=30',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '21',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  OUT,
];
console.log('ffmpeg', FF);
const r = spawnSync(FF, args, { stdio: 'inherit' });
if (r.status !== 0) {
  console.error('编码失败', r.status);
  process.exit(1);
}
const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
console.log('输出', OUT, mb + ' MB');
