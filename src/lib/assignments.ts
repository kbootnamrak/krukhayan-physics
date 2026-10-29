/**
 * การส่งงาน — ชนิดข้อมูล ป้ายสถานะ และการเตรียมไฟล์ก่อนอัปโหลด
 * ฐานข้อมูล: assignments, assignment_submissions, bucket "submissions" (ส่วนตัว)
 */

export type Assignment = {
  id: string;
  course_id: string;
  title: string;
  instructions: string | null;
  due_at: string | null;
  max_score: number;
  component_id: string | null;
  rooms: string[] | null;
  published: boolean;
  max_files: number;
  /** ไฟล์งาน/ใบงานที่ครูแนบ (bucket "assignment-files") หรือลิงก์ */
  attachments: SubmissionFile[];
  /** files = รูป/ไฟล์ · links = ลิงก์เท่านั้น (ไม่กินพื้นที่) · both = ได้ทั้งสองแบบ */
  submit_mode: SubmitMode;
  /** ครูลบไฟล์ของงานนี้ออกจากที่เก็บแล้ว (คะแนนยังอยู่) */
  files_purged_at: string | null;
  created_at: string;
};

export type SubmitMode = "files" | "links" | "both";

export const SUBMIT_MODE_LABEL: Record<SubmitMode, string> = {
  both: "รูป/ไฟล์ หรือลิงก์",
  links: "ลิงก์เท่านั้น",
  files: "รูป/ไฟล์เท่านั้น",
};

/** หนึ่งรายการที่ส่ง: ไฟล์ในที่เก็บ (path) หรือลิงก์ภายนอก (url) */
export type SubmissionFile = { path?: string; url?: string; name: string; size?: number; type?: string };

export const isLink = (f: SubmissionFile) => !!f.url;
export const itemKey = (f: SubmissionFile) => f.path ?? f.url ?? f.name;
export const storedPaths = (files: SubmissionFile[]) => files.map((f) => f.path).filter((p): p is string => !!p);

/** เติม https:// ให้ถ้าไม่มี — คืน null ถ้าไม่ใช่ลิงก์ */
export function normalizeUrl(text: string): string | null {
  const t = text.trim();
  if (!t || /\s/.test(t)) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

/** ชื่อบริการจากลิงก์ เช่น Google Drive, Canva */
export function linkLabel(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "ลิงก์";
  }
  if (host === "drive.google.com") return "Google Drive";
  if (host === "docs.google.com") return /\/spreadsheets\//.test(url) ? "Google Sheets" : /\/presentation\//.test(url) ? "Google Slides" : "Google Docs";
  if (host.endsWith("canva.com")) return "Canva";
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "YouTube";
  if (host.endsWith("onedrive.live.com") || host.endsWith("sharepoint.com") || host === "1drv.ms") return "OneDrive";
  return host;
}

export type SubmissionStatus = "submitted" | "returned" | "graded" | "missing";

export type HistoryEntry = {
  attempt: number;
  files: SubmissionFile[];
  note: string | null;
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
  returned_at: string | null;
};

export type Submission = {
  id: string;
  assignment_id: string;
  enrollment_id: string;
  status: SubmissionStatus;
  files: SubmissionFile[];
  note: string | null;
  submitted_at: string | null;
  attempt: number;
  score: number | null;
  feedback: string | null;
  graded_at: string | null;
  history: HistoryEntry[];
};

export const BUCKET = "submissions";
/** ไฟล์ที่ครูแนบให้นักเรียน */
export const ATTACH_BUCKET = "assignment-files";
export const MAX_ATTACH_BYTES = 20 * 1024 * 1024;
/** พื้นที่เก็บไฟล์ของ Supabase แผนฟรี (รวมทุก bucket ไม่ใช่รายเดือน) */
export const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024;

export const ATTACH_ACCEPT =
  "application/pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx";

/** ไฟล์ที่ครูแนบ: รูปย่อเหมือนงานนักเรียน เอกสารอื่นส่งตามเดิม (ไม่เกิน 20 MB) */
export async function prepareAttachment(file: File): Promise<PreparedFile> {
  if (file.type.startsWith("image/")) return prepareFile(file);
  if (file.size > MAX_ATTACH_BYTES) throw new Error(`ไฟล์ ${file.name} ใหญ่เกิน 20 MB — อัปโหลดขึ้น Google Drive แล้วแนบเป็นลิงก์แทน`);
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "bin").toLowerCase();
  return { blob: file, name: file.name, type: file.type || "application/octet-stream", ext };
}

