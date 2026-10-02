"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import QuizText from "@/components/QuizText";
import { unitTrace } from "@/lib/traces";
import { CHOICE_LETTERS, formatNumber, type GamePayload, type GameStage } from "@/lib/game";

/** ส่วนประกอบของเกมภารกิจ: หน้าเริ่ม · สรุปผล (จอเกมและแผงโจทย์อยู่ใน GameScreen.tsx) */

export type IntroInfo = { title: string; description: string | null; stages: GameStage[]; courseId: string };

export function BackLink({ courseId, label = "กลับไปหน้ารายวิชา" }: { courseId: string; label?: string }) {
  return (
    <Link
      href={`/dashboard/courses/${courseId}`}
      className="inline-flex min-h-12 items-center justify-center rounded-sm border-2 border-porcelain px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 sm:min-h-0"
    >
      {label}
    </Link>
  );
}

const stageColor = (stage: number) => unitTrace(stage - 1);

// ---------------------------------------------------------------------------
// หน้าเริ่มภารกิจ
// ---------------------------------------------------------------------------
export function Intro({ phase, onStart, children }: { phase: IntroInfo; onStart: () => void; children?: React.ReactNode }) {
  return (
    <div className="space-y-5 rounded-sm border-2 border-porcelain bg-white p-5 sm:p-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-slate-800">{phase.title}</h1>
        {phase.description && <p className="text-slate-600">{phase.description}</p>}
      </div>

      {/* ด่านทั้งหมดเป็นจุดบนลายวงจร */}
      <ol className="space-y-0">
        {phase.stages.map((s, i) => (
          <li key={i} className="flex items-stretch gap-3">
            <span aria-hidden className="relative w-6 shrink-0">
              {i > 0 && <span className="absolute left-1/2 top-0 h-1/2 w-[3px] -translate-x-1/2 bg-slate-300" />}
              {i < phase.stages.length - 1 && <span className="absolute left-1/2 top-1/2 bottom-0 w-[3px] -translate-x-1/2 bg-slate-300" />}
              <span
                className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-porcelain route-glow"
                style={{ background: stageColor(i + 1), color: stageColor(i + 1) }}
              />
            </span>
            <span className="py-2.5">
              <span className="block font-display font-semibold text-slate-800">ด่าน {i + 1} · {s.title}</span>
              {s.intro && (
                <span className="block text-sm text-slate-500">
                  <QuizText text={s.intro} />
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>

      {children}

      <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
        <li>ตอบแล้วรู้ผลทันที พร้อมคำอธิบาย — <b className="text-slate-800">คะแนนนับเฉพาะคำตอบแรก</b></li>
        <li>เจอศัตรูต้องตอบโจทย์ — <b className="text-slate-800">แตะตัวเลือกเพื่อเล็ง แตะซ้ำอีกครั้งเพื่อยิง</b> ตอบผิดโดนโจมตีเสียหัวใจ</li>
        <li>ตอบถูกต่อเนื่องได้คอมโบ ตอบเร็วได้โบนัส XP (หัวใจและ XP ไม่ใช่คะแนนเก็บ)</li>
        <li>ปิดหน้าแล้วกลับมาเล่นต่อจากข้อที่ค้างได้ แต่เล่นซ้ำเพื่อเอาคะแนนใหม่ไม่ได้</li>
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onStart}
          className="min-h-12 rounded-sm bg-[oklch(50%_0.24_345)] px-6 py-2.5 font-display text-lg font-bold text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)]"
        >
          เริ่มภารกิจ
        </button>
        <BackLink courseId={phase.courseId} label="ยังไม่เล่นตอนนี้" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// สรุปผล
// ---------------------------------------------------------------------------
function rankOf(pct: number) {
  if (pct >= 90) return { rank: "S", note: "สุดยอด! เข้าใจครบแทบทุกเรื่อง" };
  if (pct >= 75) return { rank: "A", note: "เก่งมาก เหลืออีกนิดเดียว" };
  if (pct >= 60) return { rank: "B", note: "ผ่านภารกิจ ทบทวนข้อที่พลาดอีกครั้งนะ" };
  return { rank: "C", note: "ลองอ่านคำอธิบายข้อที่พลาดด้านล่าง แล้วถามครูได้เลย" };
}

export function Results({ data, courseId, hero }: { data: GamePayload; courseId: string; hero?: React.ReactNode }) {
  const score = Number(data.score);
  const max = Number(data.max_score);
  const pct = max ? (score / max) * 100 : 0;
  const { rank, note } = rankOf(pct);
  const right = data.items.filter((it) => data.feedback[it.id]?.ok).length;
  const [best] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem(`game:${data.play_id}`) ?? "{}") as { best?: number }).best ?? 0;
    } catch {
      return 0;
    }
  });
  const wrong = useMemo(() => data.items.filter((it) => !data.feedback[it.id]?.ok), [data]);

  return (
    <div className="space-y-5">
      <section className="stage-enter space-y-4 rounded-sm border-2 border-porcelain bg-white p-6 text-center">
        {hero}
        <h1 className="font-display text-2xl font-bold text-slate-800">ภารกิจสำเร็จ</h1>
        <p className="-mt-2 text-slate-600">{data.title}</p>
        <div className="flex items-center justify-center gap-6">
          <span
            className="grid size-20 place-items-center rounded-full border-[3px] border-trace-yellow font-display text-4xl font-bold text-trace-yellow route-glow"
            aria-label={`ระดับ ${rank}`}
          >
            {rank}
          </span>
          <p className="text-left font-num tnum">
            <span className="text-5xl font-bold text-slate-800">{score}</span>
            <span className="text-2xl text-slate-500"> / {max}</span>
            <span className="block font-sans text-sm text-slate-500">คะแนนเก็บ</span>
          </p>
        </div>
        <p className="text-slate-600">{note}</p>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-sm border border-slate-200 p-2">
            <dt className="text-xs text-slate-500">ตอบถูก</dt>
            <dd className="font-num tnum text-lg font-semibold text-slate-800">
              {right}/{data.items.length}
            </dd>
          </div>
          <div className="rounded-sm border border-slate-200 p-2">
            <dt className="text-xs text-slate-500">XP</dt>
            <dd className="font-num tnum text-lg font-semibold text-trace-cyan">{Number(data.xp).toLocaleString()}</dd>
          </div>
          <div className="rounded-sm border border-slate-200 p-2">
            <dt className="text-xs text-slate-500">คอมโบสูงสุด</dt>
            <dd className="font-num tnum text-lg font-semibold text-slate-800">{best ? `×${best}` : "–"}</dd>
          </div>
        </dl>
        <BackLink courseId={courseId} />
      </section>

      {wrong.length > 0 && (
        <section aria-label="ทบทวนข้อที่พลาด" className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-slate-800">ทบทวนข้อที่พลาด ({wrong.length} ข้อ)</h2>
          {wrong.map((it) => {
            const f = data.feedback[it.id];
            const n = data.items.indexOf(it) + 1;
            const correct =
              it.kind === "choice"
                ? f?.correct_index != null && it.choices
                  ? `${CHOICE_LETTERS[f.correct_index]}. ${it.choices[f.correct_index]}`
                  : "–"
                : f?.answer != null
                  ? `${formatNumber(Number(f.answer), it.scientific)}${it.unit ? ` ${it.unit}` : ""}`
                  : "–";
            return (
              <article key={it.id} className="space-y-2 rounded-sm border border-slate-200 bg-white p-4">
                <p className="text-sm leading-relaxed text-slate-800">
                  <span className="mr-1.5 font-display font-bold" style={{ color: stageColor(it.stage) }}>
                    ข้อ {n}
                  </span>
                  <QuizText text={it.prompt} />
                </p>
                <p className="text-sm text-slate-700">
                  คำตอบที่ถูก: <b className="text-green-700"><QuizText text={correct} /></b>
                </p>
                {f?.explanation && (
                  <p className="text-sm leading-relaxed text-slate-600">
                    <QuizText text={f.explanation} />
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
