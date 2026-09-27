"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// สิ่งที่กดได้ทั้งเว็บ — ปุ่มที่ปิดอยู่ (disabled) ไม่เรืองแสง
const PRESSABLE = 'a[href], button:not(:disabled), [role="tab"], summary, label:has(> input[type="file"])';

/**
 * เอฟเฟกต์ตอนกดทั้งเว็บ (ครูบอกว่ากดเมนูแล้วไม่รู้สึกว่ากด)
 * - กดปุ่ม/ลิงก์/เมนูใด ๆ: ขอบวาบแสงนีออนแล้วจางลง (ดู [data-zap] ใน globals.css)
 * - กดลิงก์ไปหน้าอื่น: เส้นกระแสไฟวิ่งที่ขอบบนจอจนหน้าใหม่ขึ้น — รู้ว่าระบบรับการกดแล้ว แม้เน็ตช้า
 * วางครั้งเดียวใน layout หลัก ไม่ต้องแก้ทีละปุ่ม
 */
export default function PressFx() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const fromPath = useRef(pathname);

  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (e.button !== 0) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(PRESSABLE);
      if (!el) return;
      // เล่นใหม่ทุกครั้งที่กด แม้กดซ้ำเร็ว ๆ
      el.removeAttribute("data-zap");
      void el.offsetWidth;
      el.setAttribute("data-zap", "");
      const done = () => el.removeAttribute("data-zap");
      el.addEventListener("animationend", done, { once: true });
      setTimeout(done, 900);
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // ลิงก์ไปหน้าเดิม (หรือแค่ #) ไม่มีการโหลด
      if (url.pathname === location.pathname) return;
      fromPath.current = location.pathname;
      setLoading(true);
    }

    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("click", onClick);
    };
  }, []);

  // หน้าใหม่ขึ้นแล้ว (pathname เปลี่ยน) หรือรอนานเกิน — ปิดเส้นกระแส
  useEffect(() => {
    if (!loading) return;
    if (pathname !== fromPath.current) {
      const t = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLoading(false), 10000);
    return () => clearTimeout(t);
  }, [loading, pathname]);

  return <div aria-hidden className={`nav-surge ${loading ? "is-on" : ""}`} />;
}
