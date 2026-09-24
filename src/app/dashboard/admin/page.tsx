"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import Breadcrumbs from "../Breadcrumbs";

type Subject = { id: string; code: string; name: string };
type Term = { id: string; academic_year: number; semester: number };
type Course = { id: string; subject_id: string; term_id: string };

const INPUT = "border border-slate-300 rounded-md px-3 py-2 text-sm";
const BUTTON = "bg-slate-800 text-white rounded-md px-4 py-2 text-sm disabled:opacity-50";
const LINK_BUTTON = "text-sm text-slate-500 hover:text-slate-800 hover:underline";
const DANGER_BUTTON = "text-sm text-red-600 hover:text-red-800 hover:underline";

/** ปี พ.ศ. ที่สมเหตุสมผล — กันพิมพ์ ค.ศ. (2026) หรือพิมพ์ผิด (256) */
function parseYear(text: string) {
  const year = Number(text.trim());
  return Number.isInteger(year) && year >= 2500 && year <= 2700 ? year : null;
}

export default function AdminPage() {
  const supabase = createClient();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("1");
  const [courseSubject, setCourseSubject] = useState("");
  const [courseTerm, setCourseTerm] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingTerm, setEditingTerm] = useState<{ id: string; year: string; semester: string } | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    const { data: profile } = uid
      ? await supabase.from("profiles").select("role").eq("id", uid).maybeSingle()
      : { data: null };
    // หน้านี้สำหรับครูเท่านั้น (ฐานข้อมูลกันการเขียนไว้แล้ว แต่ไม่ควรให้นักเรียนเห็นหน้านี้เลย)
    setTeacherId(profile?.role === "teacher" ? uid : null);
    const [{ data: s, error: se }, { data: t, error: te }, { data: c, error: ce }] = await Promise.all([
      supabase.from("subjects").select("id, code, name").order("code"),
      supabase
        .from("terms")
        .select("id, academic_year, semester")
        .order("academic_year", { ascending: false })
        .order("semester", { ascending: false }),
      supabase.from("courses").select("id, subject_id, term_id"),
    ]);
    const firstError = se ?? te ?? ce;
    if (firstError) setMsg({ kind: "error", text: `โหลดข้อมูลไม่สำเร็จ: ${dbErrorMessage(firstError)}` });
    setSubjects(s ?? []);
    setTerms(t ?? []);
    setCourses(c ?? []);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    // เลื่อนไปทำหลัง render รอบแรก — เรียก setState ใน effect ตรง ๆ ทำให้ render ซ้อน
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function run(action: () => Promise<string | null>, success?: string) {
    setBusy(true);
    setMsg(null);
    const error = await action();
    setBusy(false);
    if (error) {
      setMsg({ kind: "error", text: error });
      return false;
    }
    if (success) setMsg({ kind: "ok", text: success });
    await load();
    return true;
  }

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const termById = new Map(terms.map((t) => [t.id, t]));
  const termLabel = (t: Term | undefined) => (t ? `ปีการศึกษา ${t.academic_year} เทอม ${t.semester}` : "—");
  const coursesOf = (key: "subject_id" | "term_id", id: string) => courses.filter((c) => c[key] === id);

  // ---------- รายวิชา ----------
  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(async () => {
      const { error } = await supabase
        .from("subjects")
        .insert({ code: subjectCode.trim(), name: subjectName.trim() });
      return error ? dbErrorMessage(error) : null;
    }, `เพิ่มวิชา ${subjectName.trim()} แล้ว`);
    if (ok) {
      setSubjectCode("");
      setSubjectName("");
    }
  }

  async function saveSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSubject) return;
    const ok = await run(async () => {
      const { error } = await supabase
        .from("subjects")
        .update({ code: editingSubject.code.trim(), name: editingSubject.name.trim() })
        .eq("id", editingSubject.id);
      return error ? dbErrorMessage(error) : null;
    }, "บันทึกแล้ว");
    if (ok) setEditingSubject(null);
  }

  async function deleteSubject(s: Subject) {
    // ลบวิชาแล้วฐานข้อมูลจะลบรายวิชาที่เปิดสอน คะแนน และรายชื่อตามไปทั้งหมด (cascade)
    // จึงไม่ยอมให้ลบถ้ายังมีรายวิชาที่เปิดสอนอยู่ ต้องลบรายวิชาที่เปิดสอนทีละตัวก่อน ซึ่งจะถามยืนยันอีกชั้น
    const used = coursesOf("subject_id", s.id).length;
    if (used > 0) {
      setMsg({ kind: "error", text: `ลบ ${s.name} ไม่ได้ เพราะเปิดสอนอยู่ ${used} เทอม — ลบในส่วน "รายวิชาที่เปิดสอน" ก่อน` });
      return;
    }
    if (!window.confirm(`ลบวิชา ${s.code} — ${s.name} ?`)) return;
    await run(async () => {
      const { error } = await supabase.from("subjects").delete().eq("id", s.id);
      return error ? dbErrorMessage(error) : null;
    }, `ลบวิชา ${s.name} แล้ว`);
  }

  // ---------- ปีการศึกษา/เทอม ----------
  async function addTerm(e: React.FormEvent) {
    e.preventDefault();
    const y = parseYear(year);
    if (y === null) {
      setMsg({ kind: "error", text: "ปีการศึกษาต้องเป็นปี พ.ศ. 4 หลัก เช่น 2569" });
      return;
    }
    const ok = await run(async () => {
      const { error } = await supabase.from("terms").insert({ academic_year: y, semester: Number(semester) });
      return error ? dbErrorMessage(error, { duplicate: `มีปีการศึกษา ${y} เทอม ${semester} อยู่แล้ว` }) : null;
    }, `เพิ่มปีการศึกษา ${y} เทอม ${semester} แล้ว`);
    if (ok) setYear("");
  }

  async function saveTerm(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTerm) return;
    const y = parseYear(editingTerm.year);
    if (y === null) {
      setMsg({ kind: "error", text: "ปีการศึกษาต้องเป็นปี พ.ศ. 4 หลัก เช่น 2569" });
      return;
    }
    const ok = await run(async () => {
      const { error } = await supabase
        .from("terms")
        .update({ academic_year: y, semester: Number(editingTerm.semester) })
        .eq("id", editingTerm.id);
      return error ? dbErrorMessage(error, { duplicate: `มีปีการศึกษา ${y} เทอม ${editingTerm.semester} อยู่แล้ว` }) : null;
    }, "บันทึกแล้ว");
    if (ok) setEditingTerm(null);
  }

  async function deleteTerm(t: Term) {
    const used = coursesOf("term_id", t.id).length;
    if (used > 0) {
      setMsg({ kind: "error", text: `ลบ${termLabel(t)} ไม่ได้ เพราะมีรายวิชาเปิดสอนอยู่ ${used} วิชา — ลบในส่วน "รายวิชาที่เปิดสอน" ก่อน` });
      return;
    }
    if (!window.confirm(`ลบ${termLabel(t)} ?`)) return;
    await run(async () => {
      const { error } = await supabase.from("terms").delete().eq("id", t.id);
      return error ? dbErrorMessage(error) : null;
    }, `ลบ${termLabel(t)} แล้ว`);
  }

  // ---------- รายวิชาที่เปิดสอน ----------
  async function addCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!teacherId) return;
    const s = subjectById.get(courseSubject);
    const t = termById.get(courseTerm);
    await run(async () => {
      const { error } = await supabase
        .from("courses")
        .insert({ subject_id: courseSubject, term_id: courseTerm, teacher_id: teacherId });
      return error ? dbErrorMessage(error, { duplicate: `${s?.name ?? "วิชานี้"} เปิดใน${termLabel(t)} อยู่แล้ว` }) : null;
    }, `เปิดวิชา ${s?.name ?? ""} ใน${termLabel(t)} แล้ว`);
  }

  async function deleteCourse(c: Course) {
    const s = subjectById.get(c.subject_id);
    const label = `${s?.name ?? "วิชา"} ${termLabel(termById.get(c.term_id))}`;

    setBusy(true);
    const { data: enrolled } = await supabase.from("enrollments").select("id").eq("course_id", c.id);
    const enrollIds = (enrolled ?? []).map((e) => e.id);
    const { count: scoreCount } = enrollIds.length
      ? await supabase
          .from("student_scores")
          .select("id", { count: "exact", head: true })
          .in("enrollment_id", enrollIds)
          .not("score", "is", null)
      : { count: 0 };
    setBusy(false);

    // วิชาที่มีคะแนนแล้ว ต้องพิมพ์รหัสวิชายืนยัน — ลบแล้วกู้คืนไม่ได้
    if (scoreCount && scoreCount > 0) {
      const typed = window.prompt(
        `ลบ ${label}\n\nจะลบทั้งหมดต่อไปนี้ และกู้คืนไม่ได้:\n• นักเรียน ${enrollIds.length} คน\n• คะแนนที่กรอกแล้ว ${scoreCount} ช่อง\n• หน่วยการเรียนรู้ สื่อการสอน และรายชื่อที่นำเข้า\n\nพิมพ์รหัสวิชา "${s?.code}" เพื่อยืนยัน`
      );
      if (typed === null) return;
      if (typed.trim() !== s?.code) {
        setMsg({ kind: "error", text: "รหัสวิชาไม่ตรง ยังไม่ได้ลบ" });
        return;
      }
    } else if (
      !window.confirm(
        `ลบ ${label} ?\n\nหน่วยการเรียนรู้ สื่อการสอน และรายชื่อนักเรียน${enrollIds.length ? ` (${enrollIds.length} คน)` : ""}จะถูกลบไปด้วย`
      )
    ) {
      return;
    }

    await run(async () => {
      const { error } = await supabase.from("courses").delete().eq("id", c.id);
      return error ? dbErrorMessage(error) : null;
    }, `ลบ ${label} แล้ว`);
  }

  if (loaded && !teacherId) {
    return (
      <div className="px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-4">
          <Breadcrumbs items={[{ label: "หน้าหลัก", href: "/dashboard" }, { label: "จัดการรายวิชา" }]} />
          <p className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">หน้านี้สำหรับครูเท่านั้น</p>
        </div>
      </div>
    );
  }

  const sortedCourses = [...courses].sort((a, b) => {
    const ta = termById.get(a.term_id);
    const tb = termById.get(b.term_id);
    return (
      (tb?.academic_year ?? 0) - (ta?.academic_year ?? 0) ||
      (tb?.semester ?? 0) - (ta?.semester ?? 0) ||
      (subjectById.get(a.subject_id)?.code ?? "").localeCompare(subjectById.get(b.subject_id)?.code ?? "")
    );
  });

  return (
    <div className="px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <Breadcrumbs items={[{ label: "หน้าหลัก", href: "/dashboard" }, { label: "จัดการรายวิชา / ปีการศึกษา" }]} />
          <h1 className="text-2xl font-semibold text-slate-800">จัดการรายวิชา / ปีการศึกษา</h1>
        </div>

        {msg && (
          <p
            role={msg.kind === "error" ? "alert" : "status"}
            className={`text-sm rounded-md px-3 py-2 border ${
              msg.kind === "error" ? "bg-red-50 border-red-300 text-red-800" : "bg-green-50 border-green-300 text-green-800"
            }`}
          >
            {msg.text}
          </p>
        )}

        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-medium text-slate-700">รายวิชา</h2>
          <form onSubmit={addSubject} className="flex gap-2 flex-wrap">
            <input value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="รหัส เช่น ว30205" className={`${INPUT} w-36`} required />
            <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="ชื่อวิชา เช่น ฟิสิกส์ 5" className={`${INPUT} flex-1 min-w-[180px]`} required />
            <button disabled={busy} className={BUTTON}>เพิ่ม</button>
          </form>
          <ul className="divide-y divide-slate-100 text-sm">
            {subjects.map((s) =>
              editingSubject?.id === s.id ? (
                <li key={s.id} className="py-2">
                  <form onSubmit={saveSubject} className="flex gap-2 flex-wrap items-center">
                    <input value={editingSubject.code} onChange={(e) => setEditingSubject({ ...editingSubject, code: e.target.value })} className={`${INPUT} w-36`} required aria-label="รหัสวิชา" />
                    <input value={editingSubject.name} onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })} className={`${INPUT} flex-1 min-w-[180px]`} required aria-label="ชื่อวิชา" />
                    <button disabled={busy} className={BUTTON}>บันทึก</button>
                    <button type="button" onClick={() => setEditingSubject(null)} className={LINK_BUTTON}>ยกเลิก</button>
                  </form>
                </li>
              ) : (
                <li key={s.id} className="py-2 flex items-center justify-between gap-3">
                  <span className="text-slate-700">
                    <span className="text-slate-400">{s.code}</span> {s.name}
                  </span>
                  <span className="flex gap-3 shrink-0">
                    <button onClick={() => setEditingSubject(s)} className={LINK_BUTTON}>แก้ไข</button>
                    <button onClick={() => deleteSubject(s)} disabled={busy} className={DANGER_BUTTON}>ลบ</button>
                  </span>
                </li>
              )
            )}
            {loaded && subjects.length === 0 && <li className="py-2 text-slate-400">ยังไม่มีรายวิชา</li>}
          </ul>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-medium text-slate-700">ปีการศึกษา / เทอม</h2>
          <form onSubmit={addTerm} className="flex gap-2 flex-wrap">
            <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" placeholder="ปี พ.ศ. เช่น 2569" className={`${INPUT} w-40`} required />
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className={INPUT}>
              <option value="1">เทอม 1</option>
              <option value="2">เทอม 2</option>
            </select>
            <button disabled={busy} className={BUTTON}>เพิ่ม</button>
          </form>
          <ul className="divide-y divide-slate-100 text-sm">
            {terms.map((t) =>
              editingTerm?.id === t.id ? (
                <li key={t.id} className="py-2">
                  <form onSubmit={saveTerm} className="flex gap-2 flex-wrap items-center">
                    <input value={editingTerm.year} onChange={(e) => setEditingTerm({ ...editingTerm, year: e.target.value })} inputMode="numeric" className={`${INPUT} w-32`} required aria-label="ปีการศึกษา" />
                    <select value={editingTerm.semester} onChange={(e) => setEditingTerm({ ...editingTerm, semester: e.target.value })} className={INPUT} aria-label="เทอม">
                      <option value="1">เทอม 1</option>
                      <option value="2">เทอม 2</option>
                    </select>
                    <button disabled={busy} className={BUTTON}>บันทึก</button>
                    <button type="button" onClick={() => setEditingTerm(null)} className={LINK_BUTTON}>ยกเลิก</button>
                  </form>
                </li>
              ) : (
                <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                  <span className="text-slate-700">{termLabel(t)}</span>
                  <span className="flex gap-3 shrink-0">
                    <button
                      onClick={() => setEditingTerm({ id: t.id, year: String(t.academic_year), semester: String(t.semester) })}
                      className={LINK_BUTTON}
                    >
                      แก้ไข
                    </button>
                    <button onClick={() => deleteTerm(t)} disabled={busy} className={DANGER_BUTTON}>ลบ</button>
                  </span>
                </li>
              )
            )}
            {loaded && terms.length === 0 && <li className="py-2 text-slate-400">ยังไม่มีปีการศึกษา</li>}
          </ul>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-medium text-slate-700">รายวิชาที่เปิดสอน</h2>
          <form onSubmit={addCourse} className="flex gap-2 flex-wrap">
            <select value={courseSubject} onChange={(e) => setCourseSubject(e.target.value)} className={INPUT} required>
              <option value="">เลือกวิชา</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.code} {s.name}</option>
              ))}
            </select>
            <select value={courseTerm} onChange={(e) => setCourseTerm(e.target.value)} className={INPUT} required>
              <option value="">เลือกเทอม</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>ปี {t.academic_year} เทอม {t.semester}</option>
              ))}
            </select>
            <button disabled={busy} className={BUTTON}>เปิดวิชา</button>
          </form>
          <ul className="divide-y divide-slate-100 text-sm">
            {sortedCourses.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-slate-700">
                  {subjectById.get(c.subject_id)?.name ?? "—"}{" "}
                  <span className="text-slate-400">{termLabel(termById.get(c.term_id))}</span>
                </span>
                <span className="flex gap-3 shrink-0">
                  <Link href={`/dashboard/courses/${c.id}`} className={LINK_BUTTON}>จัดการ →</Link>
                  <button onClick={() => deleteCourse(c)} disabled={busy} className={DANGER_BUTTON}>ลบ</button>
                </span>
              </li>
            ))}
            {loaded && courses.length === 0 && <li className="py-2 text-slate-400">ยังไม่มีรายวิชาที่เปิดสอน</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
