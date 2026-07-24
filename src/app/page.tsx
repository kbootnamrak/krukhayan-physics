import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-800">KruKhayan Physics</h1>
        <p className="text-slate-500">
          เว็บไซต์จัดการเรียนการสอนวิชาฟิสิกส์
        </p>
        <Link
          href="/login"
          className="inline-block bg-slate-800 text-white px-5 py-2 rounded-md text-sm"
        >
          เข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}
