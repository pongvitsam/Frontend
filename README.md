# Frontend — กองบริการธุรกิจจัดการพลังงาน

หน้าเว็บหลัก — โหลดเร็วผ่าน **GitHub Pages** และยังเข้าผ่าน **URL เดิม** ของ Google Apps Script ได้

## URL

| ช่องทาง | URL |
|--------|-----|
| **หน้าหลัก (เร็วที่สุด)** | https://pongvitsam.github.io/Frontend/ |
| **ลิงก์เดิม (GAS)** | https://script.google.com/macros/s/AKfycby8V8L2CRZINAgkEcqfwjduA8w_7Yrl9t5AoQmISqtzq9BsghYbVjKOlZHvMuZdVUsagw/exec → **redirect ไป GitHub Pages อัตโนมัติ** |

- ลิงก์เดิมยังใช้ได้ — เปิดแล้วพาไปหน้าเร็วทันที
- เปิด UI บน GAS โดยตรง (สำรอง): เติม `?gas=1` ต่อท้าย URL เดิม

## สถาปัตยกรรม

```
GitHub Pages (docs/)     →  HTML, CSS, JS โหลดเร็วจาก CDN
        ↓ gas-client.js (bridge iframe)
Google Apps Script       →  API, Spreadsheet, Drive
```

- **URL เดิม**: GAS ส่ง HTML เล็กๆ + โหลด asset จาก GitHub Pages
- **GitHub Pages**: หน้าเต็ม + iframe bridge เรียก `google.script.run` ผ่าน GAS

## โครงสร้าง

```
docs/           → GitHub Pages (สร้างด้วย npm run build:pages)
src/            → Google Apps Script (Code.js, Bridge.html, Index.html)
scripts/        → build-pages.mjs, deploy.ps1
```

## คำสั่ง

```bash
npm install
npm run build:pages   # สร้าง docs/ จาก src/
npm run deploy        # build + push GAS + อัปเดต production (URL เดิม)
```

Push ขึ้น `main` จะ deploy GitHub Pages อัตโนมัติ (GitHub Actions)

## Script ID

`1bnmodhBsQdAKX5lMdk9HoOCmTvn6vvPlbeiKv87vQEXJSUQOgzWhAb2b`
