"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import { CHOICE_LABELS, imageFileToDataUri, type QuizQuestion } from "@/lib/quiz";
import QuizText from "@/components/QuizText";

const INPUT = "w-full border border-slate-300 rounded-sm px-3 py-2 text-sm bg-white";

/**
 * แก้คำถามทีละข้อ: โจทย์ รูปประกอบ ตัวเลือก 4 ข้อ และเฉลย (กดวงกลมหน้าตัวเลือกที่ถูก)
 * แต่ละข้อมีปุ่มบันทึกของตัวเอง — แก้หลายข้อพร้อมกันได้ ข้อที่ยังไม่บันทึกมีป้ายบอก
 */
export default function QuestionsEditor({
  quizId,
  questions,
  keys,
  locked,
  onChanged,
}: {
  quizId: string;
  questions: QuizQuestion[];
  keys: Record<string, number>;
  locked: boolean;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addQuestion() {
    setBusy(true);
    const nextPos = questions.reduce((m, q) => Math.max(m, q.position), 0) + 1;
    const { error: insErr } = await supabase
      .from("quiz_questions")
      .insert({ quiz_id: quizId, position: nextPos, prompt: "", choices: ["", "", "", ""] });
    setBusy(false);
    if (insErr) return setError(dbErrorMessage(insErr));
    setError(null);
    onChanged();
  }

  async function move(index: number, dir: -1 | 1) {
    const a = questions[index];
    const b = questions[index + dir];
    if (!a || !b) return;
    setBusy(true);
    // สลับตำแหน่งสองข้อ (position ไม่ต้องไม่ซ้ำ จึงอัปเดตทีละแถวได้เลย)
    const [r1, r2] = await Promise.all([
      supabase.from("quiz_questions").update({ position: b.position }).eq("id", a.id),
      supabase.from("quiz_questions").update({ position: a.position }).eq("id", b.id),
    ]);
    setBusy(false);
    const e = r1.error ?? r2.error;
    if (e) return setError(dbErrorMessage(e));
    onChanged();
  }

  return (
    <div className="space-y-4">
      {locked && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-sm px-3 py-2">
          มีนักเรียนเริ่มทำแล้ว — แก้โจทย์ได้ แต่ถ้าแก้เฉลย ให้ไปกด &quot;ตรวจใหม่&quot; ในแท็บผลสอบด้วย
        </p>
      )}
      <p className="text-xs text-slate-500">
        พิมพ์ตัวยกด้วย ^ เช่น <code className="text-slate-700">10^{"{-19}"}</code> หรือ <code className="text-slate-700">m^2</code> · ตัวห้อยด้วย _{"{ }"} เช่น{" "}
        <code className="text-slate-700">P_{"{g}"}</code> · กดวงกลมหน้าตัวเลือกเพื่อตั้งเป็นเฉลย
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-sm px-3 py-2">
          {error}
        </p>
      )}

      {questions.length === 0 && (
        <p className="bg-white border border-slate-200 rounded-sm p-6 text-sm text-slate-500">ยังไม่มีคำถาม กด &quot;เพิ่มคำถาม&quot; เพื่อเริ่ม</p>
      )}

      <ol className="space-y-4">
        {questions.map((q, i) => (
          <QuestionCard
            // key รวม position ด้วย — ย้ายข้อแล้วฟอร์มโหลดค่าใหม่
            key={`${q.id}:${q.position}`}
            number={i + 1}
            question={q}
            correct={keys[q.id]}
            canUp={i > 0}
            canDown={i < questions.length - 1}
            onMove={(dir) => move(i, dir)}
            onChanged={onChanged}
          />
        ))}
      </ol>

      <button
        type="button"
        onClick={addQuestion}
        disabled={busy}
        className="w-full border-2 border-dashed border-slate-300 rounded-sm py-3 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:opacity-50"
      >
        + เพิ่มคำถาม
      </button>
    </div>
  );
}

