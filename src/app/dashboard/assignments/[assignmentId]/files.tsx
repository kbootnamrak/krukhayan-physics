"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUCKET, formatBytes, type SubmissionFile } from "@/lib/assignments";

/** ลิงก์ชั่วคราว (1 ชม.) ของไฟล์ในที่เก็บส่วนตัว — ขอครั้งเดียวต่อชุดไฟล์ */
export function useSignedUrls(paths: string[]): Record<string, string> {
  const supabase = useMemo(() => createClient(), []);
  const key = paths.join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (!list.length) return;
    let alive = true;
    supabase.storage
      .from(BUCKET)
      .createSignedUrls(list, 3600)
      .then(({ data }) => {
        if (!alive || !data) return;
        const next: Record<string, string> = {};
        for (const d of data) if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
        setUrls((prev) => ({ ...prev, ...next }));
      });
    return () => {
      alive = false;
    };
  }, [key, supabase]);
  return urls;
}

/**
 * แสดงไฟล์งาน
 * - large = รูปเต็มความกว้างเรียงลงมา (ครูตรวจ อ่านลายมือได้)
 * - ปกติ = ตารางรูปย่อ แตะเพื่อเปิดรูปเต็ม
 */
export function FileGallery({
  files,
  large = false,
  onRemove,
}: {
  files: SubmissionFile[];
  large?: boolean;
  onRemove?: (path: string) => void;
}) {
  const urls = useSignedUrls(files.map((f) => f.path));
  if (!files.length) return null;
  return (
    <ul className={large ? "space-y-3" : "grid grid-cols-3 gap-2 sm:grid-cols-4"}>
      {files.map((f, i) => (
        <li key={f.path} className="relative">
          <FileTile file={f} url={urls[f.path]} index={i} large={large} />
          {onRemove && <RemoveButton onClick={() => onRemove(f.path)} label={`เอา ${f.name} ออก`} />}
        </li>
      ))}
    </ul>
  );
}

export function FileTile({ file, url, index, large }: { file: { name: string; type: string; size?: number }; url: string | undefined; index: number; large?: boolean }) {
  const isPdf = file.type === "application/pdf";
  if (isPdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`flex flex-col items-center justify-center gap-1 rounded-sm border-2 border-slate-200 bg-white p-2 text-center hover:border-slate-400 ${large ? "min-h-24 flex-row gap-3" : "aspect-[3/4]"}`}
      >
        <svg viewBox="0 0 24 24" className="size-8 shrink-0 text-[var(--c-red-500)]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        </svg>
        <span className="line-clamp-2 break-all text-xs text-slate-700">{file.name}</span>
        {file.size ? <span className="text-[11px] text-slate-500">PDF · {formatBytes(file.size)}</span> : null}
      </a>
    );
  }
  if (!url) {
    return <span className={`block animate-pulse rounded-sm bg-slate-200 ${large ? "h-80" : "aspect-[3/4]"}`} aria-label={`กำลังโหลดรูปที่ ${index + 1}`} />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-sm border-2 border-slate-200 bg-[oklch(100%_0_0)] hover:border-slate-400">
      {/* eslint-disable-next-line @next/next/no-img-element -- ลิงก์ชั่วคราวจาก storage ใช้ next/image ไม่ได้ */}
      <img src={url} alt={`งานหน้าที่ ${index + 1}`} className={large ? "h-auto w-full" : "aspect-[3/4] w-full object-cover"} loading="lazy" />
    </a>
  );
}

export function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute right-1 top-1 grid size-8 place-items-center rounded-full border-2 border-[oklch(100%_0_0)] bg-[var(--sign-ink)] text-[oklch(100%_0_0)]"
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  );
}
