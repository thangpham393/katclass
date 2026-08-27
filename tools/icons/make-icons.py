#!/usr/bin/env python3
"""
Sinh bộ biểu tượng ứng dụng KAT CLASS (favicon + màn hình chính iOS/Android).

Chạy lại khi đổi màu hoặc đổi chữ:  python3 tools/icons/make-icons.py
Cần Pillow (macOS đã có sẵn trong python3 hệ thống của máy dev).

Hai kiểu nền, cố ý khác nhau:
  • Bo góc  — dùng cho favicon và icon manifest thường: hệ điều hành hiển thị
    nguyên hình nên phải tự bo.
  • Tràn viền — dùng cho apple-icon và icon maskable: iOS và Android tự cắt mặt
    nạ, tự bo sẵn sẽ bị bo hai lần thành góc lẹm.
"""
from PIL import Image, ImageDraw, ImageFont

TOP = (37, 73, 236)      # brand-600 — xanh KAT
BOTTOM = (19, 31, 77)    # brand-950 — navy đáy
DOT = (220, 38, 38)      # gold-600 — đỏ KAT
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
SS = 4                   # vẽ lớn gấp 4 rồi thu nhỏ để cạnh mịn


def render(size: int, rounded: bool, letter_ratio: float, dot: bool) -> Image.Image:
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    # Nền chuyển sắc dọc
    grad = Image.new("RGB", (1, s))
    for y in range(s):
        t = y / max(s - 1, 1)
        grad.putpixel((0, y), tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)))
    grad = grad.resize((s, s))

    mask = Image.new("L", (s, s), 0)
    md = ImageDraw.Draw(mask)
    if rounded:
        md.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=255)
    else:
        md.rectangle((0, 0, s - 1, s - 1), fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)

    # Chữ K trắng, canh giữa theo hộp bao thật của glyph (không theo baseline)
    font = ImageFont.truetype(FONT, int(s * letter_ratio))
    box = d.textbbox((0, 0), "K", font=font)
    # Dịch nhẹ sang trái để chân chữ K không dính chấm đỏ ở góc phải
    shift = -s * 0.05 if dot else 0
    d.text(
        ((s - (box[2] - box[0])) / 2 - box[0] + shift, (s - (box[3] - box[1])) / 2 - box[1]),
        "K",
        font=font,
        fill=(255, 255, 255),
    )

    # Chấm đỏ KAT ở góc dưới phải
    if dot:
        r = s * 0.072
        cx, cy = s * 0.795, s * 0.735
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=DOT)

    return img.resize((size, size), Image.LANCZOS)


OUT = [
    # (đường dẫn, cỡ, bo góc, cỡ chữ, chấm đỏ)
    ("src/app/icon.png", 32, True, 0.62, False),          # favicon: bỏ chấm cho đỡ rối
    ("src/app/apple-icon.png", 180, False, 0.55, True),   # màn hình chính iPhone
    ("public/icon-192.png", 192, True, 0.56, True),
    ("public/icon-512.png", 512, True, 0.56, True),
    ("public/icon-maskable-512.png", 512, False, 0.44, True),  # chừa vùng an toàn cho mặt nạ Android
]

if __name__ == "__main__":
    for path, size, rounded, ratio, dot in OUT:
        render(size, rounded, ratio, dot).save(path)
        print("đã ghi", path)
