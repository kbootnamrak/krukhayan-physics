"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUCKET, formatBytes, itemKey, linkLabel, storedPaths, type SubmissionFile } from "@/lib/assignments";

/** ลิงก์ชั่วคราว (1 ชม.) ของไฟล์ในที่เก็บส่วนตัว — ขอครั้งเดียวต่อชุดไฟล์ */
export function useSignedUrls(paths: string[], bucket: string = BUCKET): Record<string, string> {
  const supabase = useMemo(() => createClient(), []);
  const key = paths.join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (!list.length) return;
    let alive = true;
    supabase.storage
      .from(bucket)
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
  }, [bucket, key, supabase]);
  return urls;
}

/**
 * แสดงไฟล์งาน
 * - large = รูปเต็มความกว้างเรียงลงมา (ครูตรวจ อ่านลายมือได้)
 * - ปกติ = ตารางรูปย่อ แตะเพื่อเปิดรูปเต็ม
 * - ลิงก์ (Google Drive ฯลฯ) แสดงเป็นแถบลิงก์เต็มความกว้าง เปิดในแท็บใหม่
 * - purged = ครูลบไฟล์ของงานนี้แล้ว (ลิงก์ยังเปิดได้ตามปกติ)
 */
export function FileGallery({
  files,
  large = false,
  purged = false,
  bucket = BUCKET,
  onRemove,
}: {
  files: SubmissionFile[];
  large?: boolean;
  purged?: boolean;
  bucket?: string;
  onRemove?: (key: string) => void;
}) {
  const stored = files.filter((f) => f.path);
  const links = files.filter((f) => f.url);
  const urls = useSignedUrls(purged ? [] : storedPaths(stored), bucket);
  if (!files.length) return null;
  return (
    <div className="space-y-2">
      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((f) => (
            <li key={itemKey(f)} className="relative">
              <LinkTile url={f.url!} />
              {onRemove && <RemoveButton onClick={() => onRemove(itemKey(f))} label={`เอาลิงก์ ${f.url} ออก`} />}
            </li>
          ))}
        </ul>
      )}
      {stored.length > 0 &&
        (purged ? (
          <p className="rounded-sm border-2 border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
            รูป/ไฟล์ {stored.length} รายการ ถูกลบออกจากที่เก็บแล้ว (คะแนนยังอยู่)
          </p>
        ) : (
          <ul className={large ? "space-y-3" : "grid grid-cols-3 gap-2 sm:grid-cols-4"}>
            {stored.map((f, i) => (
              <li key={itemKey(f)} className="relative">
                <FileTile file={f} url={urls[f.path!]} index={i} large={large} />
                {onRemove && <RemoveButton onClick={() => onRemove(itemKey(f))} label={`เอา ${f.name} ออก`} />}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

/** ลิงก์งานภายนอก — แสดงชื่อบริการ + ที่อยู่ย่อ */
export function LinkTile({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex min-h-12 items-center gap-3 rounded-sm border-2 border-slate-200 bg-white py-2 pl-3 pr-11 hover:border-slate-400"
    >
      <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-trace-cyan" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </svg>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{linkLabel(url)}</span>
        <span className="block truncate text-xs text-slate-500">{url}</span>
      </span>
    </a>
  );
}

export function FileTile({ file, url, index, large }: { file: { name: string; type?: string; size?: number }; url: string | undefined; index: number; large?: boolean }) {
  // รูปแสดงเป็นภาพ · อย่างอื่น (PDF, Word, PowerPoint ...) แสดงเป็นไอคอนเอกสาร
  if (!file.type?.startsWith("image/")) {
    const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "ไฟล์").toUpperCase();
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
        {file.size ? <span className="text-[11px] text-slate-500">{ext} · {formatBytes(file.size)}</span> : null}
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
