"""조판본 쪽 나눔 점검: 섹션(①~⑩)이 두 쪽에 걸쳐 잘렸는지 확인한다.
사용: python3 check_breaks.py [조판 폴더]   (pdftotext 필요)
섹션 제목이 있는 쪽과 섹션 마지막 줄이 있는 쪽이 다르면 '잘림'으로 보고한다.
① 장면과 ④ 탐구 일지는 문단 사이에서 쪽이 바뀌어도 되므로 '서술'로 따로 표시한다."""
import glob, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '원고')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '조판')
PROSE = {'①', '④'}


def squash(t):
    return re.sub(r'\s+', '', t)


def pages(pdf):
    n = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout).group(1))
    return [squash(subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), pdf, '-'], capture_output=True, text=True).stdout) for i in range(1, n + 1)]


def plain(line):
    line = re.sub(r'\*\*|`|\[(\d+)\]', lambda m: m.group(1) or '', line)
    line = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', line)
    line = re.sub(r'^\s*([-*>]|\d+\.)\s+', '', line)
    return line


def sections(md):
    parts = re.split(r'^## ', md, flags=re.M)[1:]
    for p in parts:
        head, _, body = p.partition('\n')
        lines = [l for l in body.splitlines() if l.strip() and not re.match(r'^\s*\|?\s*-{3,}', l)]
        last = lines[-1] if lines else head
        if last.lstrip().startswith('|'):
            cells = [c.strip() for c in last.strip().strip('|').split('|') if c.strip()]
            last = cells[-1] if cells else last
        yield head.strip(), squash(plain(last))


def page_of(pgs, needle, start=0):
    for i in range(start, len(pgs)):
        if needle and needle in pgs[i]:
            return i
    return None


bad = 0
for md_path in sorted(glob.glob(os.path.join(SRC, '*', '*.md'))):
    sem = os.path.basename(os.path.dirname(md_path))
    base = os.path.splitext(os.path.basename(md_path))[0]
    pdf = os.path.join(OUT, 'pdf', sem, base + '.pdf')
    pgs = pages(pdf)
    md = open(md_path, encoding='utf-8').read()
    cur = 0
    notes = []
    for head, tail in sections(md):
        hp = page_of(pgs, squash(head), cur)
        if hp is None:
            notes.append(f'{head[:2]} 제목을 찾지 못함')
            continue
        key = tail[-14:]
        tp = page_of(pgs, key, hp)
        if tp is None:
            notes.append(f'{head[:2]} 끝 문장을 찾지 못함({key})')
        elif tp != hp:
            kind = '서술(문단 사이)' if head[0] in PROSE else '잘림'
            notes.append(f'{head[:2]} {kind}: {hp + 1}쪽→{tp + 1}쪽')
            if head[0] not in PROSE:
                bad += 1
        cur = hp
    flag = '✔' if not any('잘림' in n or '찾지' in n for n in notes) else '✕'
    print(f'{flag} {base[:4]} {len(pgs)}쪽', ' · '.join(notes))
print('잘린 상자·표 섹션:', bad)
