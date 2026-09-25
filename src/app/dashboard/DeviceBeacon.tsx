"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDeviceId, getDeviceModel } from "@/lib/device";

/**
 * บันทึกว่านักเรียนเข้าเว็บจากเครื่องไหน (ฐานข้อมูลบันทึกไม่เกินชั่วโมงละครั้งต่อเครื่อง
 * และไม่บันทึกของครู) — ครูดูได้ในแท็บนักเรียน
 */
export default function DeviceBeacon() {
  useEffect(() => {
    const id = getDeviceId();
    if (!id) return;
    const timer = setTimeout(async () => {
      const model = await getDeviceModel();
      createClient()
        .rpc("log_device", { p_device: id, p_kind: "visit", p_model: model })
        .then(() => undefined, () => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
