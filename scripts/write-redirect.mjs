import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '..', 'src', 'Redirect.html');

const o = 'div';
const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ย้ายไปหน้าเว็บใหม่</title>
  <style>
    body { margin: 0; min-height: 100vh; font-family: Sarabun, system-ui, sans-serif; background: #f8f6fb; color: #473b4d; }
    .backdrop { position: fixed; inset: 0; background: rgba(26, 20, 35, .45); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 9999; }
    .modal { background: #fff; border-radius: 1.5rem; max-width: 28rem; width: 100%; padding: 2rem 1.75rem; box-shadow: 0 25px 50px -12px rgba(71, 59, 77, .25); border: 1px solid #ede6f2; text-align: center; animation: popIn .35s ease; }
    .icon { width: 3.5rem; height: 3.5rem; margin: 0 auto 1rem; border-radius: 9999px; background: #f0e6f5; color: #9b82c3; line-height: 3.5rem; font-size: 1.5rem; font-weight: 700; }
    p { font-size: .95rem; line-height: 1.65; margin: 0 0 1rem; color: #524459; }
    .url { display: block; word-break: break-all; background: #f8f6fb; border: 1px solid #ede6f2; border-radius: .75rem; padding: .75rem; font-size: .85rem; color: #9b82c3; margin-bottom: 1rem; text-decoration: none; }
    .hint { font-size: .9rem; color: #8b7a96; margin: 0 0 1.25rem; }
    .btn { display: inline-block; width: 100%; padding: .85rem 1.25rem; border: none; border-radius: 9999px; background: #b19cd9; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; box-sizing: border-box; }
    .btn:hover { background: #9b82c3; }
    @keyframes popIn { from { opacity: 0; transform: scale(.92) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  </style>
</head>
<body>
  <${o} class="backdrop" role="dialog" aria-modal="true">
    <${o} class="modal">
      <${o} class="icon">!</${o}>
      <p>หน้าเว็บนี้กำลังยกเลิกการใช้งาน กรุณาไปยัง</p>
      <a class="url" id="new-url" href="https://pongvitsam.github.io/Frontend/" target="_top">https://pongvitsam.github.io/Frontend/</a>
      <p class="hint">พร้อมกดเข้าได้เลย</p>
      <button type="button" class="btn" id="go-new-site">เข้าสู่หน้าเว็บใหม่</button>
    </${o}>
  </${o}>
  <script>
    (function () {
      var u = 'https://pongvitsam.github.io/Frontend/';
      function go() {
        try { window.top.location.href = u; } catch (e) { location.href = u; }
      }
      document.getElementById('go-new-site').onclick = go;
      document.getElementById('new-url').onclick = function (e) { e.preventDefault(); go(); };
    })();
  </script>
</body>
</html>`;

fs.writeFileSync(out, html, 'utf8');
console.log('Wrote', out);
