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

const INPUT = "border border-slate-300 rounded-md px-3 py-2 text-sm";

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
        <form onSubmit={addMaterial} className="bg-white border border-slate-200 rounded-lg p-4 flex gap-2 flex-wrap">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ชื่อสื่อ เช่น สไลด์บทที่ 1"
            className={`${INPUT} flex-1 min-w-[180px]`}
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="ลิงก์ Google Drive หรือ YouTube"
            inputMode="url"
            className={`${INPUT} flex-1 min-w-[220px]`}
          />
          <button disabled={busy} className="bg-slate-800 text-white rounded-md px-4 text-sm disabled:opacity-50">
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
              <form key={m.id} onSubmit={saveEdit} className="p-3 flex gap-2 flex-wrap">
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  aria-label="ชื่อสื่อ"
                  className={`${INPUT} flex-1 min-w-[180px]`}
                />
                <input
                  value={editing.link}
                  onChange={(e) => setEditing({ ...editing, link: e.target.value })}
                  aria-label="ลิงก์"
                  inputMode="url"
                  className={`${INPUT} flex-1 min-w-[220px]`}
                />
                <button disabled={busy} className="bg-slate-800 text-white rounded-md px-3 text-sm disabled:opacity-50">
                  บันทึก
                </button>
                <button type="button" onClick={() => setEditing(null)} className="text-sm text-slate-500 hover:underline">
                  ยกเลิก
                </button>
              </form>
            );
          }

          const url = m.link_url ? normalizeUrl(m.link_url) : null;
          const host = hostOf(m.link_url);
          return (
            <div key={m.id} className="p-3 flex items-center justify-between gap-3 text-sm">
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-slate-700 hover:underline min-w-0">
                  {m.title} <span className="text-xs text-slate-400">↗ {host}</span>
                </a>
              ) : (
                <span className="text-slate-400 min-w-0">
                  {m.title} <span className="text-xs">(ลิงก์ใช้ไม่ได้)</span>
                </span>
              )}
              {isTeacher && (
                <span className="flex gap-3 shrink-0">
                  <button
                    onClick={() => setEditing({ id: m.id, title: m.title, link: m.link_url ?? "" })}
                    className="text-slate-500 hover:text-slate-800 hover:underline"
                  >
                    แก้ไข
                  </button>
                  <button onClick={() => remove(m)} disabled={busy} className="text-red-600 hover:text-red-800 hover:underline">
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
