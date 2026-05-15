# Frontend — กองบริการธุรกิจจัดการพลังงาน

หน้าเว็บหลัก (Google Apps Script Web App) เก็บ source บน GitHub และ deploy ไปยัง Apps Script โดย **URL production เดิมไม่เปลี่ยน**

## Production URL

https://script.google.com/macros/s/AKfycby8V8L2CRZINAgkEcqfwjduA8w_7Yrl9t5AoQmISqtzq9BsghYbVjKOlZHvMuZdVUsagw/exec

## โครงสร้าง

```
src/
  Code.js          # Backend (doGet, API, Spreadsheet)
  Index.html       # หน้าหลัก
  Styles.html      # สไตล์รวม
  CSS.html         # CSS เพิ่มเติม
  JavaScript.html  # Client scripts
  appsscript.json  # การตั้งค่าโปรเจกต์
```

## ความต้องการ

- Node.js 18+
- [clasp](https://github.com/google/clasp) (`npm install` ในโปรเจกต์นี้)
- เข้าสู่ระบบ clasp แล้ว: `npx clasp login`

## ดึงโค้ดล่าสุดจาก Google

```bash
npm install
npm run pull
```

## Deploy production (URL เดิม)

```bash
npm run deploy
```

หรือ PowerShell:

```powershell
.\scripts\deploy.ps1
```

คำสั่งนี้จะ `clasp push` แล้วอัปเดต deployment เดิมใน `deploy.config.json` — **ไม่สร้าง URL ใหม่**

## Script ID

`1bnmodhBsQdAKX5lMdk9HoOCmTvn6vvPlbeiKv87vQEXJSUQOgzWhAb2b`
