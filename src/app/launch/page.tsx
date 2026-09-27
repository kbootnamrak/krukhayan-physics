import LaunchRedirect from "./LaunchRedirect";

/**
 * จุดเปิดแอปจากไอคอนบนหน้าจอหลัก (start_url ใน manifest)
 *
 * หน้านี้สร้างไว้ล่วงหน้า (static) ส่งจาก CDN ได้ทันทีโดยไม่ต้องรอเซิร์ฟเวอร์/ฐานข้อมูล
 * มือถือจึงเปลี่ยนจากไอคอนนิ่งมาเป็นอะตอมที่อิเล็กตรอนวิ่ง (AppSplash) แทบทันที
 * แล้วค่อยไปหน้าหลักเบื้องหลัง — เดิมเปิดที่ /dashboard ต้องรอตรวจล็อกอินก่อน จอจึงค้างภาพนิ่งนาน
 */
export default function LaunchPage() {
  return <LaunchRedirect />;
}
