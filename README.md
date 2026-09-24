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

- `profiles` — ผู้ใช้ (ครู/นักเรียน), เชื่อมกับระบบ auth — ผู้ใช้แก้เองไม่ได้ (กันนักเรียนตั้งตัวเองเป็นครู)
- `subjects` — รายวิชา (ฟิสิกส์5, ฟิสิกส์6, ...)
- `terms` — ปีการศึกษา + เทอม
- `courses` — วิชาที่สอนในแต่ละเทอม (ผูก subject + term + ครูผู้สอน)
- `class_roster` — รายชื่อนักเรียนที่ครูนำเข้าจาก Excel รอจับคู่กับบัญชี Google
- `enrollments` — นักเรียนที่ลงทะเบียนในแต่ละ course
- `course_units` / `unit_components` — หน่วยการเรียนรู้ และคะแนนเต็ม K / P / A ของแต่ละหน่วย
- `exams` — คะแนนเต็มสอบกลางภาค / ปลายภาค
- `student_scores` — คะแนนรายบุคคล (นักเรียนเห็นได้เฉพาะของตัวเอง, ครูเห็น/แก้ได้ทั้งหมด — บังคับด้วย Row Level Security)
- `grade_scales` — เกณฑ์ตัดเกรดต่อวิชา (เตรียมไว้ ยังไม่ได้ใช้ ตอนนี้ใช้เกณฑ์ใน `src/lib/grade.ts`)
- `materials` — สื่อการสอน (ลิงก์/ไฟล์) ต่อ course
- `iot_*` — ระบบติดตามอุณหภูมิ/ความชื้น (ดูหัวข้อด้านล่าง)

SQL ทั้งหมดอยู่ใน `supabase/migrations/` เรียงตามลำดับที่รันจริงบน Supabase
ชื่อไฟล์ตรงกับเลข version ในประวัติ migration ของโปรเจกต์ จึงใช้สร้างฐานข้อมูลใหม่ได้ทั้งชุด
ยกเว้นบัญชีครูคนแรก ซึ่งต้องตั้งเองหลังสมัคร (ดูใน `20260723065715_create_teacher_account.sql`)

## สิ่งที่ทำไว้แล้ว

- เข้าสู่ระบบ: ครูใช้อีเมล+รหัสผ่าน · นักเรียนใช้บัญชี Google ของโรงเรียน · ปุ่มออกจากระบบอยู่แถบบนทุกหน้า
- กู้รหัสผ่านและเปลี่ยนรหัสผ่านเองได้ (`/forgot-password`, `/dashboard/account`)
- จัดการรายวิชา ปีการศึกษา หน่วยการเรียน เกณฑ์ K-P-A ข้อสอบ และคิดเกรด
- นำเข้ารายชื่อนักเรียนจาก Excel แล้วจับคู่บัญชีให้อัตโนมัติ
- ระบบติดตามอุณหภูมิ/ความชื้นด้วย ESP32 (ดูหัวข้อถัดไป)
- Row Level Security ครบทุกตาราง

## ⚠️ ค้างไว้ — ต้องตั้งค่าก่อนนักเรียนจะใช้งานได้

ทั้งหมดเป็นการตั้งค่าในหน้าเว็บของบริการภายนอก ไม่ต้องแก้โค้ด

**1. Supabase → Site URL** (จำเป็นที่สุด — ตอนนี้ยังเป็น `localhost:3000`
ทำให้ทุกคนที่ล็อกอินถูกพากลับไปหน้าที่เปิดไม่ได้)

<https://supabase.com/dashboard/project/ypktjqtkryupmwioeojk/auth/url-configuration>

| ช่อง | ค่า |
|---|---|
| Site URL | `https://krukhayan-physics.vercel.app` |
| Redirect URLs | `https://krukhayan-physics.vercel.app/**` และ `http://localhost:3000/**` |

**2. เปิดใช้งาน Google login**

- Google Cloud Console → Credentials → OAuth client ID (Web application)
- Authorized redirect URI: `https://ypktjqtkryupmwioeojk.supabase.co/auth/v1/callback`
- OAuth consent screen: เลือก **Internal** ถ้าสร้างจากบัญชีโรงเรียน
  ถ้าโรงเรียนปิด Google Cloud ไว้ ใช้ Gmail ส่วนตัวสร้างได้ แต่ต้องเลือก **External**
  แล้วกด **Publish app** (ความปลอดภัยไม่ลดลง เพราะระบบตรวจโดเมนซ้ำฝั่งเซิร์ฟเวอร์อยู่แล้ว)
- Supabase → Authentication → Providers → Google → เปิดและวาง Client ID/Secret

**3. Vercel → environment variables** (ดู `.env.example` ประกอบ)

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `NEXT_PUBLIC_SCHOOL_EMAIL_DOMAIN` | โดเมนโรงเรียน (โค้ดตั้งค่าเริ่มต้นเป็น `urrw.ac.th` ไว้แล้ว) |
| `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` | แจ้งเตือน LINE ของระบบ IoT |
| `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` | ลิงก์ในข้อความแจ้งเตือน และ cron ตรวจอุปกรณ์ออฟไลน์ |

## เป้าหมายถัดไป

ให้นักเรียน **หนึ่งห้อง** เข้ามาดูคะแนนตัวเองได้จริงก่อน แล้วค่อยตัดสินใจเรื่องอื่นจากปัญหาที่เจอจริง

1. ตั้งค่า 3 ข้อข้างบนให้เสร็จ
2. เข้าวิชา → แท็บ "นักเรียน" → อัปโหลด Excel (ต้องมี 2 คอลัมน์: **รหัสนักเรียน**, **ชื่อ-สกุล**)
3. ให้นักเรียนลองกด "เข้าสู่ระบบด้วย Google" — ป้ายในแท็บนักเรียนจะเปลี่ยนเป็น "เข้าระบบแล้ว"
4. กรอกคะแนนจริงสัก 1–2 ชิ้นงาน แล้วให้นักเรียนลองเข้าดู

**หมายเหตุ:** ในฐานข้อมูลมีอุปกรณ์ทดสอบ "ห้องเซิร์ฟเวอร์ (ข้อมูลทดสอบ)" พร้อมข้อมูลจำลอง
อยู่ในหน้า `/dashboard/iot` ลบทิ้งได้เมื่อไม่ต้องการแล้ว

## ระบบติดตามอุณหภูมิและความชื้น (ESP32 + DHT11)

ระบบ IoT ที่ใช้ Supabase และ Vercel ชุดเดียวกับระบบคะแนน — บอร์ด ESP32 วัดค่าแล้วส่งขึ้นเว็บ
มีกราฟย้อนหลัง ตั้งเกณฑ์ และแจ้งเตือนผ่าน LINE

- เอกสารออกแบบระบบทั้งหมด: [`docs/iot/README.md`](docs/iot/README.md)
- เฟิร์มแวร์บอร์ด: [`firmware/esp32-dht11/`](firmware/esp32-dht11/)
- SQL สร้างตาราง: `supabase/migrations/20260916084652_iot_monitoring.sql`
- หน้าเว็บ: `/dashboard/iot`

ต้องตั้ง environment variables เพิ่ม (ดู `.env.example`): `LINE_CHANNEL_ACCESS_TOKEN`,
`LINE_CHANNEL_SECRET`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`

## เว็บไซต์ที่ deploy แล้ว

https://krukhayan-physics.vercel.app

## Supabase Project

- Project ref: `ypktjqtkryupmwioeojk`
- URL: https://ypktjqtkryupmwioeojk.supabase.co
