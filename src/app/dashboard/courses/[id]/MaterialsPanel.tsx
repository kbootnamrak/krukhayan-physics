"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db-error";

type Material = { id: string; title: string; link_url: string | null };

/**
 * รับเฉพาะลิงก์ http/https — ลิงก์แบบอื่น (เช่น javascript:) ห้ามให้นักเรียนกดเด็ดขาด
 * ครูมักวางลิงก์โดยไม่มี https:// นำหน้า (เช่น drive.google.com/...) จึงเติมให้
 */
function normalizeUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hostOf(link: string | null) {
  const url = link ? normalizeUrl(link) : null;
  return url ? new URL(url).hostname.replace(/^www\./, "") : null;
}

// ตัวอักษร 16px บนมือถือ — เล็กกว่านี้ iPhone จะซูมหน้าเองตอนแตะช่อง
const INPUT = "border border-slate-300 rounded-md px-3 py-2.5 text-base bg-white sm:py-2 sm:text-sm";
const PRIMARY = "min-h-11 bg-slate-800 text-white rounded-md px-4 text-sm font-semibold disabled:opacity-50 sm:min-h-0";

type Kind = "video" | "doc" | "link";
function kindOf(host: string | null): Kind {
  if (!host) return "link";
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return "video";
  if (/(^|\.)(drive|docs)\.google\.com$/.test(host) || host === "canva.com" || host.endsWith(".canva.com")) return "doc";
  return "link";
}
const KIND_LABEL: Record<Kind, string> = { video: "วิดีโอ", doc: "เอกสาร", link: "ลิงก์" };
const KIND_COLOR: Record<Kind, string> = { video: "var(--trace-magenta)", doc: "var(--trace-cyan)", link: "var(--trace-yellow)" };

/** ไอคอนชนิดสื่อ: วิดีโอ / เอกสาร / ลิงก์อื่น ๆ */
function KindIcon({ kind }: { kind: Kind }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {kind === "video" && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m10 9 5 3-5 3z" fill="currentColor" />
        </>
      )}
      {kind === "doc" && (
        <>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h4" />
        </>
      )}
      {kind === "link" && (
        <>
          <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
        </>
      )}
    </svg>
  );
}

export default function MaterialsPanel({
  courseId,
  materials,
  isTeacher,
  onChanged,
}: {
  courseId: string;
  materials: Material[];
  isTeacher: boolean;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string; link: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const url = normalizeUrl(link);
    if (!title.trim()) return setError("กรุณาใส่ชื่อสื่อ");
    if (!url) return setError("ลิงก์ไม่ถูกต้อง — คัดลอกลิงก์จาก Google Drive หรือ YouTube มาวางทั้งบรรทัด");

    setBusy(true);
    const { error: insertError } = await supabase
      .from("materials")
      .insert({ course_id: courseId, title: title.trim(), link_url: url });
    setBusy(false);
    if (insertError) return setError(dbErrorMessage(insertError));
    setTitle("");
    setLink("");
    onChanged();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    const url = normalizeUrl(editing.link);
    if (!editing.title.trim()) return setError("กรุณาใส่ชื่อสื่อ");
    if (!url) return setError("ลิงก์ไม่ถูกต้อง");

    setBusy(true);
    const { error: updateError } = await supabase
      .from("materials")
      .update({ title: editing.title.trim(), link_url: url })
      .eq("id", editing.id);
    setBusy(false);
    if (updateError) return setError(dbErrorMessage(updateError));
    setEditing(null);
    onChanged();
  }

  async function remove(m: Material) {
    if (!window.confirm(`ลบ "${m.title}" ?`)) return;
    setError(null);
    setBusy(true);
    const { error: deleteError } = await supabase.from("materials").delete().eq("id", m.id);
    setBusy(false);
    if (deleteError) return setError(dbErrorMessage(deleteError));
    onChanged();
  }

  return (
    <div className="space-y-4">
      {isTeacher && (
        <form onSubmit={addMaterial} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ชื่อสื่อ เช่น สไลด์บทที่ 1"
            aria-label="ชื่อสื่อ"
            className={`${INPUT} sm:flex-1 sm:min-w-[180px]`}
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="ลิงก์ Google Drive หรือ YouTube"
            aria-label="ลิงก์"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            className={`${INPUT} sm:flex-1 sm:min-w-[220px]`}
          />
          <button disabled={busy} className={PRIMARY}>
            เพิ่ม
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {materials.length === 0 && <p className="p-4 text-sm text-slate-400">ยังไม่มีสื่อการสอน</p>}
        {materials.map((m) => {
          if (editing?.id === m.id) {
            return (
              <form key={m.id} onSubmit={saveEdit} className="p-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  aria-label="ชื่อสื่อ"
                  className={`${INPUT} sm:flex-1 sm:min-w-[180px]`}
                />
                <input
                  value={editing.link}
                  onChange={(e) => setEditing({ ...editing, link: e.target.value })}
                  aria-label="ลิงก์"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className={`${INPUT} sm:flex-1 sm:min-w-[220px]`}
                />
                <div className="flex gap-2">
                  <button disabled={busy} className={`${PRIMARY} flex-1 sm:flex-none`}>
                    บันทึก
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm text-slate-600 hover:border-slate-500 sm:min-h-0 sm:flex-none sm:border-0 sm:hover:underline"
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            );
          }

          const url = m.link_url ? normalizeUrl(m.link_url) : null;
          const host = hostOf(m.link_url);
          const kind = kindOf(host);
          const body = (
            <>
              <span
                className="grid size-10 shrink-0 place-items-center rounded-sm border-2"
                style={{ color: KIND_COLOR[kind], borderColor: `color-mix(in oklch, ${KIND_COLOR[kind]} 60%, transparent)` }}
              >
                <KindIcon kind={kind} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-base leading-snug break-words sm:text-sm ${url ? "text-slate-800 group-hover:underline" : "text-slate-400"}`}>
                  {m.title}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {url ? `${KIND_LABEL[kind]} · ${host}` : "ลิงก์ใช้ไม่ได้"}
                </span>
              </span>
            </>
          );
          return (
            // ทั้งแถวกดเปิดได้ (มือถือกดง่าย) · ปุ่มแก้ไข/ลบของครูแยกอยู่ขวา
            <div key={m.id} className="flex items-stretch">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-w-0 flex-1 items-center gap-3 px-3 py-3 hover:bg-slate-100"
                >
                  {body}
                  <svg viewBox="0 0 24 24" className={`size-4 shrink-0 text-slate-400 group-hover:text-slate-700 ${isTeacher ? "hidden sm:block" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="เปิดในแท็บใหม่">
                    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                  </svg>
                </a>
              ) : (
                <span className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">{body}</span>
              )}
              {isTeacher && (
                <span className="flex shrink-0 items-center gap-1 pr-2 text-sm sm:gap-3 sm:pr-3">
                  <button
                    onClick={() => setEditing({ id: m.id, title: m.title, link: m.link_url ?? "" })}
                    className="min-h-11 px-2 text-slate-500 hover:text-slate-800 hover:underline sm:min-h-0 sm:px-0"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => remove(m)}
                    disabled={busy}
                    className="min-h-11 px-2 text-red-600 hover:text-red-800 hover:underline sm:min-h-0 sm:px-0"
                  >
                    ลบ
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
