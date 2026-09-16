# KruKhayan Physics

เว็บไซต์จัดการเรียนการสอนวิชาฟิสิกส์ (ฟิสิกส์5, ฟิสิกส์6, วิทยาศาสตร์กายภาพ(ฟิสิกส์)1, วิทยาศาสตร์กายภาพ(ฟิสิกส์)2) — สร้างด้วย Next.js + Supabase

## เริ่มใช้งาน

1. ติดตั้ง dependencies:
   ```bash
   npm install
   ```
2. ไฟล์ `.env.local` เชื่อมต่อกับโปรเจกต์ Supabase ที่สร้างไว้แล้ว (krukhayan-physics) — ไม่ต้องแก้ไข
3. รันเซิร์ฟเวอร์:
   ```bash
   npm run dev
   ```
   เปิด http://localhost:3000

## โครงสร้างฐานข้อมูล (Supabase, ตั้งค่าไว้แล้ว)

- `profiles` — ผู้ใช้ (ครู/นักเรียน), เชื่อมกับระบบ auth
- `subjects` — รายวิชา (ฟิสิกส์5, ฟิสิกส์6, ...)
- `terms` — ปีการศึกษา + เทอม
- `courses` — วิชาที่สอนในแต่ละเทอม (ผูก subject + term + ครูผู้สอน)
- `enrollments` — นักเรียนที่ลงทะเบียนในแต่ละ course
- `score_items` — รายการให้คะแนน (สอบ/ใบงาน) ในแต่ละ course
- `scores` — คะแนนรายบุคคล (นักเรียนเห็นได้เฉพาะของตัวเอง, ครูเห็น/แก้ได้ทั้งหมด — บังคับด้วย Row Level Security)
- `materials` — สื่อการสอน (ลิงก์/ไฟล์) ต่อ course

## สิ่งที่ทำไว้แล้ว

- หน้า login (`/login`) เชื่อม Supabase Auth
- หน้า dashboard (`/dashboard`) แสดงชื่อผู้ใช้ + รายวิชา (ต้อง login ก่อน)
- Middleware ป้องกันหน้า `/dashboard` สำหรับผู้ที่ยังไม่ login
- Row Level Security ครบทุกตาราง

## ขั้นตอนถัดไปที่ต้องทำ

1. สร้างบัญชีครู: ไปที่ Supabase Dashboard > Authentication > Add user (ใช้อีเมลของอาจารย์) แล้ว insert แถวใน `profiles` โดยตั้ง `role = 'teacher'`
2. เพิ่มรายวิชาใน `subjects`, สร้าง `terms` ของปีการศึกษาปัจจุบัน, สร้าง `courses` เชื่อมวิชา+เทอม+ครู
3. สร้างหน้า "จัดการคะแนน" และ "เพิ่มนักเรียน" (ยังไม่ได้สร้าง — เป็นหน้าถัดไปที่ควรทำ)
4. Deploy ขึ้น Vercel (ฟรี) — เพิ่ม environment variables `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` ใน Vercel project settings ตามค่าใน `.env.local`

## ระบบติดตามอุณหภูมิและความชื้น (ESP32 + DHT11)

ระบบ IoT ที่ใช้ Supabase และ Vercel ชุดเดียวกับระบบคะแนน — บอร์ด ESP32 วัดค่าแล้วส่งขึ้นเว็บ
มีกราฟย้อนหลัง ตั้งเกณฑ์ และแจ้งเตือนผ่าน LINE

- เอกสารออกแบบระบบทั้งหมด: [`docs/iot/README.md`](docs/iot/README.md)
- เฟิร์มแวร์บอร์ด: [`firmware/esp32-dht11/`](firmware/esp32-dht11/)
- SQL สร้างตาราง: `supabase/migrations/20260916000000_iot_monitoring.sql`
- หน้าเว็บ: `/dashboard/iot`

ต้องตั้ง environment variables เพิ่ม (ดู `.env.example`): `LINE_CHANNEL_ACCESS_TOKEN`,
`LINE_CHANNEL_SECRET`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`

## เว็บไซต์ที่ deploy แล้ว

https://krukhayan-physics.vercel.app

## Supabase Project

- Project ref: `ypktjqtkryupmwioeojk`
- URL: https://ypktjqtkryupmwioeojk.supabase.co
