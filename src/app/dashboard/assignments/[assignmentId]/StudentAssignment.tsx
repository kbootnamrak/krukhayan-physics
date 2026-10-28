"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import {
  BUCKET,
  dueCountdown,
  formatDue,
  formatWhen,
  lateText,
  newFilePath,
  prepareFile,
  STATUS_DOT,
  STATUS_LABEL,
  type Assignment,
  type StatusKey,
  type Submission,
  type SubmissionFile,
} from "@/lib/assignments";
import { FileGallery, FileTile, RemoveButton, useSignedUrls } from "./files";

type Draft = { id: string; file: File; preview: string | null };

/**
 * หน้างานของนักเรียน: อ่านคำชี้แจง → ถ่ายรูป/แนบไฟล์ → ส่ง
 * ส่งแล้วแก้ไขได้จนกว่าครูจะตรวจ · ครูส่งคืนให้แก้ → ส่งรอบใหม่
 */
export default function StudentAssignment({
  assignment,
  enrollmentId,
  initial,
}: {
  assignment: Assignment;
  enrollmentId: string;
  initial: Submission | null;
}) {
  const supabase = createClient();
  const [sub, setSub] = useState<Submission | null>(initial);
  const status: StatusKey = sub?.status ?? "none";
  const editable = status !== "graded";
  // ไฟล์ที่ส่งแล้วยังเก็บไว้ (รอบที่รอตรวจ แก้ได้) — รอบที่ครูส่งคืนเริ่มชุดใหม่
  const [kept, setKept] = useState<SubmissionFile[]>(status === "submitted" ? (initial?.files ?? []) : []);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [note, setNote] = useState(status === "submitted" ? (initial?.note ?? "") : "");
  const [editing, setEditing] = useState(status === "none" || status === "returned" || status === "missing");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const cd = dueCountdown(assignment.due_at, now);

  useEffect(() => () => drafts.forEach((d) => d.preview && URL.revokeObjectURL(d.preview)), [drafts]);

  const keptUrls = useSignedUrls(kept.map((f) => f.path));
  const total = kept.length + drafts.length;
  const room = assignment.max_files - total;

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const files = [...list];
    if (files.length > room) setError(`แนบได้อีก ${Math.max(0, room)} ไฟล์ (สูงสุด ${assignment.max_files} ไฟล์)`);
    const add = files.slice(0, Math.max(0, room)).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random()}`,
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setDrafts((d) => [...d, ...add]);
  }

  async function submit() {
    if (!total) return setError("ถ่ายรูปหรือแนบไฟล์งานอย่างน้อย 1 ไฟล์");
    setError(null);
    const uploaded: SubmissionFile[] = [];
    try {
      for (let i = 0; i < drafts.length; i++) {
        setBusy(`กำลังเตรียมรูป ${i + 1}/${drafts.length}`);
        const p = await prepareFile(drafts[i].file);
        const path = newFilePath(assignment.id, enrollmentId, p.ext);
        setBusy(`กำลังอัปโหลด ${i + 1}/${drafts.length}`);
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, p.blob, { contentType: p.type, upsert: false });
        if (upErr) throw new Error(dbErrorMessage(upErr));
        uploaded.push({ path, name: p.name, size: p.blob.size, type: p.type });
      }
      setBusy("กำลังส่งงาน");
      const files = [...kept, ...uploaded];
      const { data, error: e } = await supabase.rpc("assignment_submit", { p_assignment: assignment.id, p_files: files, p_note: note });
      if (e) throw new Error(dbErrorMessage(e));
      // ไฟล์รอบเดิมที่ถูกเอาออก (ยังไม่ถูกตรวจ) ลบทิ้งจากที่เก็บ
      const removed = status === "submitted" ? (sub?.files ?? []).filter((f) => !files.some((x) => x.path === f.path)).map((f) => f.path) : [];
      if (removed.length) await supabase.storage.from(BUCKET).remove(removed);
      const next = data as Submission;
      setSub(next);
      setKept(next.files);
      setDrafts([]);
      setEditing(false);
      setDone(true);
    } catch (err) {
      // อัปโหลดไปแล้วแต่ส่งไม่สำเร็จ → ลบไฟล์ที่ค้าง
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded.map((f) => f.path));
      setError(err instanceof Error ? err.message : "ส่งงานไม่สำเร็จ ลองใหม่");
    } finally {
      setBusy(null);
    }
  }

  const late = sub && status === "submitted" ? lateText(sub.submitted_at, assignment.due_at) : null;
  const history = useMemo(() => [...(sub?.history ?? [])].reverse(), [sub?.history]);

  return (
    <div className="space-y-5">
      {/* ---------- หัวเรื่อง ---------- */}
      <section className="space-y-3 rounded-sm border-2 border-slate-200 bg-white p-4 sm:p-5">
        <h1 className="font-display text-2xl font-bold text-slate-800">{assignment.title}</h1>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-slate-500">กำหนดส่ง</dt>
            <dd className="font-medium text-slate-800">{formatDue(assignment.due_at)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-slate-500">คะแนนเต็ม</dt>
            <dd className="font-num tnum font-medium text-slate-800">{Number(assignment.max_score)}</dd>
          </div>
        </dl>
        {cd && editable && status !== "submitted" && (
          <p className={`font-display text-lg font-bold ${cd.overdue ? "text-[var(--c-red-500)]" : cd.soon ? "text-slate-800" : "text-slate-600"}`}>
            {cd.overdue ? "เลยกำหนดส่งแล้ว — ยังส่งได้ แต่จะนับว่าส่งช้า" : cd.text}
          </p>
        )}
        {assignment.instructions && <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{assignment.instructions}</p>}
      </section>

      {/* ---------- สถานะ / ผลตรวจ ---------- */}
      <section className={`space-y-3 rounded-sm border-2 bg-white p-4 sm:p-5 ${status === "returned" ? "border-trace-magenta" : status === "graded" ? "border-trace-lime" : "border-slate-200"}`} aria-live="polite">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-2 font-display text-lg font-semibold text-slate-800">
            <span className={`size-2.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
            {done && status === "submitted" ? "ส่งงานแล้ว รอครูตรวจ" : STATUS_LABEL[status]}
          </span>
          {sub?.submitted_at && status === "submitted" && <span className="text-sm text-slate-500">ส่งเมื่อ {formatWhen(sub.submitted_at)}</span>}
          {late && <span className="text-sm font-medium text-[var(--c-red-500)]">{late}</span>}
          {sub && sub.attempt > 1 && <span className="text-sm text-slate-500">รอบที่ {sub.attempt}</span>}
        </p>

        {sub?.score != null && status !== "submitted" && (
          <p className="font-num tnum">
            <span className="text-4xl font-bold text-slate-800">{Number(sub.score)}</span>
            <span className="text-xl text-slate-500"> / {Number(assignment.max_score)}</span>
          </p>
        )}
        {sub?.feedback && status !== "submitted" && (
          <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium text-slate-500">ความเห็นจากครู</p>
            <p className="whitespace-pre-wrap text-slate-800">{sub.feedback}</p>
          </div>
        )}
        {status === "returned" && <p className="text-sm text-slate-700">ครูส่งงานคืนให้แก้ — แก้ตามความเห็นแล้วถ่ายรูปส่งใหม่ด้านล่าง</p>}
        {status === "missing" && <p className="text-sm text-slate-700">ครูบันทึกว่ายังไม่ส่ง (0 คะแนน) — ยังส่งได้ ครูจะตรวจและให้คะแนนใหม่</p>}

        {/* ไฟล์ที่ส่งแล้ว (โหมดดู) */}
        {!editing && sub && sub.files.length > 0 && <FileGallery files={sub.files} />}
        {!editing && editable && sub && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setDone(false);
            }}
            className="min-h-11 rounded-sm border-2 border-porcelain px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            {status === "submitted" ? "แก้ไข/เพิ่มรูปแล้วส่งใหม่" : "ส่งงาน"}
          </button>
        )}
      </section>

      {/* ---------- แนบงาน ---------- */}
      {editing && editable && (
        <section className="space-y-4 rounded-sm border-2 border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="font-display text-lg font-semibold text-slate-800">{status === "returned" ? "ส่งงานที่แก้แล้ว" : "แนบงาน"}</h2>

          {total > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {kept.map((f, i) => (
                <li key={f.path} className="relative">
                  <FileTile file={f} url={keptUrls[f.path]} index={i} />
                  <RemoveButton onClick={() => setKept((k) => k.filter((x) => x.path !== f.path))} label={`เอา ${f.name} ออก`} />
                </li>
              ))}
              {drafts.map((d, i) => (
                <li key={d.id} className="relative">
                  {d.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- รูปในเครื่องยังไม่อัปโหลด
                    <img src={d.preview} alt={`รูปใหม่ที่ ${i + 1}`} className="aspect-[3/4] w-full rounded-sm border-2 border-trace-cyan object-cover" />
                  ) : (
                    <FileTile file={{ name: d.file.name, type: d.file.type, size: d.file.size }} url={undefined} index={i} />
                  )}
                  <RemoveButton onClick={() => setDrafts((list) => list.filter((x) => x.id !== d.id))} label={`เอา ${d.file.name} ออก`} />
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={room <= 0 || !!busy}
              onClick={() => cameraRef.current?.click()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border-2 border-trace-cyan px-4 font-semibold text-slate-800 hover:bg-[color-mix(in_oklch,var(--trace-cyan)_12%,transparent)] disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              ถ่ายรูป
            </button>
            <button
              type="button"
              disabled={room <= 0 || !!busy}
              onClick={() => pickRef.current?.click()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border-2 border-slate-300 px-4 font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" />
              </svg>
              เลือกรูป / PDF
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
          <input ref={pickRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
          <p className="text-xs text-slate-500">
            แนบได้สูงสุด {assignment.max_files} ไฟล์ · ถ่ายให้เห็นทั้งหน้า แสงพอ อ่านออก · ระบบย่อรูปให้อัตโนมัติ
          </p>

          <div className="space-y-1">
            <label htmlFor="sub-note" className="block text-sm font-medium text-slate-700">
              ข้อความถึงครู <span className="font-normal text-slate-500">(ไม่บังคับ)</span>
            </label>
            <textarea id="sub-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className="w-full rounded-sm border-2 border-slate-300 bg-white px-3 py-2 text-base text-slate-800 sm:text-sm" />
          </div>

          {error && (
            <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {sub && status === "submitted" && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => {
                  setEditing(false);
                  setKept(sub.files);
                  setDrafts([]);
                  setNote(sub.note ?? "");
                  setError(null);
                }}
                className="min-h-12 rounded-sm border-2 border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
            )}
            <button
              type="button"
              disabled={!!busy || total === 0}
              onClick={submit}
              className="min-h-12 rounded-sm bg-[oklch(50%_0.24_345)] px-6 font-display text-lg font-bold text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] disabled:opacity-40"
            >
              {busy ?? (status === "returned" ? "ส่งงานที่แก้แล้ว" : status === "submitted" ? "ส่งใหม่" : "ส่งงาน")}
            </button>
          </div>
        </section>
      )}

      {/* ---------- ประวัติรอบก่อน ---------- */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-slate-800">รอบก่อนหน้า</h2>
          {history.map((h) => (
            <details key={h.attempt} className="rounded-sm border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm text-slate-700">
                รอบที่ {h.attempt} · ส่ง {formatWhen(h.submitted_at)}
                {h.score != null && ` · ${Number(h.score)}/${Number(assignment.max_score)}`}
              </summary>
              <div className="mt-3 space-y-2">
                {h.feedback && <p className="whitespace-pre-wrap text-sm text-slate-700">ครู: {h.feedback}</p>}
                <FileGallery files={h.files} />
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
