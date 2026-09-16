"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * เมื่อลิงก์ในอีเมล (กู้รหัสผ่าน / ยืนยันอีเมล) ใช้ไม่ได้ Supabase จะพากลับมาที่ Site URL
 * พร้อมแนบสาเหตุไว้หลังเครื่องหมาย # เช่น
 *   /#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid
 *
 * ส่วนหลัง # ไม่ถูกส่งไปถึงเซิร์ฟเวอร์ จึงต้องอ่านฝั่งเบราว์เซอร์
 * ถ้าไม่มีตัวนี้ ผู้ใช้จะเห็นแค่หน้าเปล่า ๆ โดยไม่รู้ว่าเกิดอะไรขึ้น
 */
export default function AuthHashNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;

      const params = new URLSearchParams(hash);
      const code = params.get("error_code");
      if (!code) return;

      setMessage(
        code === "otp_expired"
          ? "ลิงก์ในอีเมลหมดอายุหรือถูกใช้ไปแล้ว"
          : params.get("error_description") ?? "ลิงก์ในอีเมลใช้ไม่ได้"
      );

      // ล้าง # ทิ้งเพื่อไม่ให้ข้อความค้างอยู่เมื่อผู้ใช้กดรีเฟรช
      history.replaceState(null, "", window.location.pathname + window.location.search);
    };

    const timer = setTimeout(read, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!message) return null;

  return (
    <div className="w-full max-w-sm mx-auto bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm space-y-2">
      <p className="text-amber-900">{message}</p>
      <Link href="/forgot-password" className="text-amber-900 underline underline-offset-2">
        ขอลิงก์ตั้งรหัสผ่านใหม่ →
      </Link>
    </div>
  );
}
