"""Đổi bảng màu web luyện tập sang màu KAT CLASS (xanh #2549ec + đỏ #dc2626)."""
import sys, re, glob, colorsys

EXACT = {  # màu chủ đạo cũ → đúng màu thương hiệu app
    "D63B59": "2549EC", "B55268": "2549EC", "C41E3A": "1D4ED8", "C02C48": "1D4ED8",
    "B82F48": "1D4ED8", "992244": "1E3AA8", "934255": "1D4ED8", "8F3F52": "1D4ED8",
    "733341": "1E3AA8", "743344": "1E3AA8",
    "C9973D": "DC2626", "C99A59": "DC2626", "B8822C": "B91C1C", "A77A3F": "B91C1C",
    "A9793F": "B91C1C", "F28C00": "DC2626",
    "FFF7F5": "F5F8FF", "FFF5F3": "F5F8FF", "FFFCFA": "FAFCFF", "FFFDFC": "FFFFFF",
    "3F3034": "0F172A", "382D30": "0F172A", "7E6C70": "64748B", "7E6E72": "64748B",
    "EEDBD8": "E2E8F0", "EBD9D7": "E2E8F0", "49373C": "1C2338", "5B3D46": "2B3555",
}

def hls(r, g, b):
    return colorsys.rgb_to_hls(r / 255, g / 255, b / 255)

def to_rgb(h, l, s):
    return tuple(round(c * 255) for c in colorsys.hls_to_rgb(h, l, s))

def remap(r, g, b):
    key = f"{r:02X}{g:02X}{b:02X}"
    if key in EXACT:
        v = EXACT[key]; return int(v[:2], 16), int(v[2:4], 16), int(v[4:], 16)
    h, l, s = hls(r, g, b); deg = h * 360
    warm = deg < 60 or deg >= 330
    pure_red = deg >= 352 or deg < 5  # đỏ báo sai / nền báo sai: giữ
    if s < 0.04 or not warm:          # xám, xanh lá, xanh dương, tím: giữ
        return r, g, b
    if l >= 0.97 or (l >= 0.9 and not pure_red):     # nền kem/hồng nhạt → trắng ánh xanh
        return to_rgb(220 / 360, max(l, 0.95), min(max(s, 0.6), 1.0))
    if s < 0.25:                      # chữ/viền nâu xám → xám xanh than
        return to_rgb(222 / 360, l, min(s * 1.4, 0.3))
    if 335 <= deg < 352 or 5 <= deg < 18:   # hồng/đỏ son/đỏ gạch chủ đạo → xanh KAT
        return to_rgb(224 / 360, l, min(max(s, 0.75), 0.85) if l < 0.8 else max(s, 0.8))
    if 18 <= deg < 48:                # vàng đồng/cam/nâu → đỏ KAT
        return to_rgb(0, l, min(max(s, 0.6), 0.75) if l < 0.8 else max(s, 0.7))
    return r, g, b                    # đỏ thuần, vàng sao: giữ

def sub_hex(m):
    h = m.group(1)
    full = "".join(c * 2 for c in h) if len(h) == 3 else h
    r, g, b = (int(full[i:i + 2], 16) for i in (0, 2, 4))
    nr = remap(r, g, b)
    if nr == (r, g, b): return m.group(0)
    return "#%02x%02x%02x" % nr

def sub_rgb(m):
    r, g, b = int(m.group(2)), int(m.group(3)), int(m.group(4))
    nr = remap(r, g, b)
    return f"{m.group(1)}{nr[0]},{nr[1]},{nr[2]}"

HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])")
RGB = re.compile(r"(rgba?\(\s*)(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})")
B64 = re.compile(r"(data:[a-z]+/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+)")

root = sys.argv[1]; changed = 0
for f in glob.glob(root + "/**/*.html", recursive=True) + glob.glob(root + "/**/*.css", recursive=True):
    t = open(f, encoding="utf-8").read()
    parts = B64.split(t)   # phần lẻ là dữ liệu base64 (audio/ảnh) — không đụng
    for i in range(0, len(parts), 2):
        parts[i] = RGB.sub(sub_rgb, HEX.sub(sub_hex, parts[i]))
    n = "".join(parts)
    if n != t:
        open(f, "w", encoding="utf-8").write(n); changed += 1
print("files changed:", changed)
