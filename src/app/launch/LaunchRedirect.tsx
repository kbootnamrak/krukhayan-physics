"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** ไปหน้าหลักทันทีที่หน้าเปิดแอปพร้อม (ยังไม่ล็อกอิน proxy จะพาไปหน้าเข้าสู่ระบบเอง) */
export default function LaunchRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}
