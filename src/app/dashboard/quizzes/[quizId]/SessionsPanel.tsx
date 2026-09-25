"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import type { QuizAttempt, QuizSession } from "@/lib/quiz";
import type { RosterEnrollment } from "./ResultsPanel";

const th = new Intl.Collator("th", { numeric: true });

/**
 * เปิด/ปิดสอบทีละห้อง — นักเรียนเริ่มทำได้เฉพาะตอนห้องตัวเองเปิดอยู่
 * คนที่เริ่มทำไปแล้วทำต่อจนหมดเวลาของตัวเองได้ แม้ครูจะปิดห้องระหว่างนั้น
 */
export default function SessionsPanel({
  quizId,
  sessions,
  enrollments,
  attempts,
  ready,
  onChanged,
}: {
  quizId: string;
  sessions: QuizSession[];
  enrollments: RosterEnrollment[];
  attempts: QuizAttempt[];
  ready: boolean;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [busyRoom, setBusyRoom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rooms = [...new Set(enrollments.map((e) => e.class_roster?.classroom).filter((r): r is string => !!r))].sort(th.compare);

  async function toggle(room: string, open: QuizSession | undefined) {
    setBusyRoom(room);
    const { error: e } = open
      ? await supabase.from("quiz_sessions").update({ closed_at: new Date().toISOString() }).eq("id", open.id)
      : await supabase.from("quiz_sessions").insert({ quiz_id: quizId, classroom: room });
    setBusyRoom(null);
    if (e) return setError(dbErrorMessage(e));
    setError(null);
    onChanged();
  }

  if (rooms.length === 0) {
    return <p className="bg-white border border-slate-200 rounded-sm p-6 text-sm text-slate-500">วิชานี้ยังไม่มีรายชื่อนักเรียนที่ระบุห้อง</p>;
  }

  return (
    <div className="space-y-3">
      {!ready && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-sm px-3 py-2">
          ยังไม่มีคำถาม — เพิ่มคำถามก่อนเปิดสอบ
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-sm px-3 py-2">
          {error}
        </p>
      )}
      <ul className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-200">
        {rooms.map((room) => {
          const open = sessions.find((s) => s.classroom === room && !s.closed_at);
          const inRoom = enrollments.filter((e) => e.class_roster?.classroom === room);
          const ids = new Set(inRoom.map((e) => e.id));
          const started = attempts.filter((a) => ids.has(a.enrollment_id));
          const done = started.filter((a) => a.submitted_at).length;
          return (
            <li key={room} className="flex flex-wrap items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-semibold text-slate-800">{room}</span>
                <span className="block text-sm text-slate-500">
                  ส่งแล้ว <span className="font-num tnum">{done}</span> · กำลังทำ <span className="font-num tnum">{started.length - done}</span> · ทั้งห้อง{" "}
                  <span className="font-num tnum">{inRoom.length}</span> คน
                </span>
              </span>
              {open ? (
                <span className="flex items-center gap-2 text-sm font-semibold text-green-700">
                  <span aria-hidden className="size-2.5 rounded-full bg-green-600 route-glow text-green-600" />
                  เปิดอยู่ ตั้งแต่ {new Date(open.opened_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                </span>
              ) : (
                <span className="text-sm text-slate-400">ปิดอยู่</span>
              )}
              <button
                type="button"
                disabled={busyRoom === room || (!open && !ready)}
                onClick={() => toggle(room, open)}
                className={`rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40 ${
                  open ? "border-2 border-red-300 text-red-700 hover:bg-red-50" : "bg-slate-800 text-white"
                }`}
              >
                {busyRoom === room ? "..." : open ? "ปิดสอบ" : "เปิดสอบ"}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-500">
        ปิดสอบแล้ว คนที่ยังไม่เริ่มจะเริ่มไม่ได้ ส่วนคนที่เริ่มแล้วทำต่อได้จนหมดเวลาของตัวเอง
      </p>
    </div>
  );
}
