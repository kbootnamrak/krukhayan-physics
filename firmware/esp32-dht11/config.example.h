#pragma once

// คัดลอกไฟล์นี้เป็น config.h แล้วแก้ค่าให้ตรงกับของจริง
// config.h ถูก .gitignore ไว้ จะไม่ถูก commit ขึ้น repo

// ---------- Wi-Fi ----------
#define WIFI_SSID      "ชื่อ Wi-Fi ของโรงเรียน"
#define WIFI_PASSWORD  "รหัสผ่าน Wi-Fi"

// ---------- เซิร์ฟเวอร์ ----------
#define INGEST_URL     "https://krukhayan-physics.vercel.app/api/iot/ingest"

// device key ที่ได้ตอนกดเพิ่มอุปกรณ์ในหน้าเว็บ (แสดงครั้งเดียว)
#define DEVICE_KEY     "kkp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

// ---------- เซนเซอร์ ----------
#define DHT_PIN        4       // ขา DATA ของ DHT11
#define DHT_TYPE       DHT11   // เปลี่ยนเป็น DHT22 ได้ถ้าเปลี่ยนเซนเซอร์
#define STATUS_LED_PIN 2       // LED บนบอร์ด ESP32 DevKit ส่วนใหญ่อยู่ที่ GPIO2

// ---------- จังหวะการทำงาน ----------
#define SAMPLE_INTERVAL_S 60   // อ่านและส่งทุกกี่วินาที (เซิร์ฟเวอร์ปรับค่านี้ได้ภายหลัง)
#define BUFFER_SIZE       60   // เก็บค่าไว้ได้กี่ชุดตอนเน็ตหลุด (60 ชุด x 60 วิ = 1 ชั่วโมง)

// ---------- TLS ----------
// ใบรับรองรากของเซิร์ฟเวอร์ ดึงมาด้วยคำสั่ง (ดู README):
//   openssl s_client -showcerts -connect krukhayan-physics.vercel.app:443 </dev/null
// วางใบสุดท้าย (root CA) ลงตรงนี้ ถ้าเว้นว่างไว้ บอร์ดจะเชื่อมต่อแบบไม่ตรวจใบรับรอง
// ซึ่งเสี่ยงต่อการถูกดักกลางทาง — ใช้ได้เฉพาะตอนทดสอบเท่านั้น
#define ROOT_CA_PEM ""
