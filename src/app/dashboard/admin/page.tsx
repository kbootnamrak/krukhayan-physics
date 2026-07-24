"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Subject = { id: string; code: string; name: string };
type Term = { id: string; academic_year: number; semester: number; is_active: boolean };
type Course = { id: string; subject_id: string; term_id: string };

export default function AdminPage() {
  const supabase = createClient();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("1");
  const [courseSubject, setCourseSubject] = useState("");
  const [courseTerm, setCourseTerm] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    setTeacherId(userData.user?.id ?? null);
    const [{ data: s }, { data: t }, { data: c }] = await Promise.all([
      supabase.from("subjects").select("id, code, name").order("code"),
      supabase.from("terms").select("id, academic_year, semester, is_active").order("academic_year", { ascending: false }),
      supabase.from("courses").select("id, subject_id, term_id"),
    ]);
    setSubjects(s ?? []);
    setTerms(t ?? []);
    setCourses(c ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const { error } = await supabase.from("subjects").insert({ code: subjectCode, name: subjectName });
    if (error) return setMsg(error.message);
    setSubjectCode("");
    setSubjectName("");
    load();
  }

  async function addTerm(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const { error } = await supabase
      .from("terms")
      .insert({ academic_year: Number(year), semester: Number(semester) });
    if (error) return setMsg(error.message);
    setYear("");
    load();
  }

  async function addCourse(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!teacherId) return;
    const { error } = await supabase.from("courses").insert({
      subject_id: courseSubject,
      term_id: courseTerm,
      teacher_id: teacherId,
    });
    if (error) return setMsg(error.message);
    load();
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-semibold text-slate-800">จัดการรายวิชา / ปีการศึกษา</h1>
        {msg && <p className="text-sm text-red-600">{msg}</p>}

        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-medium text-slate-700">เพิ่มรายวิชา</h2>
          <form onSubmit={addSubject} className="flex gap-2">
            <input value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="รหัส เช่น PHYS5" className="border border-slate-300 rounded-md px-3 py-2 text-sm w-32" required />
            <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="ชื่อวิชา เช่น ฟิสิกส์ 5" className="border border-slate-300 rounded-md px-3 py-2 text-sm flex-1" required />
            <button className="bg-slate-800 text-white rounded-md px-4 text-sm">เพิ่ม</button>
          </form>
          <ul className="text-sm text-slate-600 space-y-1">
            {subjects.map((s) => (
              <li key={s.id}>{s.code} — {s.name}</li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-medium text-slate-700">เพิ่มปีการศึกษา/เทอม</h2>
          <form onSubmit={addTerm} className="flex gap-2">
            <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="ปี พ.ศ. เช่น 2569" className="border border-slate-300 rounded-md px-3 py-2 text-sm w-40" required />
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
              <option value="1">เทอม 1</option>
              <option value="2">เทอม 2</option>
            </select>
            <button className="bg-slate-800 text-white rounded-md px-4 text-sm">เพิ่ม</button>
          </form>
          <ul className="text-sm text-slate-600 space-y-1">
            {terms.map((t) => (
              <li key={t.id}>ปีการศึกษา {t.academic_year} เทอม {t.semester}</li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-medium text-slate-700">เปิดรายวิชาในเทอม (สร้าง Course)</h2>
          <form onSubmit={addCourse} className="flex gap-2 flex-wrap">
            <select value={courseSubject} onChange={(e) => setCourseSubject(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2 text-sm" required>
              <option value="">เลือกวิชา</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select value={courseTerm} onChange={(e) => setCourseTerm(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2 text-sm" required>
              <option value="">เลือกเทอม</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>ปี {t.academic_year} เทอม {t.semester}</option>
              ))}
            </select>
            <button className="bg-slate-800 text-white rounded-md px-4 text-sm">เปิดวิชา</button>
          </form>
          <p className="text-sm text-slate-500">มีทั้งหมด {courses.length} รายวิชาที่เปิดสอน — ไปที่หน้า &quot;รายวิชาของฉัน&quot; เพื่อจัดการคะแนน</p>
        </section>
      </div>
    </div>
  );
}
