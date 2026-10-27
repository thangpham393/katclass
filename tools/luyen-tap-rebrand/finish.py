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
