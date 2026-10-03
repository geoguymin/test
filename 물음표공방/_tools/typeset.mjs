// 원고(.md) → 조판본(.html, .pdf). 양쪽 정렬 + 어절 단위 줄 나눔(word-break: keep-all).
// 준비: 이 폴더에서 npm install (Chromium이 없으면 npx playwright install chromium)
// 사용: node typeset.mjs [원고 폴더] [출력 폴더]  — 기본값은 ../원고 → ../조판
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { marked } from 'marked'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')) }

const HERE = path.dirname(fileURLToPath(import.meta.url))
const [, , SRC = path.join(HERE, '..', '원고'), OUT = path.join(HERE, '..', '조판')] = process.argv
marked.setOptions({ gfm: true, breaks: false })
// 회차별 배율(쪽 맞춤): _data/zoom.json {"회차": 배율}. ZOOM_ALL 환경 변수로 모든 회차에 같은 배율을 줄 수 있다(맞춤 시험용).
const ZFILE = path.join(SRC, '..', '_data', 'zoom.json')
const ZOOM = fs.existsSync(ZFILE) ? JSON.parse(fs.readFileSync(ZFILE, 'utf8')) : {}
const zoomOf = no => process.env.ZOOM_ALL ? +process.env.ZOOM_ALL : (ZOOM[no] || 1)
const ONLY_EP_PDF = !!process.env.ONLY_EP_PDF

const SEC_CLASS = { '①': 'scene', '②': 'yellow', '③': 'green', '④': 'journal', '⑤': 'ladder', '⑥': 'voice', '⑦': 'blue', '⑧': 'bench', '⑨': 'yourturn', '⑩': 'teacher' }

const CDN_FONTS = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap">`
const nm = path.join(HERE, 'node_modules')
const LOCAL_FONTS = `
<link rel="stylesheet" href="${pathToFileURL(path.join(nm, 'pretendard/dist/web/static/pretendard.css')).href}">
<link rel="stylesheet" href="${pathToFileURL(path.join(nm, '@fontsource/nanum-myeongjo/400.css')).href}">
<link rel="stylesheet" href="${pathToFileURL(path.join(nm, '@fontsource/nanum-myeongjo/700.css')).href}">
<link rel="stylesheet" href="${pathToFileURL(path.join(nm, '@fontsource/nanum-myeongjo/800.css')).href}">`

const CSS = `
:root{
  --ink:#1f2430; --muted:#5f6675; --line:#d9dde5; --paper:#ffffff;
  --yellow:#fff4cc; --yellow-b:#e2b100; --green:#e5f3e8; --green-b:#3f9a5a;
  --blue:#e4eefc; --blue-b:#2f6fd0; --purple:#efe7fb; --purple-b:#7b4cc2;
  --voice:#f6f1e8; --voice-b:#a07a3c; --bench:#eef0f4; --bench-b:#5d6577; --pink:#fde8ec;
}
*{box-sizing:border-box}
html{background:var(--paper)}
body{margin:0; color:var(--ink); background:var(--paper);
  font-family:'Nanum Myeongjo','NanumMyeongjo',serif; font-size:10.4pt; line-height:1.78;}
main{max-width:176mm; margin:0 auto; padding:0 16px}
/* 어절 기준 자간 맞춤: 양쪽 정렬 + 어절 단위 줄 나눔 */
p, li, td, th, blockquote{text-align:justify; text-justify:inter-word; word-break:keep-all; overflow-wrap:break-word; line-break:strict; hanging-punctuation:none}
p{margin:0 0 .55em}
h1,h2,h3,.kicker,.meta,table,.box-label{font-family:'Pretendard','Pretendard Variable',sans-serif}
.kicker{font-size:8.6pt; letter-spacing:.08em; color:var(--muted); margin:0 0 4px}
h1{font-size:19pt; line-height:1.35; margin:0 0 8px; word-break:keep-all; font-weight:800}
.meta{font-size:8.4pt; color:var(--muted); border-top:2px solid var(--ink); border-bottom:1px solid var(--line); padding:6px 0; margin:0 0 14px; word-break:keep-all; text-align:left}
h2{font-size:11.6pt; margin:13px 0 6px; font-weight:800; break-after:avoid; word-break:keep-all}
h3{font-size:10.2pt; margin:10px 0 5px; font-weight:700; break-after:avoid; word-break:keep-all}
section{margin:0 0 6px}
.box{border-radius:6px; padding:9px 13px 6px; margin:10px 0 12px}
.box h2{margin-top:2px}
.yellow{background:var(--yellow); border-left:5px solid var(--yellow-b)}
.green{background:var(--green); border-left:5px solid var(--green-b)}
.voice{background:var(--voice); border-left:5px solid var(--voice-b)}
.blue{background:linear-gradient(180deg,var(--blue),var(--purple)); border-left:5px solid var(--blue-b)}
.bench{background:var(--bench); border-left:5px solid var(--bench-b)}
.yourturn{border:1.5px dashed var(--bench-b)}
.teacher{border-top:1px solid var(--line); font-size:9pt; color:#3d4352; margin-top:8px; padding-top:2px}
.teacher h2{font-size:10pt; color:var(--muted); margin:6px 0 4px}
.teacher ul{margin:2px 0 0} .teacher li{margin:0 0 1px; line-height:1.6}
.blue strong{font-family:'Pretendard',sans-serif}
.blue p > strong:only-child{display:block; font-size:12.4pt; line-height:1.5; margin:4px 0; color:#173d7a; text-align:left}
table{width:100%; border-collapse:collapse; font-size:8.5pt; line-height:1.5; margin:6px 0 8px}
th,td{border:1px solid var(--line); padding:4px 6px; vertical-align:top; text-align:left}
th{background:rgba(0,0,0,.045); font-weight:700}
tr{break-inside:avoid}
blockquote{margin:6px 0; padding:4px 12px; border-left:3px solid var(--line); color:#3d4352}
ul,ol{margin:4px 0 8px; padding-left:1.3em}
li{margin:0 0 3px}
code{font-family:'Pretendard',sans-serif; font-size:.92em; background:rgba(0,0,0,.05); padding:0 3px; border-radius:3px}
hr{border:0; border-top:1px solid var(--line); margin:12px 0}
.ep + .ep{break-before:page}
/* 쪽 나눔: 카드 상자·질문 사다리·교사용 노트·표는 통째로 넘기고, 서술은 문단 사이에서만 나눈다 */
section.box, section.ladder, section.teacher, table, blockquote, ul, ol{break-inside:avoid}
p, li{break-inside:avoid; orphans:3; widows:3}
.kicker, h1, .meta{break-after:avoid}
@media screen{ body{padding:28px 0} .ep{padding:0 0 40px} }
@page{size:A4; margin:14mm 16mm 15mm}
`

