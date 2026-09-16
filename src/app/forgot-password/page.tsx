"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    // ส่งกลับมาที่ /auth/callback ก่อน เพื่อให้ฝั่งเซิร์ฟเวอร์แลกโค้ดเป็น session
    // แล้วค่อยพาไปหน้าตั้งรหัสใหม่
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <h1 className="text-xl font-semibold text-slate-800">KruKhayan Physics</h1>

        {sent ? (
          <>
            <p className="text-sm text-slate-600">
              ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปที่ <strong>{email}</strong> แล้ว
            </p>
            <ul className="text-sm text-slate-500 list-disc pl-5 space-y-1">
              <li>ถ้าไม่เจอในกล่องจดหมาย ลองดูในโฟลเดอร์ Spam</li>
              <li>ลิงก์ใช้ได้ครั้งเดียวและมีอายุจำกัด ถ้าหมดอายุให้ขอใหม่ได้</li>
            </ul>
            <Link href="/login" className="block text-sm text-slate-700 hover:underline">
              ← กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-500">
              กรอกอีเมลที่ใช้เข้าสู่ระบบ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้
            </p>

            <div className="space-y-1">
              <label className="text-sm text-slate-600">อีเมล</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "กำลังส่ง..." : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
            </button>

            <Link href="/login" className="block text-sm text-slate-500 hover:underline text-center">
              ← กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
