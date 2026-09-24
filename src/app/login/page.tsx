"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/school";
import { authErrorMessage } from "@/lib/auth-error";
import AuthHashNotice from "@/app/AuthHashNotice";

const AUTH_ERRORS: Record<string, string> = {
  link_invalid: "ลิงก์ในอีเมลหมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่",
  otp_expired: "ลิงก์ในอีเมลหมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่",
  missing_code: "ลิงก์ไม่สมบูรณ์ กรุณาขอลิงก์ใหม่",
  access_denied: "ลิงก์ในอีเมลใช้ไม่ได้ กรุณาขอลิงก์ใหม่",
  not_school_email: `ต้องเข้าสู่ระบบด้วยบัญชี Google ของโรงเรียน (@${SCHOOL_EMAIL_DOMAIN}) เท่านั้น`,
};

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const authError = useSearchParams().get("auth_error");
  const linkError = authError
    ? AUTH_ERRORS[authError] ?? "ลิงก์ในอีเมลใช้ไม่ได้ กรุณาขอลิงก์ใหม่"
    : null;

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // hd = บอก Google ให้เสนอเฉพาะบัญชีในโดเมนโรงเรียน
        // เป็นเพียงคำใบ้ฝั่งหน้าจอ ด่านจริงอยู่ที่ /auth/callback ฝั่งเซิร์ฟเวอร์
        queryParams: { hd: SCHOOL_EMAIL_DOMAIN, prompt: "select_account" },
      },
    });
    if (error) {
      setLoading(false);
      setError(authErrorMessage(error));
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleLogin}
      className="w-full max-w-sm bg-white p-8 rounded-xl shadow-sm border border-slate-200 space-y-4"
    >
      <h1 className="text-xl font-semibold text-slate-800">KruKhayan Physics</h1>
      <p className="text-sm text-slate-500">เข้าสู่ระบบ</p>

      {linkError && (
        <div className="bg-amber-50 border border-amber-300 rounded-md p-3 space-y-1">
          <p className="text-sm text-amber-900">{linkError}</p>
          <Link href="/forgot-password" className="text-sm text-amber-900 underline underline-offset-2">
            ขอลิงก์ใหม่ →
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 border border-slate-300 rounded-md py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
          <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.3z" />
          <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.2 15.5 46 24 46z" />
          <path fill="#FBBC05" d="M11.8 28.3c-.4-1.3-.7-2.7-.7-4.3s.3-3 .7-4.3v-5.7H4.5A22 22 0 0 0 2 24c0 3.6.9 6.9 2.5 9.9l7.3-5.6z" />
          <path fill="#EA4335" d="M24 10.6c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.5 2 8.1 6.8 4.5 13.9l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
        </svg>
        เข้าสู่ระบบด้วย Google ของโรงเรียน
      </button>

      <p className="text-xs text-slate-400 text-center">
        นักเรียนใช้บัญชี @{SCHOOL_EMAIL_DOMAIN} ของโรงเรียน
      </p>

      <div className="flex items-center gap-3 pt-1">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">หรือเข้าด้วยอีเมล (สำหรับครู)</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

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

      <div className="space-y-1">
        <label className="text-sm text-slate-600">รหัสผ่าน</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-slate-800 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>

      <Link
        href="/forgot-password"
        className="block text-sm text-slate-500 hover:text-slate-800 hover:underline text-center"
      >
        ลืมรหัสผ่าน?
      </Link>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-4">
      <AuthHashNotice />
      {/* useSearchParams ต้องอยู่ใต้ Suspense ไม่งั้นทั้งหน้าจะกลายเป็น dynamic */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
