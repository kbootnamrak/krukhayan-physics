"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Material = { id: string; title: string; link_url: string | null };

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

  async function addMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !link.trim()) return;
    await supabase.from("materials").insert({ course_id: courseId, title, link_url: link });
    setTitle("");
    setLink("");
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
            className="flex-1 min-w-[180px] border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="ลิงก์ Google Drive หรือ YouTube"
            className="flex-1 min-w-[220px] border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <button className="bg-slate-800 text-white rounded-md px-4 text-sm">เพิ่ม</button>
        </form>
      )}
      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {materials.length === 0 && <p className="p-4 text-sm text-slate-400">ยังไม่มีสื่อการสอน</p>}
        {materials.map((m) => (
          <a
            key={m.id}
            href={m.link_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            {m.title}
          </a>
        ))}
      </div>
    </div>
  );
}
