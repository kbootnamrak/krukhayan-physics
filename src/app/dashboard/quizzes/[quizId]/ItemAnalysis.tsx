"use client";

import QuizText from "@/components/QuizText";
import { CHOICE_LABELS, type QuizAttempt, type QuizQuestion } from "@/lib/quiz";

export type ItemStat = {
  question: QuizQuestion;
  n: number;
  /** จำนวนคนที่เลือกแต่ละตัวเลือก (ตามลำดับตัวเลือกเดิม ไม่ใช่ลำดับที่สลับให้นักเรียน) */
  counts: number[];
  blank: number;
  correct: number | null;
  correctCount: number;
  /** ตัวเลือกผิดที่คนเลือกมากกว่าเฉลย — อาจเป็นจุดที่เข้าใจผิดกันเยอะ หรือเฉลยผิด */
  trap: number | null;
};

/** สรุปรายข้อจากการทำที่ส่งแล้ว */
export function itemStats(questions: QuizQuestion[], keys: Record<string, number>, attempts: QuizAttempt[]): ItemStat[] {
  return questions.map((q) => {
    const counts = q.choices.map(() => 0);
    let blank = 0;
    for (const a of attempts) {
      const ans = a.answers?.[q.id];
      if (ans === undefined || ans === null || counts[ans] === undefined) blank++;
      else counts[ans]++;
    }
    const correct = keys[q.id] ?? null;
    const correctCount = correct === null ? 0 : counts[correct];
    let trap: number | null = null;
    counts.forEach((c, i) => {
      if (i !== correct && c > correctCount && (trap === null || c > counts[trap])) trap = i;
    });
    return { question: q, n: attempts.length, counts, blank, correct, correctCount, trap };
  });
}

const pct = (x: number, n: number) => (n ? Math.round((x / n) * 100) : 0);

/**
 * วิเคราะห์รายข้อ: แต่ละข้อถูกกี่ % และแต่ละตัวเลือกมีคนเลือกเท่าไร
 * ช่วยครูเห็นข้อที่ยากเกิน ข้อที่นักเรียนเข้าใจผิดเหมือน ๆ กัน และข้อที่เฉลยอาจผิด
 */
export default function ItemAnalysis({ stats }: { stats: ItemStat[] }) {
  if (!stats.length || !stats[0].n) {
    return <p className="rounded-sm border border-slate-200 bg-white p-6 text-sm text-slate-500">ยังไม่มีคนส่ง — วิเคราะห์รายข้อได้เมื่อมีคนส่งแล้ว</p>;
  }
  const hard = stats.filter((s) => s.correct !== null && pct(s.correctCount, s.n) < 40).length;
  const traps = stats.filter((s) => s.trap !== null).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        จากคนที่ส่งแล้ว <span className="font-num tnum font-semibold text-slate-800">{stats[0].n}</span> คน
        {hard > 0 && (
          <>
            {" "}· ข้อที่ถูกไม่ถึง 40% <span className="font-num tnum font-semibold text-red-700">{hard}</span> ข้อ
          </>
        )}
        {traps > 0 && (
          <>
            {" "}· ข้อที่ตัวเลือกผิดถูกเลือกมากกว่าเฉลย <span className="font-num tnum font-semibold text-amber-700">{traps}</span> ข้อ (ลองตรวจเฉลยอีกครั้ง)
          </>
        )}
      </p>

      <ol className="space-y-2">
        {stats.map((s, i) => {
          const p = pct(s.correctCount, s.n);
          const tone = s.correct === null ? "text-slate-400" : p >= 70 ? "text-green-700" : p >= 40 ? "text-amber-700" : "text-red-700";
          const max = Math.max(1, ...s.counts);
          return (
            <li key={s.question.id} className="rounded-sm border border-slate-200 bg-white p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <span className="font-display font-bold text-slate-800">{i + 1}.</span>
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700 line-clamp-2">
                  <QuizText text={s.question.prompt} />
                </p>
                <p className={`shrink-0 text-right font-num tnum ${tone}`}>
                  <span className="text-2xl font-bold leading-none">{s.correct === null ? "–" : p}</span>
                  <span className="text-sm">%</span>
                  <span className="block text-xs text-slate-500">ตอบถูก</span>
                </p>
              </div>

              <ul className="mt-3 space-y-1.5">
                {s.question.choices.map((text, k) => {
                  const isKey = k === s.correct;
                  const isTrap = k === s.trap;
                  return (
                    <li key={k} className="grid grid-cols-[1.75rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-sm">
                      <span
                        className={`grid size-6 place-items-center rounded-full border-2 font-display text-xs font-semibold ${
                          isKey ? "border-green-600 bg-green-600 text-[oklch(100%_0_0)]" : isTrap ? "border-amber-500 text-amber-700" : "border-slate-300 text-slate-500"
                        }`}
                        title={isKey ? "เฉลย" : undefined}
                      >
                        {CHOICE_LABELS[k]}
                      </span>
                      <span className="relative min-w-0">
                        {/* แถบสัดส่วนคนที่เลือก */}
                        <span
                          aria-hidden
                          className={`absolute inset-y-0 left-0 rounded-sm ${isKey ? "bg-green-600/25" : isTrap ? "bg-amber-500/25" : "bg-slate-300/40"}`}
                          style={{ width: `${(s.counts[k] / max) * 100}%` }}
                        />
                        <span className={`relative block truncate px-2 py-0.5 ${isKey ? "font-semibold text-slate-800" : "text-slate-600"}`}>
                          <QuizText text={text} />
                        </span>
                      </span>
                      <span className="text-right font-num tnum text-slate-600">
                        {s.counts[k]} <span className="text-xs text-slate-400">คน</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {(s.blank > 0 || s.trap !== null) && (
                <p className="mt-2 text-xs text-slate-500">
                  {s.blank > 0 && <>ไม่ได้ตอบ {s.blank} คน</>}
                  {s.blank > 0 && s.trap !== null && " · "}
                  {s.trap !== null && (
                    <span className="text-amber-700">
                      ตัวเลือก {CHOICE_LABELS[s.trap]} ถูกเลือกมากกว่าเฉลย — เข้าใจผิดกันเยอะ หรือเฉลยอาจผิด
                    </span>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
