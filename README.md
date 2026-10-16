# Cloudflare CORS Proxy — Complete Starter

ชุด Worker สำหรับ CORS proxy ที่มี allowlist และค่า Referer แบบตั้งผ่าน environment variable ได้

## ไฟล์
- `src/index.js` — Worker API
- `wrangler.toml` — ค่าเริ่มต้นสำหรับ Wrangler
- `test.html` — หน้าทดสอบ API
- `README.md` — คู่มือนี้

## Deploy ผ่าน Cloudflare Dashboard
1. เปิด https://dash.cloudflare.com/
2. ไปที่ Workers & Pages แล้วสร้าง Worker
3. วางโค้ดจาก `src/index.js` แล้ว Deploy
4. ไปที่ Settings → Variables แล้วตั้งค่า:
   - `ALLOWED_HOSTS`: hostname ของ API ที่คุณเป็นเจ้าของ/ได้รับอนุญาต เช่น `api.example.com` (ไม่ใส่ https://; หลาย host คั่นด้วย comma)
   - `ALLOWED_ORIGINS`: origin ของ frontend ของคุณ เช่น `https://my-app.example` หรือ `*` สำหรับ API สาธารณะที่ไม่มี credentials
   - `UPSTREAM_REFERER`: ไม่บังคับ; ใส่ Referer สำหรับ API ที่คุณควบคุมหรือได้รับอนุญาตให้เรียกเท่านั้น
5. Deploy ใหม่ แล้วเปิด `https://YOUR-WORKER.workers.dev/health`

## Deploy ด้วย Wrangler
ต้องมี Node.js:
```bash
npm install -g wrangler
wrangler login
wrangler deploy
```
แก้ `wrangler.toml` ก่อน deploy ให้ตรงกับโดเมนที่อนุญาต

## Routes
- `GET /health` — ตรวจสถานะ
- `GET /api/proxy?url=<encoded-https-url>` — เรียก API ที่อยู่ใน allowlist
- `HEAD /api/proxy?url=...`
- `OPTIONS /api/proxy` — CORS preflight

ตัวอย่าง:
```text
https://YOUR-WORKER.workers.dev/api/proxy?url=https%3A%2F%2Fapi.example.com%2Fv1%2Fitems
```

## การตั้ง Referer
ใน Worker Settings → Variables เพิ่ม `UPSTREAM_REFERER` เป็น URL ของเว็บไซต์/API ที่คุณควบคุมหรือได้รับอนุญาต เช่น:
```text
https://your-own-site.example/
```
โค้ดจะส่งค่านี้เป็น `Referer` ไปยัง upstream API ที่อนุญาตไว้เท่านั้น

## ข้อจำกัดและความปลอดภัย
- ไม่ใช่ open proxy: ปลายทางต้องอยู่ใน `ALLOWED_HOSTS`
- รองรับเฉพาะ HTTPS และ GET/HEAD/OPTIONS
- ตัวอย่างนี้ไม่ได้ส่งต่อ `User-Agent` ที่กำหนดเอง
- อย่าใช้เพื่อปลอม Referer หรือหลบเลี่ยงการควบคุมการเข้าถึงของเว็บไซต์บุคคลที่สาม
- `Access-Control-Allow-Origin: *` ไม่เหมาะกับข้อมูลส่วนบุคคลหรือ API ที่ใช้ cookies/credentials
- ก่อน production ให้เพิ่ม authentication และ rate limiting ตามความเสี่ยงของแอป
