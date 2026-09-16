import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * แจ้งเตือนผ่าน LINE Messaging API (push message)
 *
 * หมายเหตุสำคัญ: LINE Notify ปิดให้บริการไปแล้วเมื่อ 31 มี.ค. 2568 ระบบนี้จึงใช้
 * LINE Messaging API แทน — ต้องสร้าง Messaging API channel ใน LINE Developers
 * Console แล้วเก็บ channel access token / channel secret ไว้ใน environment variable
 * ดูขั้นตอนใน docs/iot/README.md
 */
const PUSH_URL = "https://api.line.me/v2/bot/message/push";

export type PushResult = { ok: boolean; error?: string };

export function lineConfigured() {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

export async function pushLineText(
  to: string,
  text: string,
  retryKey?: string
): Promise<PushResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  // LINE ใช้ค่านี้กันข้อความซ้ำเวลาเรา retry คำขอเดิม
  if (retryKey) headers["X-Line-Retry-Key"] = retryKey;

  try {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `LINE ตอบกลับ ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** ตรวจลายเซ็นของ webhook จาก LINE — ถ้าไม่ตรง แปลว่าคำขอไม่ได้มาจาก LINE */
export function verifyLineSignature(rawBody: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const BANGKOK_TIME = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "short",
  timeStyle: "short",
});

const ICON: Record<string, string> = {
  high: "🔴",
  low: "🔵",
  recovered: "✅",
  offline: "⚠️",
  online: "✅",
};

export function buildAlertMessage(params: {
  kind: string;
  deviceName: string;
  location: string | null;
  detail: string;
  at: Date;
  dashboardUrl?: string;
}) {
  const where = params.location ? `${params.deviceName} (${params.location})` : params.deviceName;
  const lines = [
    `${ICON[params.kind] ?? "ℹ️"} ${where}`,
    params.detail,
    `เวลา ${BANGKOK_TIME.format(params.at)} น.`,
  ];
  if (params.dashboardUrl) lines.push(params.dashboardUrl);
  return lines.join("\n");
}

const REPLY_URL = "https://api.line.me/v2/bot/message/reply";

export async function replyLineText(replyToken: string, text: string): Promise<PushResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" };

  try {
    const res = await fetch(REPLY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `LINE ตอบกลับ ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** ดึงชื่อที่แสดงของผู้ใช้ LINE ไว้ใช้เป็น label ในหน้าจัดการผู้รับแจ้งเตือน */
export async function getLineDisplayName(userId: string): Promise<string | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { displayName?: string };
    return data.displayName ?? null;
  } catch {
    return null;
  }
}
