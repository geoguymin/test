"""원고 형식 점검: python3 check.py <원고.md> [...]"""
import re, sys

SECTIONS = [
    '① 장면 — 질문이 태어나는 순간', '② 노란 카드: 질문ON 진단', '③ 질문 쪼개기(초록 카드)',
    '④ 탐구 일지', '⑤ 질문 사다리', '⑥ 사상가의 목소리', '⑦ 파란 카드와 보라 카드',
    '⑧ 논술 작업대', '⑨ 너의 질문 차례', '⑩ 교사용 노트(부록)',
]
LIMITS = {'①': (500, 700), '④': (1000, 1500), '⑦': (300, 500), '⑥': (400, None), '⑧': (400, 600)}


def prose_len(text):
    lines = [l for l in text.splitlines() if l.strip() and not l.lstrip().startswith('|') and not l.startswith('#')]
    return len(' '.join(lines))


def check(path):
    s = open(path, encoding='utf-8').read()
    out = []
    lines = s.splitlines()
    if not re.match(r'^# 제\d+회 · .+', lines[0] if lines else ''):
        out.append('머리 제목 형식이 "# 제N회 · 제목"이 아님')
    if not any(l.startswith('> 「물음표 공방」') for l in lines[:5]):
        out.append('머리 안내 줄("> 「물음표 공방」 …")이 없음')
    heads = [l[3:].strip() for l in lines if l.startswith('## ')]
    if heads != SECTIONS:
        missing = [x for x in SECTIONS if x not in heads]
        extra = [x for x in heads if x not in SECTIONS]
        out.append(f'섹션 제목 불일치 — 빠짐: {missing} / 다름: {extra}')
    # split sections
    parts = re.split(r'^## ', s, flags=re.M)
    sec = {p.split('\n', 1)[0].strip()[:1]: p.split('\n', 1)[1] if '\n' in p else '' for p in parts[1:]}
    report = []
    for k, (lo, hi) in LIMITS.items():
        n = prose_len(sec.get(k, ''))
        flag = ''
        if n < lo * 0.85 or (hi and n > hi * 1.2):
            flag = ' ⚠'
        report.append(f'{k} {n}자{flag}')
    body = sum(prose_len(sec.get(k, '')) for k in '①④⑤⑦')
    total = len(s)
    eojeol = len(re.findall(r'\S+', re.sub(r'[#>|*`\-]+', ' ', s)))
    for i, l in enumerate(lines, 1):
        if '  ' in l.strip() and not l.lstrip().startswith('|'):
            out.append(f'{i}행: 두 칸 이상 공백')
        if '　' in l or '\t' in l:
            out.append(f'{i}행: 전각 공백/탭')
        if l.rstrip() != l:
            out.append(f'{i}행: 줄 끝 공백')
        for tok in re.findall(r'\S+', l):
            if len(tok) > 22 and not tok.startswith('|') and not tok.startswith('http'):
                out.append(f'{i}행: 긴 어절({len(tok)}자) {tok[:30]}')
            if tok.count('/') >= 2:
                out.append(f'{i}행: 슬래시 나열 {tok[:30]}')
            if tok.count('·') >= 3:
                out.append(f'{i}행: 가운뎃점 넷 이상 나열 {tok[:30]}')
    # hard-wrapped paragraph detection: two consecutive plain prose lines
    for i in range(len(lines) - 1):
        a, b = lines[i], lines[i + 1]
        plain = lambda x: x.strip() and not re.match(r'^\s*([#>|\-*]|\d+\.|\[\d+\]|```|<)', x)
        if plain(a) and plain(b):
            out.append(f'{i + 1}~{i + 2}행: 문단 안 강제 줄바꿈 의심(빈 줄 없이 이어진 두 줄)')
    print(f'== {path}')
    print(f'   전체 {total}자 · 약 {eojeol}어절 · 본문(①④⑤⑦) {body}자 · ' + ' · '.join(report))
    for o in out[:40]:
        print('   -', o)
    if not out:
        print('   형식 문제 없음')


for p in sys.argv[1:]:
    check(p)
