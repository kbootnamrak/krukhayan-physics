"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";
import {
  ATTACH_ACCEPT,
  ATTACH_BUCKET,
  attachmentPath,
  formatBytes,
  fromLocalInput,
  itemKey,
  normalizeUrl,
  prepareAttachment,
  storedPaths,
  SUBMIT_MODE_LABEL,
  toLocalInput,
  type Assignment,
  type ComponentOption,
  type SubmissionFile,
  type SubmitMode,
} from "@/lib/assignments";
import { FileGallery, RemoveButton } from "./[assignmentId]/files";

/**
 * ฟอร์มสร้าง/แก้ไขงาน (ครู) — ใช้ทั้งแท็บ "งาน" ในหน้ารายวิชาและหน้างาน
 * แนบไฟล์งาน/ใบงานให้นักเรียนได้ 2 แบบ: อัปโหลดไฟล์ หรือวางลิงก์ (Google Drive ฯลฯ ไม่กินพื้นที่)
 */
export default function AssignmentForm({
  courseId,
  initial,
  componentOptions,
  rooms,
  onSaved,
  onCancel,
  focusAttach = false,
}: {
  courseId: string;
  initial?: Assignment;
  componentOptions: ComponentOption[];
  rooms: string[];
  onSaved: (a: Assignment) => void;
  onCancel: () => void;
  /** เปิดฟอร์มจากปุ่ม "แนบไฟล์งาน" — เลื่อนไปที่ส่วนแนบไฟล์ */
  focusAttach?: boolean;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [due, setDue] = useState(() => toLocalInput(initial?.due_at ?? null) || defaultDue());
  const [maxScore, setMaxScore] = useState(initial ? String(Number(initial.max_score)) : "10");
  const [componentId, setComponentId] = useState(initial?.component_id ?? "");
  const [allRooms, setAllRooms] = useState(!initial?.rooms);
  const [picked, setPicked] = useState<string[]>(initial?.rooms ?? []);
  const [published, setPublished] = useState(initial?.published ?? true);
  const [submitMode, setSubmitMode] = useState<SubmitMode>(initial?.submit_mode ?? "both");
  // ไฟล์งานของครู: ที่แนบไว้แล้ว + ไฟล์ใหม่ที่ยังไม่อัปโหลด (อัปโหลดตอนกดบันทึก)
  const [attached, setAttached] = useState<SubmissionFile[]>(initial?.attachments ?? []);
  const [pending, setPending] = useState<File[]>([]);
  const [linkText, setLinkText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (focusAttach) attachRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focusAttach]);
  // งานใหม่ที่บันทึกไปแล้วแต่อัปโหลดไฟล์ไม่ครบ — กดบันทึกซ้ำต้องแก้แถวเดิม ไม่สร้างงานซ้ำ
  const savedRef = useRef<Assignment | null>(null);

  function addLink() {
    const url = normalizeUrl(linkText);
    if (!url) return setError("ลิงก์ไม่ถูกต้อง — คัดลอกลิงก์ทั้งหมดมาวาง เช่น https://drive.google.com/...");
    if (attached.some((f) => f.url === url)) return setError("ใส่ลิงก์นี้ไปแล้ว");
    setError(null);
    setAttached((a) => [...a, { url, name: url }]);
    setLinkText("");
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const max = Number(maxScore.replace(",", "."));
    if (!title.trim()) return setError("ใส่ชื่องาน");
    if (!Number.isFinite(max) || max <= 0) return setError("คะแนนเต็มต้องมากกว่า 0");
    if (!allRooms && picked.length === 0) return setError("เลือกห้องอย่างน้อย 1 ห้อง หรือเลือกทุกห้อง");
    setBusy(true);
    setError(null);
    const row: Record<string, unknown> = {
      course_id: courseId,
      title: title.trim(),
      instructions: instructions.trim() || null,
      due_at: fromLocalInput(due),
      max_score: max,
      component_id: componentId || null,
      rooms: allRooms ? null : picked,
      published,
      submit_mode: submitMode,
    };
    // งานใหม่ต้องได้ id ก่อน ไฟล์จึงอยู่ในโฟลเดอร์ของงาน
    const existing = initial ?? savedRef.current;
    const res = existing
      ? await supabase.from("assignments").update(row).eq("id", existing.id).select().single()
      : await supabase.from("assignments").insert(row).select().single();
    if (res.error) {
      setBusy(false);
      return setError(dbErrorMessage(res.error));
    }
    let saved = res.data as Assignment;
    savedRef.current = saved;

    const uploaded: SubmissionFile[] = [];
    try {
      for (const file of pending) {
        const p = await prepareAttachment(file);
        const path = attachmentPath(saved.id, p.ext);
        const { error: upErr } = await supabase.storage.from(ATTACH_BUCKET).upload(path, p.blob, { contentType: p.type });
        if (upErr) throw new Error(`อัปโหลด ${file.name} ไม่สำเร็จ: ${dbErrorMessage(upErr)}`);
        uploaded.push({ path, name: p.name, size: p.blob.size, type: p.type });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไฟล์ไม่สำเร็จ");
    }
    const next = [...attached, ...uploaded];
    const before = existing?.attachments ?? [];
    const removed = storedPaths(before).filter((p) => !storedPaths(next).includes(p));
    if (next.length || before.length) {
      const upd = await supabase.from("assignments").update({ attachments: next }).eq("id", saved.id).select().single();
      if (upd.error) {
        setBusy(false);
        return setError(dbErrorMessage(upd.error));
      }
      saved = upd.data as Assignment;
      if (removed.length) await supabase.storage.from(ATTACH_BUCKET).remove(removed);
    }
    setBusy(false);
    // เก็บเฉพาะไฟล์ที่ยังอัปโหลดไม่สำเร็จไว้ให้ลองใหม่
    setPending(pending.slice(uploaded.length));
    // อัปโหลดไม่ครบ → งานบันทึกแล้ว แต่ให้ครูเห็นข้อความก่อน (กดบันทึกอีกครั้งเพื่อลองใหม่)
    if (uploaded.length < pending.length) {
      setAttached(saved.attachments);
      savedRef.current = saved;
      return;
    }
    onSaved(saved);
  }

  const field = "w-full rounded-sm border-2 border-slate-300 bg-white px-3 py-2 text-base text-slate-800 sm:text-sm";
  const label = "block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={save} className="space-y-4 rounded-sm border-2 border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold text-slate-800">{initial ? "แก้ไขงาน" : "สร้างงานใหม่"}</h2>

      <div className="space-y-1">
        <label htmlFor="as-title" className={label}>ชื่องาน</label>
        <input id="as-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ใบงานที่ 1 สเปกตรัมคลื่นแม่เหล็กไฟฟ้า" className={field} />
      </div>

      <div className="space-y-1">
        <label htmlFor="as-inst" className={label}>
          คำชี้แจง <span className="font-normal text-slate-500">(ไม่บังคับ)</span>
        </label>
        <textarea
          id="as-inst"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="เช่น ทำใบงานหน้า 1–2 ถ่ายรูปให้เห็นชื่อ-เลขที่ชัดเจน"
          className={field}
        />
      </div>

      <fieldset ref={attachRef} id="as-attach" className="min-w-0 scroll-mt-4 space-y-2">
        <legend className={label}>
          ไฟล์งาน / ใบงาน <span className="font-normal text-slate-500">(ไม่บังคับ)</span>
        </legend>
        {(attached.length > 0 || pending.length > 0) && (
          <div className="space-y-2">
            <FileGallery files={attached} bucket={ATTACH_BUCKET} onRemove={(key) => setAttached((a) => a.filter((f) => itemKey(f) !== key))} />
            {pending.length > 0 && (
              <ul className="space-y-1.5">
                {pending.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="relative flex min-h-11 items-center gap-2 rounded-sm border-2 border-dashed border-trace-cyan py-1.5 pl-3 pr-11 text-sm text-slate-700">
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-slate-500">{formatBytes(f.size)} · อัปโหลดตอนบันทึก</span>
                    <RemoveButton onClick={() => setPending((p) => p.filter((_, j) => j !== i))} label={`เอา ${f.name} ออก`} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <input
            aria-label="ลิงก์ไฟล์งาน"
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
            placeholder="วางลิงก์ไฟล์งาน"
            className={`${field} min-w-0 flex-1`}
          />
          <button
            type="button"
            disabled={!linkText.trim()}
            onClick={addLink}
            className="min-h-11 shrink-0 rounded-sm border-2 border-trace-cyan px-3 text-sm font-semibold text-slate-800 hover:bg-[color-mix(in_oklch,var(--trace-cyan)_12%,transparent)] disabled:opacity-40"
          >
            เพิ่มลิงก์
          </button>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm border-2 border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-9"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" />
          </svg>
          อัปโหลดไฟล์ (PDF, Word, PowerPoint, รูป)
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ATTACH_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const list = [...(e.target.files ?? [])];
            e.target.value = "";
            setPending((p) => [...p, ...list]);
          }}
        />
        <p className="text-xs text-slate-500">
          แนะนำวางลิงก์ Google Drive แทนการอัปโหลด — ไม่กินพื้นที่เก็บไฟล์ของระบบ (ฟรี 1 GB รวมทั้งเว็บ) · ตั้งแชร์เป็น
          &quot;ทุกคนที่มีลิงก์ดูได้&quot; · อัปโหลดได้ไฟล์ละไม่เกิน 20 MB
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="as-due" className={label}>กำหนดส่ง</label>
          <input id="as-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
          <p className="text-xs text-slate-500">ส่งเลยกำหนดได้ ระบบติดป้าย &quot;ส่งช้า&quot; ให้ · เว้นว่าง = ไม่กำหนด</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="as-max" className={label}>คะแนนเต็มของงาน</label>
          <input id="as-max" inputMode="decimal" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} className={field} />
        </div>
      </div>

      <fieldset className="min-w-0 space-y-2">
        <legend className={label}>นักเรียนส่งงานเป็น</legend>
        <div className="flex flex-wrap gap-2">
          {(["both", "links", "files"] as SubmitMode[]).map((m) => (
            <Chip key={m} on={submitMode === m} onClick={() => setSubmitMode(m)}>
              {SUBMIT_MODE_LABEL[m]}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-slate-500">งานที่เป็น PDF หรือไฟล์ใหญ่ เลือก &quot;ลิงก์เท่านั้น&quot; จะไม่กินพื้นที่เก็บไฟล์เลย</p>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="as-comp" className={label}>คะแนนเข้าช่อง</label>
        <select id="as-comp" value={componentId} onChange={(e) => setComponentId(e.target.value)} className={field}>
          <option value="">ไม่ผูก — ดูคะแนนในหน้างานอย่างเดียว</option>
          {componentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          ตรวจแล้วคะแนนเข้าช่องนี้อัตโนมัติ (ปรับสัดส่วนตามคะแนนเต็มของช่อง ปัดเป็นจำนวนเต็ม) ถ้าผูกหลายงานกับช่องเดียว
          ระบบรวมคะแนนทุกงานแล้วเทียบสัดส่วน · คะแนนเดิมในช่องนี้จะถูกแทนที่เมื่อเริ่มตรวจ
          {componentOptions.length === 0 && " — วิชานี้ยังไม่มีหน่วยการเรียนรู้ เพิ่มได้ที่แท็บ หน่วยการเรียนรู้"}
        </p>
      </div>

      {rooms.length > 0 && (
        <fieldset className="min-w-0 space-y-2">
          <legend className={label}>มอบหมายให้</legend>
          <div className="flex flex-wrap gap-2">
            <Chip on={allRooms} onClick={() => setAllRooms(true)}>ทุกห้อง</Chip>
            {rooms.map((r) => {
              const on = !allRooms && picked.includes(r);
              return (
                <Chip
                  key={r}
                  on={on}
                  onClick={() => {
                    setAllRooms(false);
                    setPicked((p) => (allRooms ? [r] : on ? p.filter((x) => x !== r) : [...p, r]));
                  }}
                >
                  {r}
                </Chip>
              );
            })}
          </div>
        </fieldset>
      )}

      <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700 sm:min-h-0">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="size-5 accent-[var(--trace-magenta)]" />
        เผยแพร่ให้นักเรียนเห็นและส่งได้ทันที
      </label>

      {error && (
        <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-sm border-2 border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-9">
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-sm bg-[oklch(50%_0.24_345)] px-5 text-sm font-semibold text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] disabled:opacity-50 sm:min-h-9"
        >
          {busy ? "กำลังบันทึก..." : initial ? "บันทึก" : "สร้างงาน"}
        </button>
      </div>
    </form>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-sm border-2 px-3 text-sm sm:min-h-9 ${on ? "border-trace-magenta bg-[color-mix(in_oklch,var(--trace-magenta)_12%,transparent)] font-semibold text-slate-800" : "border-slate-300 text-slate-600 hover:border-slate-500"}`}
    >
      {children}
    </button>
  );
}

/** ค่าเริ่มต้น: อีก 7 วัน เวลา 23:59 */
function defaultDue(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  d.setHours(23, 59, 0, 0);
  return toLocalInput(d.toISOString());
}