function splitManuscript(md) {
  const lines = md.split('\n')
  const titleLine = lines.find(l => l.startsWith('# ')) || '# '
  const metaLine = lines.find(l => l.startsWith('> ')) || ''
  const body = md.slice(md.indexOf('\n## ') + 1)
  const parts = body.split(/^## /m).filter(s => s.trim())
  const sections = parts.map(p => {
    const nl = p.indexOf('\n')
    const head = (nl < 0 ? p : p.slice(0, nl)).trim()
    return { head, mark: head[0], text: nl < 0 ? '' : p.slice(nl + 1) }
  })
  return { title: titleLine.slice(2).trim(), meta: metaLine.slice(2).trim(), sections }
}

function episodeHTML(md) {
  const { title, meta, sections } = splitManuscript(md)
  const m = title.match(/^제(\d+)회\s*·\s*(.+)$/)
  const no = m ? +m[1] : 0
  const name = m ? m[2] : title
  const sem = no > 16 ? 2 : 1
  const secs = sections.map(s => {
    const cls = SEC_CLASS[s.mark] || ''
    const boxed = ['yellow', 'green', 'voice', 'blue', 'bench', 'yourturn'].includes(cls)
    return `<section class="${boxed ? 'box ' : ''}${cls}"><h2>${marked.parseInline(s.head)}</h2>${marked.parse(s.text)}</section>`
  }).join('\n')
  return { no, name, html: `<article class="ep" id="ep${no}"${zoomOf(no) !== 1 ? ` style="zoom:${zoomOf(no)}"` : ''}><p class="kicker">물음표 공방 · ${sem}학기 · 제${no}회</p><h1>${marked.parseInline(name)}</h1><p class="meta">${marked.parseInline(meta.replace(/^「물음표 공방」\s*(\d학기\s*·\s*)?/, ''))}</p>${secs}</article>` }
}

function page(title, inner, fonts) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>${fonts}<style>${CSS}</style></head><body><main>${inner}</main></body></html>`
}

const files = []
for (const sem of fs.readdirSync(SRC).sort()) {
  const d = path.join(SRC, sem)
  if (!fs.statSync(d).isDirectory()) continue
  for (const f of fs.readdirSync(d).sort()) if (f.endsWith('.md')) files.push({ sem, f, p: path.join(d, f) })
}

const browser = await chromium.launch()
const ctx = await browser.newContext()
const pg = await ctx.newPage()
const tmp = path.join(HERE, 'tmp')
fs.mkdirSync(tmp, { recursive: true })
const footer = `<div style="width:100%;font-size:7.5pt;color:#8a90a0;text-align:center;font-family:sans-serif"><span class="pageNumber"></span></div>`

async function toPDF(html, out) {
  const t = path.join(tmp, 'p.html')
  fs.writeFileSync(t, html)
  await pg.goto(pathToFileURL(t).href, { waitUntil: 'load' })
  await pg.evaluate(() => document.fonts.ready)
  await pg.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate: footer })
}

const bySem = {}
for (const { sem, f, p } of files) {
  const ep = episodeHTML(fs.readFileSync(p, 'utf8'))
  ;(bySem[sem] = bySem[sem] || []).push(ep)
  const base = f.replace(/\.md$/, '')
  const htmlDir = path.join(OUT, 'html', sem), pdfDir = path.join(OUT, 'pdf', sem)
  fs.mkdirSync(htmlDir, { recursive: true }); fs.mkdirSync(pdfDir, { recursive: true })
  const t = `물음표 공방 제${ep.no}회`
  if (!ONLY_EP_PDF) fs.writeFileSync(path.join(htmlDir, base + '.html'), page(t, ep.html, CDN_FONTS))
  await toPDF(page(t, ep.html, LOCAL_FONTS), path.join(pdfDir, base + '.pdf'))
  console.log('ok', sem, base)
}
for (const [sem, eps] of Object.entries(ONLY_EP_PDF ? {} : bySem)) {
  const inner = eps.sort((a, b) => a.no - b.no).map(e => e.html).join('\n')
  const t = `물음표 공방 ${sem} 합본`
  fs.writeFileSync(path.join(OUT, 'html', `물음표공방_${sem}_합본.html`), page(t, inner, CDN_FONTS))
  await toPDF(page(t, inner, LOCAL_FONTS), path.join(OUT, 'pdf', `물음표공방_${sem}_합본.pdf`))
  console.log('ok 합본', sem)
}
await browser.close()
