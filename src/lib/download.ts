/**
 * ให้เบราว์เซอร์ดาวน์โหลดไฟล์ที่สร้างขึ้นในหน้าเว็บ พร้อมชื่อไฟล์ที่ตั้งไว้
 * ใช้ร่วมกันทั้งไฟล์ Excel คะแนนและไฟล์ CSV ของระบบ IoT
 *
 * - ใส่ลิงก์เข้าไปในหน้าก่อนกด เพราะ Firefox รุ่นเก่าไม่ยอมกดลิงก์ที่ไม่ได้อยู่ในหน้า
 * - รอสักพักก่อนเพิกถอน URL เผื่อเบราว์เซอร์ที่เริ่มดาวน์โหลดหลังจาก click คืนค่าไปแล้ว
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  // ตัดอักขระที่ Windows ไม่รับในชื่อไฟล์
  link.download = filename.replace(/[\\/:*?"<>|]/g, "-");
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