function QuestionCard({
  number,
  question,
  correct,
  canUp,
  canDown,
  onMove,
  onChanged,
}: {
  number: number;
  question: QuizQuestion;
  correct: number | undefined;
  canUp: boolean;
  canDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [prompt, setPrompt] = useState(question.prompt);
  const [image, setImage] = useState<string | null>(question.image);
  const [choices, setChoices] = useState<string[]>(question.choices);
  const [key, setKey] = useState<number | undefined>(correct);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty =
    prompt !== question.prompt ||
    image !== question.image ||
    key !== correct ||
    choices.length !== question.choices.length ||
    choices.some((c, i) => c !== question.choices[i]);

  async function save() {
    if (!prompt.trim()) return setError("กรุณาใส่โจทย์");
    if (choices.some((c) => !c.trim())) return setError("กรอกตัวเลือกให้ครบทุกข้อ");
    setBusy(true);
    const { error: upErr } = await supabase
      .from("quiz_questions")
      .update({ prompt: prompt.trim(), image, choices: choices.map((c) => c.trim()) })
      .eq("id", question.id);
    let keyErr = null;
    if (!upErr && key !== correct) {
      const res =
        key === undefined
          ? await supabase.from("quiz_answer_keys").delete().eq("question_id", question.id)
          : await supabase.from("quiz_answer_keys").upsert({ question_id: question.id, correct_index: key });
      keyErr = res.error;
    }
    setBusy(false);
    const e = upErr ?? keyErr;
    if (e) return setError(dbErrorMessage(e));
    setError(null);
    // ให้ค่าในฟอร์มตรงกับที่บันทึก (ตัดช่องว่างหัวท้ายแล้ว) ป้าย "ยังไม่บันทึก" จะได้หาย
    setPrompt(prompt.trim());
    setChoices(choices.map((c) => c.trim()));
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    onChanged();
  }

  async function remove() {
    if (!window.confirm(`ลบข้อ ${number} ใช่ไหม?\nคำตอบของนักเรียนในข้อนี้จะไม่ถูกนับคะแนน`)) return;
    setBusy(true);
    const { error: delErr } = await supabase.from("quiz_questions").delete().eq("id", question.id);
    setBusy(false);
    if (delErr) return setError(dbErrorMessage(delErr));
    onChanged();
  }

  async function pickImage(file: File | undefined) {
    if (!file) return;
    try {
      setImage(await imageFileToDataUri(file));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อ่านรูปไม่สำเร็จ");
    }
  }

  return (
    <li className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-display font-bold text-lg text-slate-800">ข้อ {number}</span>
        {key === undefined && <span className="text-xs text-amber-700">ยังไม่มีเฉลย</span>}
        {dirty && <span className="text-xs text-trace-cyan">ยังไม่บันทึก</span>}
        {savedFlash && <span className="text-xs text-green-700">✓ บันทึกแล้ว</span>}
        <span className="ml-auto flex gap-1">
          <IconButton label="เลื่อนขึ้น" disabled={!canUp || busy} onClick={() => onMove(-1)} d="M12 19V5M5 12l7-7 7 7" />
          <IconButton label="เลื่อนลง" disabled={!canDown || busy} onClick={() => onMove(1)} d="M12 5v14M5 12l7 7 7-7" />
          <IconButton label={`ลบข้อ ${number}`} disabled={busy} onClick={remove} d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" danger />
        </span>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        placeholder="โจทย์"
        aria-label={`โจทย์ข้อ ${number}`}
        className={`${INPUT} resize-y`}
      />
      {/[\^_]\{?/.test(prompt) && (
        <p className="text-sm text-slate-600">
          ตัวอย่างที่นักเรียนเห็น: <QuizText text={prompt} className="text-slate-800" />
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI ใช้ next/image ไม่ได้ */}
            <img src={image} alt={`รูปประกอบข้อ ${number}`} className="max-h-48 rounded-sm border border-slate-200 bg-white" />
            <button type="button" onClick={() => setImage(null)} className="text-sm text-red-600 hover:underline">
              เอารูปออก
            </button>
          </>
        ) : (
          <label className="text-sm text-slate-600 border border-dashed border-slate-300 rounded-sm px-3 py-1.5 cursor-pointer hover:border-slate-400">
            + ใส่รูปประกอบ
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0])} />
          </label>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">ตัวเลือกและเฉลยของข้อ {number}</legend>
        {choices.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setKey(key === i ? undefined : i)}
              aria-pressed={key === i}
              aria-label={`ตั้งตัวเลือก ${CHOICE_LABELS[i]} เป็นเฉลย`}
              className={`grid place-items-center size-8 shrink-0 rounded-full border-2 font-display font-semibold text-sm ${
                key === i ? "border-green-600 bg-green-600 text-[oklch(100%_0_0)]" : "border-slate-300 text-slate-500 hover:border-slate-500"
              }`}
            >
              {CHOICE_LABELS[i]}
            </button>
            <input
              value={c}
              onChange={(e) => setChoices(choices.map((x, j) => (j === i ? e.target.value : x)))}
              aria-label={`ตัวเลือก ${CHOICE_LABELS[i]} ข้อ ${number}`}
              className={INPUT}
            />
          </div>
        ))}
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="bg-slate-800 text-white rounded-sm px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {busy ? "กำลังบันทึก..." : "บันทึกข้อนี้"}
        </button>
      </div>
    </li>
  );
}

function IconButton({ label, d, onClick, disabled, danger }: { label: string; d: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid place-items-center size-8 rounded-sm border border-slate-200 disabled:opacity-30 ${
        danger ? "text-red-600 hover:border-red-300" : "text-slate-500 hover:border-slate-400 hover:text-slate-800"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </button>
  );
}
