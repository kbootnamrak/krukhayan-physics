"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

export type PinStatus = { account: "google" | "pin" | null; hasPin: boolean };
type Issued = { rosterId: string; name: string; studentCode: string; classroom: string | null; classNumber: number | null; pin: string };
type Row = { id: string; full_name: string; student_code: string; classroom: string | null; class_number: number | null };

const SITE = "phyzix.app";

/**
 * สร้าง PIN ทั้งห้อง/ทั้งวิชา (ตามห้องที่เลือกอยู่) แล้วพิมพ์บัตร PIN หรือดาวน์โหลด Excel แจกนักเรียน
 * PIN แสดงครั้งเดียวหลังสร้าง ระบบไม่เก็บตัว PIN — ปิดกล่องแล้วต้องออก PIN ใหม่ถ้าต้องการดูซ้ำ
 */
export default function PinBulk({
  courseId,
  rows,
  status,
  scopeLabel,
  courseLabel,
  onDone,
}: {
  courseId: string;
  rows: Row[];
  status: Map<string, PinStatus>;
  scopeLabel: string;
  courseLabel: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued[] | null>(null);
  const [failed, setFailed] = useState<{ name: string; error: string }[]>([]);

  const withPin = rows.filter((r) => status.get(r.id)?.hasPin).length;
  const missing = rows.length - withPin;

  async function run(replace: boolean) {
    const n = replace ? rows.length : missing;
    if (!n) return;
    const msg = replace
      ? `ออก PIN ใหม่ให้${scopeLabel} ${n} คน?\nPIN เดิมของทุกคนจะใช้ไม่ได้ทันที ต้องแจกบัตรใหม่ทั้งหมด`
      : `สร้าง PIN ให้${scopeLabel}ที่ยังไม่มี ${n} คน?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/students/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "issue-bulk", courseId, rosterIds: rows.map((r) => r.id), replace }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(json?.error ?? "สร้าง PIN ไม่สำเร็จ ลองใหม่อีกครั้ง");
    const list = ((json.issued as Issued[]) ?? []).sort(
      (a, b) => (a.classroom ?? "").localeCompare(b.classroom ?? "", "th") || (a.classNumber ?? 999) - (b.classNumber ?? 999)
    );
    setIssued(list);
    setFailed(json.failed ?? []);
    onDone();
  }

  function downloadExcel() {
    if (!issued?.length) return;
    const sheet = XLSX.utils.json_to_sheet(
      issued.map((p) => ({ ห้อง: p.classroom ?? "", เลขที่: p.classNumber ?? "", รหัสนักเรียน: p.studentCode, "ชื่อ-สกุล": p.name, PIN: p.pin }))
    );
    sheet["!cols"] = [{ wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 30 }, { wch: 10 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "PIN");
    XLSX.writeFile(book, `PIN ${courseLabel} ${scopeLabel}.xlsx`);
  }

  function printSlips() {
    if (!issued?.length) return;
    const w = window.open("", "_blank");
    if (!w) return setError("เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาต pop-up แล้วลองอีกครั้ง หรือใช้ ดาวน์โหลด Excel");
    w.document.write(slipsHtml(issued, courseLabel));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  if (!rows.length) return null;

  return (
    <section className="space-y-3 rounded-sm border-2 border-slate-200 bg-white p-4" aria-label="PIN เข้าระบบ">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 text-sm text-slate-700">
          <b className="font-display text-slate-800">PIN เข้าระบบ</b> · {scopeLabel}มี PIN แล้ว{" "}
          <b className="font-num tnum text-slate-800">{withPin}</b>/<span className="font-num tnum">{rows.length}</span> คน
        </p>
        <div className="flex flex-wrap gap-2">
          {missing > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(false)}
              className="min-h-11 rounded-sm bg-[oklch(50%_0.24_345)] px-4 text-sm font-semibold text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] disabled:opacity-50 sm:min-h-9"
            >
              {busy ? "กำลังสร้าง PIN..." : `สร้าง PIN ให้ทุกคนที่ยังไม่มี (${missing})`}
            </button>
          )}
          {withPin > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(true)}
              className="min-h-11 rounded-sm border-2 border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:min-h-9"
            >
              ออก PIN ใหม่ทั้งหมด
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        นักเรียนที่เข้าด้วย Google อยู่แล้วยังใช้ Google ได้ตามเดิม PIN เป็นอีกทางหนึ่ง · เข้าที่ {SITE}{" "}→ &quot;เข้าด้วยรหัสนักเรียน + PIN&quot;
      </p>

      {error && (
        <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {issued && (
        <div className="space-y-3 rounded-sm border-2 border-trace-yellow p-3">
          <p className="text-sm font-semibold text-slate-800">
            สร้าง PIN แล้ว {issued.length} คน
            {failed.length > 0 && <span className="text-red-700"> · ไม่สำเร็จ {failed.length} คน</span>}
          </p>
          <p className="text-xs text-amber-800">
            PIN แสดงครั้งเดียว — พิมพ์บัตรหรือดาวน์โหลด Excel ตอนนี้ ปิดกล่องนี้แล้วดูซ้ำไม่ได้ (ถ้าหาย ออก PIN ใหม่รายคนได้)
          </p>
          {issued.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={printSlips} className="min-h-11 rounded-sm bg-[oklch(50%_0.24_345)] px-4 text-sm font-semibold text-[oklch(100%_0_0)] hover:bg-[oklch(55%_0.25_345)] sm:min-h-9">
                พิมพ์บัตร PIN
              </button>
              <button type="button" onClick={downloadExcel} className="min-h-11 rounded-sm border-2 border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-9">
                ดาวน์โหลด Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("ปิดรายการ PIN? ปิดแล้วดูซ้ำไม่ได้")) setIssued(null);
                }}
                className="min-h-11 rounded-sm px-3 text-sm text-slate-500 hover:text-slate-800 sm:min-h-9"
              >
                ปิด
              </button>
            </div>
          )}
          {failed.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-red-800">
              {failed.map((f) => (
                <li key={f.name}>
                  {f.name}: {f.error}
                </li>
              ))}
            </ul>
          )}
          {issued.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-sm border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 text-left text-xs text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">ห้อง</th>
                    <th className="px-2 py-1.5 font-medium">เลขที่</th>
                    <th className="px-2 py-1.5 font-medium">ชื่อ</th>
                    <th className="px-2 py-1.5 font-medium">รหัส</th>
                    <th className="px-2 py-1.5 font-medium">PIN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issued.map((p) => (
                    <tr key={p.rosterId}>
                      <td className="px-2 py-1.5 text-slate-600">{p.classroom}</td>
                      <td className="px-2 py-1.5 font-num tnum text-slate-600">{p.classNumber}</td>
                      <td className="px-2 py-1.5 text-slate-800">{p.name}</td>
                      <td className="px-2 py-1.5 font-num tnum text-slate-600">{p.studentCode}</td>
                      <td className="px-2 py-1.5 font-num tnum font-bold tracking-widest text-slate-800">{p.pin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** หน้าพิมพ์บัตร PIN — A4 แผ่นละ 10 ใบ ตัดแจกได้ */
function slipsHtml(list: Issued[], courseLabel: string) {
  const cards = list
    .map(
      (p) => `<div class="card">
  <div class="top"><span>${esc(courseLabel)}</span><span>${esc(p.classroom ?? "")}${p.classNumber != null ? ` เลขที่ ${p.classNumber}` : ""}</span></div>
  <div class="name">${esc(p.name)}</div>
  <div class="row"><div><small>รหัสนักเรียน</small><b>${esc(p.studentCode)}</b></div><div><small>PIN</small><b class="pin">${esc(p.pin)}</b></div></div>
  <div class="how">เข้า <b>${SITE}</b> → กด "เข้าด้วยรหัสนักเรียน + PIN" · เก็บ PIN เป็นความลับ</div>
</div>`
    )
    .join("");
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>บัตร PIN ${esc(courseLabel)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; color: #111; background: #fff; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .card { border: 1px dashed #888; padding: 10px 12px; height: 54mm; display: flex; flex-direction: column; gap: 6px; break-inside: avoid; }
  .top { display: flex; justify-content: space-between; font-size: 11px; color: #555; }
  .name { font-size: 16px; font-weight: 700; }
  .row { display: flex; gap: 24px; }
  .row small { display: block; font-size: 10px; color: #666; }
  .row b { font-size: 18px; font-variant-numeric: tabular-nums; }
  .row .pin { font-size: 26px; letter-spacing: 4px; }
  .how { margin-top: auto; font-size: 11px; color: #333; }
  @media screen { body { padding: 16px; background: #eee; } .grid { max-width: 190mm; margin: 0 auto; background: #fff; } }
</style></head><body><div class="grid">${cards}</div></body></html>`;
}
