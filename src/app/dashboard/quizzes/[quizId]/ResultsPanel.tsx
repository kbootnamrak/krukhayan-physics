"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import { downloadBlob } from "@/lib/download";
import { compareRoster } from "@/lib/students/order";
import { describeDevice, type DeviceEvent } from "@/lib/device";
import { SUBMIT_REASON_TEXT, type Quiz, type QuizAttempt } from "@/lib/quiz";

/** เวลารวมที่ออกไปจากหน้าข้อสอบ (วินาที) */
function awaySeconds(a: QuizAttempt) {
  return (a.leave_log ?? []).reduce((s, x) => s + (x.away ?? 0), 0);
}

/** รายละเอียดแต่ละครั้งที่ออก — แสดงเมื่อชี้ที่ตัวเลข */
function leaveTitle(a: QuizAttempt) {
  return (a.leave_log ?? [])
    .map((x, i) => {
      const t = new Date(x.at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      return `${i + 1}) ${t} น. ${x.kind === "reopen" ? "เปิดหน้าข้อสอบใหม่" : `ออกไป ${x.away} วินาที`}`;
    })
    .join("\n");
}

export type RosterEnrollment = {
  id: string;
  student_id: string | null;
  class_roster: { full_name: string; student_code: string; classroom: string | null; class_number: number | null } | null;
};

const th = new Intl.Collator("th", { numeric: true });

/**
 * ผลสอบรายคน กรองตามห้องได้ · ตรวจใหม่ (หลังแก้เฉลย/เก็บคนที่หมดเวลาแต่ไม่ได้กดส่ง)
 * · ให้ทำใหม่ (ลบการทำของคนนั้น) · ดาวน์โหลด Excel
 * คะแนนยังไม่เข้าช่อง K — ครูดูผลดิบแล้วค่อยตัดสินใจ
 */
export default function ResultsPanel({
  quiz,
  enrollments,
  attempts,
  devices,
  loadedAt,
  onChanged,
}: {
  quiz: Quiz;
  enrollments: RosterEnrollment[];
  attempts: QuizAttempt[];
  /** เครื่องที่ใช้เริ่มทำชุดนี้ (บันทึกตอนเริ่ม/ทำต่อ) */
  devices: DeviceEvent[];
  /** เวลาตอนโหลดข้อมูล — ใช้ตัดสินว่าการทำไหนหมดเวลาแล้ว */
  loadedAt: number;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rooms = [...new Set(enrollments.map((e) => e.class_roster?.classroom).filter((r): r is string => !!r))].sort(th.compare);
  const now = loadedAt;

  // เครื่องที่นักเรียนแต่ละคนใช้ทำชุดนี้ และเครื่องที่ถูกใช้ทำหลายบัญชี
  const nameOfUser = new Map(enrollments.filter((e) => e.student_id).map((e) => [e.student_id as string, e.class_roster?.full_name ?? "(ไม่มีชื่อ)"]));
  const usersOfDevice = new Map<string, Set<string>>();
  for (const d of devices) {
    if (!usersOfDevice.has(d.device_id)) usersOfDevice.set(d.device_id, new Set());
    usersOfDevice.get(d.device_id)!.add(d.user_id);
  }
  function deviceInfo(studentId: string | null) {
    if (!studentId) return null;
    const mine = devices.filter((d) => d.user_id === studentId);
    if (!mine.length) return null;
    const others = new Set<string>();
    for (const d of mine) usersOfDevice.get(d.device_id)?.forEach((u) => u !== studentId && others.add(u));
    return {
      label: [...new Set(mine.map((d) => describeDevice(d.user_agent, d.device_model)))].join(", "),
      sharedWith: [...others].map((u) => nameOfUser.get(u) ?? "บัญชีอื่น"),
    };
  }
  const sharedCount = [...usersOfDevice.values()].filter((u) => u.size > 1).length;

  const rows = enrollments
    .map((e) => ({
      id: e.id,
      full_name: e.class_roster?.full_name ?? "(ไม่มีชื่อ)",
      student_code: e.class_roster?.student_code ?? null,
      student_id: e.student_id,
      classroom: e.class_roster?.classroom ?? null,
      class_number: e.class_roster?.class_number ?? null,
      attempt: attempts.find((a) => a.enrollment_id === e.id) ?? null,
    }))
    .filter((r) => !room || r.classroom === room)
    .sort(compareRoster);

  const submitted = rows.filter((r) => r.attempt?.submitted_at);
  const scores = submitted.map((r) => r.attempt!.score ?? 0);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const expiredUnsent = attempts.filter((a) => !a.submitted_at && new Date(a.deadline_at).getTime() < now).length;

  function statusOf(a: QuizAttempt | null) {
    if (!a) return { text: "ยังไม่ทำ", cls: "text-slate-400" };
    if (a.submitted_at && a.submit_reason === "left_page") return { text: SUBMIT_REASON_TEXT.left_page, cls: "text-red-700" };
    if (a.submitted_at && a.submit_reason === "time_up") return { text: "ส่งแล้ว (หมดเวลา)", cls: "text-green-700" };
    if (a.submitted_at) return { text: "ส่งแล้ว", cls: "text-green-700" };
    if (new Date(a.deadline_at).getTime() < now) return { text: "หมดเวลา (รอตรวจ)", cls: "text-amber-700" };
    return { text: "กำลังทำ", cls: "text-trace-cyan" };
  }

  async function setReleased(next: boolean) {
    const msg = next
      ? "ประกาศคะแนนให้นักเรียนเห็นเลยไหม?\nนักเรียนที่ส่งแล้วจะเห็นคะแนนของตัวเองทันที (ไม่เห็นเฉลย)"
      : "ซ่อนคะแนนจากนักเรียนอีกครั้งไหม?";
    if (!window.confirm(msg)) return;
    setBusy(true);
    const { error: e } = await supabase.from("quizzes").update({ scores_released: next }).eq("id", quiz.id);
    setBusy(false);
    if (e) return setError(dbErrorMessage(e));
    setError(null);
    setNotice(next ? "ประกาศคะแนนแล้ว นักเรียนเห็นคะแนนของตัวเองแล้ว" : "ซ่อนคะแนนแล้ว");
    onChanged();
  }

  async function regrade() {
    setBusy(true);
    const { data, error: e } = await supabase.rpc("quiz_regrade", { p_quiz: quiz.id });
    setBusy(false);
    if (e) return setError(dbErrorMessage(e));
    setError(null);
    setNotice(`ตรวจใหม่แล้ว ${data ?? 0} คน`);
    onChanged();
  }

  async function reset(enrollmentId: string, name: string) {
    if (!window.confirm(`ให้ ${name} ทำแบบทดสอบนี้ใหม่?\nคำตอบและคะแนนเดิมจะถูกลบ`)) return;
    setBusy(true);
    const { error: e } = await supabase.from("quiz_attempts").delete().eq("quiz_id", quiz.id).eq("enrollment_id", enrollmentId);
    setBusy(false);
    if (e) return setError(dbErrorMessage(e));
    setError(null);
    onChanged();
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const header = [
      "ห้อง",
      "เลขที่",
      "รหัสนักเรียน",
      "ชื่อ-สกุล",
      `คะแนน (เต็ม ${rows.find((r) => r.attempt)?.attempt?.max_score ?? ""})`,
      "สถานะ",
      "ออกจากหน้า (ครั้ง)",
      "เวลาที่ออกไปรวม (วินาที)",
    ];
    const body = rows.map((r) => [
      r.classroom ?? "",
      r.class_number ?? "",
      r.student_code ?? "",
      r.full_name,
      r.attempt?.submitted_at ? (r.attempt.score ?? "") : "",
      statusOf(r.attempt).text,
      r.attempt ? r.attempt.leave_count : "",
      r.attempt ? awaySeconds(r.attempt) : "",
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "ผลสอบ");
    const data = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    downloadBlob(
      new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${quiz.title}${room ? ` ${room.replace("/", "-")}` : ""}.xlsx`
    );
  }

  return (
    <div className="space-y-3">
      {/* ประกาศคะแนน: ครูตรวจก่อนแล้วค่อยให้นักเรียนเห็น */}
      <div
        className={`flex flex-wrap items-center gap-3 rounded-sm border-2 px-4 py-3 ${
          quiz.scores_released ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"
        }`}
      >
        <p className={`min-w-0 flex-1 text-sm ${quiz.scores_released ? "text-green-800" : "text-amber-900"}`}>
          {quiz.scores_released
            ? "ประกาศคะแนนแล้ว — นักเรียนเห็นคะแนนของตัวเอง (ไม่เห็นเฉลย)"
            : "ยังไม่ประกาศคะแนน — นักเรียนเห็นแค่ว่าส่งแล้ว ตรวจผลให้เรียบร้อยก่อนแล้วค่อยประกาศ"}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => setReleased(!quiz.scores_released)}
          className={`rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
            quiz.scores_released ? "border-2 border-slate-300 text-slate-700 hover:bg-slate-100" : "bg-slate-800 text-white"
          }`}
        >
          {quiz.scores_released ? "ซ่อนคะแนน" : "ประกาศคะแนน"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {rooms.length > 1 && (
          <div role="group" aria-label="เลือกห้อง" className="flex flex-wrap gap-1">
            {["", ...rooms].map((r) => (
              <button
                key={r || "all"}
                type="button"
                aria-pressed={room === r}
                onClick={() => setRoom(r)}
                className={`rounded-sm border-2 px-3 py-1.5 text-sm font-display font-semibold ${
                  room === r ? "border-porcelain bg-porcelain text-[var(--c-slate-50)]" : "border-slate-300 text-slate-600 hover:border-slate-400"
                }`}
              >
                {r || "ทุกห้อง"}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={regrade}
            disabled={busy}
            title="ใช้หลังแก้เฉลย หรือเมื่อมีคนหมดเวลาแต่ยังไม่ได้กดส่ง"
            className="text-sm border border-slate-300 rounded-sm px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            ตรวจใหม่{expiredUnsent ? ` (${expiredUnsent} คนรอตรวจ)` : ""}
          </button>
          <button type="button" onClick={exportExcel} className="text-sm border border-slate-300 rounded-sm px-3 py-1.5 text-slate-700 hover:bg-slate-100">
            ดาวน์โหลด Excel{room ? ` (${room})` : ""}
          </button>
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-sm px-3 py-2">
          {error}
        </p>
      )}
      {notice && <p className="text-sm text-green-700" aria-live="polite">{notice}</p>}

      {sharedCount > 0 && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-sm px-3 py-2">
          มี {sharedCount} เครื่องที่ถูกใช้ทำแบบทดสอบนี้มากกว่า 1 บัญชี — ดูคอลัมน์ &quot;เครื่องที่ใช้ทำ&quot; (อาจเป็นการทำแทนกัน ควรสอบถามก่อนสรุป)
        </p>
      )}

      <p className="text-sm text-slate-600">
        ส่งแล้ว <span className="font-num tnum font-semibold text-slate-800">{submitted.length}</span> จาก{" "}
        <span className="font-num tnum">{rows.length}</span> คน
        {avg !== null && (
          <>
            {" "}
            · เฉลี่ย <span className="font-num tnum font-semibold text-slate-800">{avg.toFixed(2)}</span> · สูงสุด{" "}
            <span className="font-num tnum">{Math.max(...scores)}</span> · ต่ำสุด <span className="font-num tnum">{Math.min(...scores)}</span>
          </>
        )}
      </p>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="p-2 font-medium">นักเรียน</th>
              <th className="p-2 font-medium">สถานะ</th>
              <th className="p-2 font-medium">เครื่องที่ใช้ทำ</th>
              <th className="p-2 font-medium text-right" title="จำนวนครั้งที่ออกจากหน้าข้อสอบระหว่างทำ (สลับแอป/แท็บ/รีเฟรช)">
                ออกจากหน้า
              </th>
              <th className="p-2 font-medium text-right">คะแนน</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = statusOf(r.attempt);
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-2">
                    <span className="text-slate-800">{r.full_name}</span>
                    <span className="block text-xs text-slate-400">
                      {[r.classroom, r.class_number != null ? `เลขที่ ${r.class_number}` : null, r.student_code].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className={`p-2 ${st.cls}`}>{st.text}</td>
                  <td className="p-2 text-xs">
                    {(() => {
                      const info = r.attempt ? deviceInfo(r.student_id) : null;
                      if (!info) return <span className="text-slate-400">–</span>;
                      return (
                        <>
                          <span className="text-slate-600">{info.label}</span>
                          {info.sharedWith.length > 0 && (
                            <span className="block font-semibold text-amber-700">เครื่องเดียวกับ: {info.sharedWith.join(", ")}</span>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td
                    className={`p-2 text-right font-num tnum ${r.attempt && r.attempt.leave_count > 0 ? "text-amber-700 font-semibold" : "text-slate-400"}`}
                    title={r.attempt?.leave_log?.length ? leaveTitle(r.attempt) : undefined}
                  >
                    {r.attempt ? r.attempt.leave_count : "–"}
                  </td>
                  <td className="p-2 text-right font-num tnum whitespace-nowrap">
                    {r.attempt?.submitted_at ? (
                      <>
                        <span className="text-lg font-semibold text-slate-800">{r.attempt.score ?? "–"}</span>
                        <span className="text-slate-500"> / {r.attempt.max_score}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">–</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {r.attempt && (
                      <button type="button" disabled={busy} onClick={() => reset(r.id, r.full_name)} className="text-xs text-slate-500 hover:text-red-700 hover:underline">
                        ให้ทำใหม่
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
