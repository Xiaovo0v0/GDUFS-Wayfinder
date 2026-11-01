# -*- coding: utf-8 -*-
"""Three-panel comparison: plan crop | before | after (ASCII only)."""
from PIL import Image, ImageDraw, ImageFont

BASE = r'C:\Users\86134\Desktop\gdufs\artifacts\lock'
PLAN = (r'C:\Users\86134\.dsh\attachments\v1\objects\2f'
        r'\2f251823301bb8fb30665c8ac3c12d1f979e92482e093e652540a8ca259e41f8')
H = 1000
PAD = 24


def load(p):
    im = Image.open(p).convert('RGB')
    w = int(im.width * H / im.height)
    return im.resize((w, H), Image.LANCZOS)


plan = load(PLAN).crop((0, 0, 0, 0)) if False else Image.open(PLAN).convert('RGB')
# plan crop: living area, keep aspect
pc_ = plan.crop((150, 1150, 780, 1800))
scale = H / pc_.height
pc_ = pc_.resize((int(pc_.width * scale), H), Image.LANCZOS)

before = load(BASE + r'\south_living_before.png')
after = load(BASE + r'\south_living_after.png')

panels = [(pc_, 'plan (authoritative)', 'living area, labels'),
          (before, 'model BEFORE', 'canteen 150 m too far south'),
          (after, 'model AFTER', 'canteen next to Shiyuan row')]

W = sum(p.width for p, _, _ in panels) + PAD * (len(panels) + 1)
TITLE = 76
CAP = 56
out = Image.new('RGB', (W, TITLE + H + CAP + 40), (16, 18, 24))
d = ImageDraw.Draw(out)
try:
    f1 = ImageFont.truetype('msyh.ttc', 30)
    f2 = ImageFont.truetype('msyh.ttc', 20)
except OSError:
    f1 = ImageFont.truetype('arial.ttf', 30)
    f2 = ImageFont.truetype('arial.ttf', 20)
d.text((PAD, 18), 'GDUFS south campus - living area: model vs plan vs imagery', fill=(255, 255, 255), font=f1)
x = PAD
for im, title, sub in panels:
    out.paste(im, (x, TITLE))
    d.text((x, TITLE + H + 8), title, fill=(120, 220, 160), font=f2)
    d.text((x, TITLE + H + 32), sub, fill=(160, 170, 190), font=f2)
    x += im.width + PAD
out.save(BASE + r'\south_living_compare.png')
print('saved', out.size)
