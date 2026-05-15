/**
 * Apply luxurious gentleman palette across source files.
 * Run: node scripts/retheme-lux.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

const FILES = [
  'src/Styles.html',
  'src/Index.html',
  'client/app.client.js',
  'src/Redirect.html',
  'scripts/write-redirect.mjs',
];

/** Context-specific first (longer / more specific patterns) */
const PHASE1 = [
  ['dark:bg-[#473b4d]', 'dark:bg-[#2a3340]'],
  ['dark:border-[#473b4d]', 'dark:border-[#2d3544]'],
  ['dark:hover:bg-[#473b4d]', 'dark:hover:bg-[#2a3340]'],
  ['dark:divide-[#473b4d]', 'dark:divide-[#2d3544]'],
  ['dark:file:bg-[#473b4d]', 'dark:file:bg-[#2a3340]'],
  ['dark:hover:bg-[#9b82c3]', 'dark:hover:bg-[#8b7355]'],
  ['bg-orange-500', 'bg-[#5c4f3d]'],
  ['btn-pastel-purple', 'btn-lux-primary'],
  ['btn-light-purple', 'btn-lux-secondary'],
];

/** Global hex remap (longest first) */
const PHASE2 = [
  ['#1a1423', '#121820'],
  ['#2d2337', '#1a2029'],
  ['#332b3d', '#222a35'],
  ['#3b2d47', '#2a3340'],
  ['#473b4d', '#1f2933'],
  ['#524459', '#2c3542'],
  ['#8b7a96', '#6b7885'],
  ['#a994b5', '#8a96a3'],
  ['#cbbcd6', '#b8c0c8'],
  ['#9b82c3', '#8b7355'],
  ['#b19cd9', '#2c3548'],
  ['#b897d4', '#1f2933'],
  ['#d0b3e8', '#c9b896'],
  ['#e6d9f2', '#ebe6dc'],
  ['#ede6f2', '#e3ddd2'],
  ['#f0e6f5', '#f0ebe3'],
  ['#f8f6fb', '#f5f3ee'],
  ['#d69f9f', '#9a7b6a'],
  ['#c48787', '#7d5e52'],
  ['#f2f2f2', '#eceae5'],
];

/** Tailwind rgb() tokens in bundled Styles.html */
const PHASE3 = [
  ['rgb(26 20 35', 'rgb(18 24 32'],
  ['rgb(45 35 55', 'rgb(26 32 41'],
  ['rgb(51 43 61', 'rgb(34 42 53'],
  ['rgb(59 45 71', 'rgb(42 51 64'],
  ['rgb(71 59 77', 'rgb(31 41 51'],
  ['rgb(82 68 89', 'rgb(44 53 66'],
  ['rgb(139 122 150', 'rgb(107 120 133'],
  ['rgb(155 130 195', 'rgb(139 115 85'],
  ['rgb(169 148 181', 'rgb(138 150 163'],
  ['rgb(177 156 217', 'rgb(44 53 72'],
  ['rgb(196 135 135', 'rgb(125 94 82'],
  ['rgb(203 188 214', 'rgb(184 192 200'],
  ['rgb(208 179 232', 'rgb(201 184 150'],
  ['rgb(214 159 159', 'rgb(154 123 106'],
  ['rgb(230 217 242', 'rgb(235 230 220'],
  ['rgb(237 230 242', 'rgb(227 221 210'],
  ['rgb(240 230 245', 'rgb(240 235 227'],
  ['rgb(242 242 242', 'rgb(236 234 229'],
  ['rgb(248 246 251', 'rgb(245 243 238'],
  ['rgba(177,156,217,.15)', 'rgba(44,53,72,.12)'],
  ['rgba(45,35,55,.85)', 'rgba(26,32,41,.92)'],
  ['rgba(26,20,35,.85)', 'rgba(18,24,32,.88)'],
  ['rgba(248,246,251,.7)', 'rgba(245,243,238,.75)'],
];

const CUSTOM_CSS = `
/* —— Lux gentleman theme —— */
body{font-family:Sarabun,system-ui,-apple-system,Segoe UI,sans-serif;background-color:#f5f3ee;background-size:cover;background-position:50%;background-attachment:fixed;color:#1f2933;-webkit-font-smoothing:antialiased}
.dark body{background-color:#121820;color:#f5f3ee}
.bg-overlay{background:rgba(245,243,238,.75);position:fixed;inset:0;z-index:-1;transition:background .3s}
.dark .bg-overlay{background:rgba(18,24,32,.88)}
.glass-nav{background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid #e3ddd2;transition:.3s}
.dark .glass-nav{background:rgba(26,32,41,.92);border-bottom:1px solid #2d3544}
.glass-card{background:rgba(255,255,255,.97);backdrop-filter:blur(12px);border:1px solid #e3ddd2;box-shadow:0 12px 40px -12px rgba(31,41,51,.1);transition:.3s}
.dark .glass-card{background:rgba(34,42,53,.96);border:1px solid #2d3544;box-shadow:0 12px 40px -12px rgba(0,0,0,.45)}
.btn-lux-primary{background-color:#2c3548;color:#fff;transition:.25s;letter-spacing:.02em}
.btn-lux-primary:hover{background-color:#1f2933}
.btn-lux-secondary{background-color:#8b7355;color:#fff;transition:.25s;letter-spacing:.02em}
.btn-lux-secondary:hover{background-color:#6f5c44}
.grayscale-card{filter:grayscale(100%);opacity:.65;cursor:not-allowed}
.custom-scrollbar::-webkit-scrollbar{width:5px}
.custom-scrollbar::-webkit-scrollbar-track{background:#f5f3ee;border-radius:8px}
.dark .custom-scrollbar::-webkit-scrollbar-track{background:#121820}
.custom-scrollbar::-webkit-scrollbar-thumb{background:#c9b896;border-radius:8px}
.dark .custom-scrollbar::-webkit-scrollbar-thumb{background:#3d4a5c}
.marquee-container{width:100%;overflow:hidden;white-space:nowrap}
.animate-marquee{display:inline-block;padding-left:100%;animation:marquee 20s linear infinite}
.animate-marquee:hover{animation-play-state:paused}
@keyframes marquee{0%{transform:translate(0)}to{transform:translate(-100%)}}
`;

function applyPhases(content) {
  let out = content;
  for (const [from, to] of [...PHASE1, ...PHASE2, ...PHASE3]) {
    out = out.split(from).join(to);
  }
  return out;
}

function patchStylesHtml(content) {
  const start = content.indexOf('body{font-family:Sarabun');
  const end = content.indexOf('.fixed{position:fixed}');
  if (start === -1 || end === -1) {
    console.warn('Styles.html: custom block markers not found, skipping patch');
    return applyPhases(content);
  }
  return content.slice(0, start) + CUSTOM_CSS.trim() + content.slice(end);
}

for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.warn('skip (missing):', rel);
    continue;
  }
  let content = fs.readFileSync(file, 'utf8');
  content = rel.endsWith('Styles.html') ? patchStylesHtml(content) : applyPhases(content);
  fs.writeFileSync(file, content);
  console.log('updated:', rel);
}

console.log('Done. Run: npm run build:pages');
