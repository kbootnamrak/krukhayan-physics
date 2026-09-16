"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MIN_LENGTH = 6;

export default function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (password.length < MIN_LENGTH) {
      setError(`รหัสผ่านใหม่ต้องยาวอย่างน้อย ${MIN_LENGTH} ตัวอักษร`);
      return;
    }
    if (password !== confirm) {
      setError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
      return;
    }
    if (password === current) {
      setError("รหัสผ่านใหม่ซ้ำกับรหัสเดิม");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // ยืนยันตัวตนด้วยรหัสเดิมก่อน — กันกรณีลืมล็อกเอาต์แล้วมีคนอื่นมาเปลี่ยนรหัสทิ้ง
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (signInError) {
      setLoading(false);
      setError("รหัสผ่านปัจจุบันไม่ถูกต้อง");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCurrent("");
    setPassword("");
    setConfirm("");
    setDone(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm text-slate-600">รหัสผ่านปัจจุบัน</label>
        <input
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

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

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-800">เปลี่ยนรหัสผ่านเรียบร้อยแล้ว</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-slate-800 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
      </button>
    </form>
  );
}
