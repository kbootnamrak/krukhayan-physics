/**
 * รหัสประจำเครื่อง + อ่านชนิดเครื่องจาก user agent
 * ใช้ช่วยครูสังเกตว่าเครื่องเดียวกันถูกใช้ล็อกอิน/ทำแบบทดสอบด้วยบัญชีนักเรียนหลายคน
 * (ดู migration device_log) — เป็นสัญญาณให้ครูตรวจต่อ ไม่ใช่หลักฐานเด็ดขาด
 */

const KEY = "kk-device-id";

/** รหัสสุ่มที่เก็บไว้ในเบราว์เซอร์นี้ (สร้างครั้งแรกที่เรียก) — คืน null ถ้าเบราว์เซอร์ไม่ยอมให้เก็บ */
export function getDeviceId(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export type DeviceEvent = {
  user_id: string;
  device_id: string;
  user_agent: string | null;
  ip: string | null;
  kind: "visit" | "quiz";
  quiz_id: string | null;
  at: string;
};

/** "iPhone · Safari", "Android SM-A546E · Chrome", "Windows · Edge" … */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return "ไม่ทราบเครื่อง";
  let device = "อุปกรณ์อื่น";
  if (/iPhone/i.test(ua)) device = "iPhone";
  else if (/iPad/i.test(ua)) device = "iPad";
  else if (/Android/i.test(ua)) {
    const model = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/i)?.[1]?.trim();
    device = model && model !== "K" ? `Android ${model}` : "Android";
  } else if (/Windows/i.test(ua)) device = "Windows";
  else if (/Macintosh|Mac OS X/i.test(ua)) device = "Mac";
  else if (/CrOS/i.test(ua)) device = "Chromebook";

  let browser = "";
  if (/Line\//i.test(ua)) browser = "ในแอป LINE";
  else if (/FBAN|FBAV/i.test(ua)) browser = "ในแอป Facebook";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Firefox|FxiOS/i.test(ua)) browser = "Firefox";
  else if (/Chrome|CriOS/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua)) browser = "Safari";

  return browser ? `${device} · ${browser}` : device;
}
