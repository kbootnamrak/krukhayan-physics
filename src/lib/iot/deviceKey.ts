import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX = "kkp_";

/** สร้าง device key ใหม่ — คืนคีย์จริง (แสดงครั้งเดียว) + hash ที่เก็บลงฐานข้อมูล */
export function createDeviceKey() {
  const key = KEY_PREFIX + randomBytes(24).toString("base64url");
  return { key, keyHash: hashDeviceKey(key), keyPrefix: key.slice(0, 12) };
}

export function hashDeviceKey(key: string) {
  return createHash("sha256").update(key, "utf8").digest("hex");
}
