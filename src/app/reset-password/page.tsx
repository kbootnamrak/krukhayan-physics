"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-error";

const MIN_LENGTH = 6;

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_LENGTH) {
      setError(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_LENGTH} ตัวอักษร`);
      return;
    }
    if (password !== confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      // ไม่มี session แปลว่าเข้ามาหน้านี้โดยไม่ได้ผ่านลิงก์ในอีเมล หรือลิงก์หมดอายุไปแล้ว
      setError(authErrorMessage(error));
      return;
    }

    setDone(true);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <h1 className="text-xl font-semibold text-slate-800">ตั้งรหัสผ่านใหม่</h1>

        {done ? (
          <>
            <p className="text-sm text-green-800">เปลี่ยนรหัสผ่านเรียบร้อยแล้ว</p>
            <Link
              href="/dashboard"
              className="block w-full bg-slate-800 text-white rounded-md py-2 text-sm font-medium text-center"
            >
              เข้าสู่หน้าหลัก
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-600">รหัสผ่านใหม่</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-400">อย่างน้อย {MIN_LENGTH} ตัวอักษร</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-600">ยืนยันรหัสผ่านใหม่</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>

            {error && (
              <div className="space-y-1">
                <p className="text-sm text-red-600">{error}</p>
                <Link href="/forgot-password" className="text-sm text-slate-700 hover:underline">
                  ขอลิงก์ใหม่ →
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
