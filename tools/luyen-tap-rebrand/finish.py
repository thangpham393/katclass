import sys, glob, re
P = sys.argv[1]
for f in glob.glob(P + '/sbt-hsk1/lessons/*.html'):
    t = open(f, encoding='utf-8').read()
    open(f, 'w', encoding='utf-8').write(t.replace('TÊN TRUNG TÂM', 'KAT CHINESE'))
f = P + '/index.html'; t = open(f, encoding='utf-8').read()
for cls, acc, soft in [('hsk1', '#2549ec', '#eff4ff'), ('hsk2', '#1e3aa8', '#dbe6fe'),
                       ('hsk3', '#0a7d59', '#e7f6ef'), ('chude', '#dc2626', '#fef2f2')]:
    t = re.sub(r'\.level-card\.%s \{[^}]*\}' % cls, '.level-card.%s { --accent: %s; --soft: %s; }' % (cls, acc, soft), t)
open(f, 'w', encoding='utf-8').write(t)
f = P + '/hsk-hongdat-theme.css'; t = open(f, encoding='utf-8').read()
open(f, 'w', encoding='utf-8').write(t + '\n/* KAT: chữ phụ trên header nền xanh */\n.page-header .subtitle,.header .subtitle{color:rgba(255,255,255,.85) !important}\n')
print('finished')

# Font: theme gốc xếp "Noto Sans SC" trước font hệ thống — máy nào không tải được
# Be Vietnam Pro sẽ vẽ chữ Việt bằng font Trung (thiếu glyph "ủ", dấu bị tách).
f = P + '/hsk-hongdat-theme.css'; t = open(f, encoding='utf-8').read()
t = ('@import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap");\n'
     + t)
t = t.replace('font-family:"Be Vietnam Pro","Inter","Noto Sans SC","PingFang SC","Microsoft YaHei","Segoe UI",system-ui,-apple-system,sans-serif !important;',
              'font-family:"Be Vietnam Pro",-apple-system,system-ui,"Segoe UI",Roboto,Arial,"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif !important;')
open(f, 'w', encoding='utf-8').write(t)
print('font fixed')

# Trò "Nối chữ" và "Ghép cặp" không được dựng lúc tải trang (bản gốc quên gọi
# trong window.onload) → tab trống tới khi bấm "Bắt đầu lại". Dựng khi mở tab
# lần đầu; không gọi lúc tải vì initMemoryGame chạy đồng hồ ngay.
LAZY_INIT = '''<script>
/* KAT: dựng trò Nối chữ / Ghép cặp khi mở tab lần đầu */
document.addEventListener('click', function (e) {
  var btn = e.target.closest && e.target.closest('.tab-btn');
  if (!btn) return;
  var tab = btn.getAttribute('data-tab');
  setTimeout(function () {
    var left = document.getElementById('leftCol');
    var grid = document.getElementById('memGrid');
    if (tab === 'connect' && left && !left.children.length && typeof initConnectGame === 'function') initConnectGame();
    if (tab === 'memorygame' && grid && !grid.children.length && typeof initMemoryGame === 'function') initMemoryGame();
  }, 0);
});
</script>
'''
n = 0
for f in glob.glob(P + '/*.html'):
    t = open(f, encoding='utf-8').read()
    if 'onclick="initConnectGame()"' not in t or 'KAT: dựng trò' in t: continue
    i = t.rfind('</body>')
    open(f, 'w', encoding='utf-8').write(t[:i] + LAZY_INIT + t[i:]); n += 1
print('lazy init added', n)