export function attachmentPath(assignmentId: string, ext: string): string {
  return `${assignmentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

/** ช่องคะแนนที่ผูกได้ — แสดงเป็น "หน่วยที่ 1 … · P (10)" */
export type ComponentOption = { id: string; label: string };

export function componentOptions(
  units: { id: string; title: string; sort_order: number }[],
  components: { id: string; unit_id: string; category: "K" | "P" | "A"; max_score: number }[]
): ComponentOption[] {
  const order = { K: 0, P: 1, A: 2 } as const;
  return [...units]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((u) =>
      components
        .filter((c) => c.unit_id === u.id)
        .sort((a, b) => order[a.category] - order[b.category])
        .map((c) => ({ id: c.id, label: `${u.title} · ${c.category} (เต็ม ${Number(c.max_score)})` }))
    );
}

// ---------------------------------------------------------------------------
// เวลา
// ---------------------------------------------------------------------------
export function formatDue(iso: string | null): string {
  if (!iso) return "ไม่กำหนดส่ง";
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "ส่งช้า 2 วัน" / "ส่งช้า 3 ชม." — null = ไม่ช้า */
export function lateText(submittedAt: string | null, dueAt: string | null): string | null {
  if (!submittedAt || !dueAt) return null;
  const ms = new Date(submittedAt).getTime() - new Date(dueAt).getTime();
  if (ms <= 0) return null;
  const hours = ms / 3_600_000;
  if (hours < 1) return "ส่งช้า ไม่ถึง 1 ชม.";
  if (hours < 24) return `ส่งช้า ${Math.floor(hours)} ชม.`;
  return `ส่งช้า ${Math.floor(hours / 24)} วัน`;
}

/** เหลือเวลาอีกเท่าไร — สำหรับนักเรียน */
export function dueCountdown(dueAt: string | null, now = Date.now()): { text: string; overdue: boolean; soon: boolean } | null {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - now;
  if (ms <= 0) return { text: "เลยกำหนดส่งแล้ว", overdue: true, soon: false };
  const hours = ms / 3_600_000;
  if (hours < 1) return { text: `เหลืออีก ${Math.max(1, Math.floor(ms / 60_000))} นาที`, overdue: false, soon: true };
  if (hours < 24) return { text: `เหลืออีก ${Math.floor(hours)} ชม.`, overdue: false, soon: true };
  return { text: `เหลืออีก ${Math.floor(hours / 24)} วัน`, overdue: false, soon: hours < 48 };
}

/** ค่าในช่อง <input type="datetime-local"> ↔ ISO */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

// ---------------------------------------------------------------------------
// สถานะ (ป้ายสีจุดแบบเดียวกับหน้านักเรียน)
// ---------------------------------------------------------------------------
export type StatusKey = SubmissionStatus | "none";

export const STATUS_LABEL: Record<StatusKey, string> = {
  none: "ยังไม่ส่ง",
  submitted: "รอตรวจ",
  returned: "ส่งคืนให้แก้",
  graded: "ตรวจแล้ว",
  missing: "ไม่ส่ง (0)",
};

export const STATUS_DOT: Record<StatusKey, string> = {
  none: "bg-slate-300",
  submitted: "bg-trace-yellow",
  returned: "bg-trace-magenta",
  graded: "bg-trace-lime",
  missing: "bg-[var(--c-red-500)]",
};

// ---------------------------------------------------------------------------
// เตรียมไฟล์: ย่อรูปจากกล้องมือถือ (หลาย MB) ให้เหลือราว 200–400 KB
// พื้นที่เก็บไฟล์ฟรีมี 1 GB ต่อทั้งระบบ — รูปเต็มขนาดจะเต็มภายในเทอมเดียว
// ---------------------------------------------------------------------------
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.78;
export const MAX_PDF_BYTES = 8 * 1024 * 1024;

export type PreparedFile = { blob: Blob; name: string; type: string; ext: string };

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function prepareFile(file: File): Promise<PreparedFile> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new Error(`ไฟล์ ${file.name} ใหญ่เกิน 8 MB`);
    return { blob: file, name: file.name, type: file.type, ext: "pdf" };
  }
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
    throw new Error(`ไฟล์ ${file.name} ไม่ใช่รูปหรือ PDF`);
  }
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    throw new Error(`เปิดรูป ${file.name} ไม่ได้ ลองถ่ายใหม่หรือบันทึกเป็น JPG`);
  }
  const w = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h = "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  // พื้นขาว — PNG โปร่งใสจะได้ไม่กลายเป็นพื้นดำ
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error(`ย่อรูป ${file.name} ไม่สำเร็จ`);
  const base = file.name.replace(/\.[^.]+$/, "") || "รูป";
  return { blob, name: `${base}.jpg`, type: "image/jpeg", ext: "jpg" };
}

export function newFilePath(assignmentId: string, enrollmentId: string, ext: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${assignmentId}/${enrollmentId}/${Date.now()}-${rand}.${ext}`;
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
