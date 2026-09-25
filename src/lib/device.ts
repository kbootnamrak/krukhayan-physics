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

/**
 * รุ่นเครื่องจาก User-Agent Client Hints (Chrome/Edge/Samsung บน Android เช่น "SM-A546E")
 * Chrome ซ่อนรุ่นใน user agent ปกติแล้ว ต้องขอผ่านช่องทางนี้ · Safari/iPhone ไม่รองรับ → null
 */
export async function getDeviceModel(): Promise<string | null> {
  try {
    const uad = (navigator as Navigator & { userAgentData?: { getHighEntropyValues(h: string[]): Promise<{ model?: string }> } })
      .userAgentData;
    if (!uad) return null;
    const { model } = await uad.getHighEntropyValues(["model"]);
    return model?.trim() || null;
  } catch {
    return null;
  }
}

/** เดายี่ห้อจากรหัสรุ่นที่พบบ่อยในไทย เพื่อให้ครูอ่านง่ายขึ้น */
function brandOf(model: string) {
  if (/^SM-|^Galaxy/i.test(model)) return "Samsung";
  if (/^CPH|^OPPO/i.test(model)) return "OPPO";
  if (/^RMX/i.test(model)) return "realme";
  if (/^V\d{4}|^vivo/i.test(model)) return "vivo";
  if (/^Redmi|^POCO|^M\d{4}|^\d{4,5}[A-Z]{2,}/i.test(model)) return "Xiaomi";
  if (/^Infinix|^X\d{3,4}/i.test(model)) return "Infinix";
  if (/^TECNO/i.test(model)) return "TECNO";
  if (/^Pixel/i.test(model)) return "Google";
  if (/^moto/i.test(model)) return "Motorola";
  if (/^HUAWEI|^[A-Z]{3}-L\d/i.test(model)) return "Huawei";
  return "";
}

export type DeviceEvent = {
  user_id: string;
  device_id: string;
  user_agent: string | null;
  ip: string | null;
  kind: "visit" | "quiz";
  quiz_id: string | null;
  at: string;
  device_model?: string | null;
};

/** "iPhone · Safari", "Android Samsung SM-A546E · Chrome", "Windows · Edge" … */
export function describeDevice(ua: string | null | undefined, model?: string | null): string {
  if (!ua) return model ? `${[brandOf(model), model].filter(Boolean).join(" ")}` : "ไม่ทราบเครื่อง";
  let device = "อุปกรณ์อื่น";
  if (/iPhone/i.test(ua)) device = "iPhone";
  else if (/iPad/i.test(ua)) device = "iPad";
  else if (/Android/i.test(ua)) {
    // รุ่นจาก Client Hints ก่อน · ถ้าไม่มี ลองอ่านจาก user agent (เบราว์เซอร์เก่าที่ยังไม่ซ่อน)
    const fromUa = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/i)?.[1]?.trim();
    const m = model || (fromUa && fromUa !== "K" ? fromUa : null);
    device = m ? `Android ${[brandOf(m), m].filter(Boolean).join(" ")}` : "Android (ไม่ทราบรุ่น)";
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
