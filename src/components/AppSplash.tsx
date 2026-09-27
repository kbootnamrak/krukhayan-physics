"use client";

import { useEffect, useRef, useState } from "react";

// วงโคจรเดียวกับไอคอนแอป (public/icon.svg): วงรี rx 172 ry 66 รอบจุด 256,256 หมุน 0° / 60° / -60°
const ORBIT = "M84,256 a172,66 0 1,0 344,0 a172,66 0 1,0 -344,0";
const ORBITS = [
  { rotate: 0, color: "#ff3fb4", dur: "1.5s", begin: "0s" },
  { rotate: 60, color: "#4fe3ff", dur: "1.9s", begin: "-0.6s" },
  { rotate: -60, color: "#9dff5c", dur: "2.3s", begin: "-1.3s" },
];

/** อยู่อย่างน้อยเท่านี้ ให้เห็นอิเล็กตรอนวิ่งสักรอบ แม้หน้าโหลดเสร็จเร็ว */
const MIN_MS = 1100;

/**
 * หน้าเปิดแอปแบบอะตอมเคลื่อนไหว — แสดงเฉพาะตอนเปิดจากไอคอนบนหน้าจอหลัก (display-mode: standalone)
 *
 * หน้าเปิดแรกสุดของมือถือ (ไอคอนนิ่งบนพื้นกรมท่า) ระบบปฏิบัติการวาดเอง ทำให้ขยับไม่ได้
 * หน้านี้จึงวาดอะตอมตัวเดียวกัน ตำแหน่งเดียวกัน บนพื้นสีเดียวกัน ต่อทันที แล้วให้อิเล็กตรอนเริ่มวิ่ง
 * เห็นเหมือนโลโก้มีชีวิตขึ้นมา จากนั้นจางหายเข้าหน้าเว็บ
 *
 * - เปิดแท็บในเบราว์เซอร์ปกติไม่แสดง (CSS ซ่อนไว้)
 * - แสดงครั้งเดียวต่อการเปิดแอป (ตั้ง data-splashed ที่ <html> ก่อนหน้าแสดงผล — ดูสคริปต์ธีมใน layout)
 * - ถ้า JavaScript ไม่ทำงาน CSS จางหน้านี้ออกเองใน 4 วินาที ไม่บังหน้าเว็บค้าง
 */
export default function AppSplash() {
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!standalone || document.documentElement.dataset.splashed) {
      const t = setTimeout(() => setPhase("gone"), 0);
      return () => clearTimeout(t);
    }
    // ผู้ที่ตั้งลดการเคลื่อนไหว: อะตอมนิ่ง (SMIL ไม่ฟัง CSS prefers-reduced-motion ต้องหยุดเอง)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) svg.current?.pauseAnimations();

    const started = performance.now();
    let leave: ReturnType<typeof setTimeout>;
    let gone: ReturnType<typeof setTimeout>;
    const finish = () => {
      leave = setTimeout(() => {
        setPhase("leaving");
        try {
          sessionStorage.setItem("splashed", "1");
        } catch {}
        gone = setTimeout(() => setPhase("gone"), 450);
      }, Math.max(0, MIN_MS - (performance.now() - started)));
    };
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    return () => {
      window.removeEventListener("load", finish);
      clearTimeout(leave);
      clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div aria-hidden className={`app-splash ${phase === "leaving" ? "is-leaving" : ""}`}>
      <svg ref={svg} viewBox="0 0 512 512" className="app-splash-atom">
        <defs>
          <filter id="splash-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* วงโคจร — เหมือนไอคอนแอปทุกเส้น */}
        <g filter="url(#splash-glow)" fill="none" strokeWidth="18" strokeLinecap="round">
          {ORBITS.map((o) => (
            <ellipse key={o.rotate} cx="256" cy="256" rx="172" ry="66" stroke={o.color} transform={`rotate(${o.rotate} 256 256)`} />
          ))}
        </g>
        {/* อิเล็กตรอนวิ่งตามวง พร้อมหางแสงสั้น ๆ */}
        {ORBITS.map((o) => (
          <g key={o.rotate} transform={`rotate(${o.rotate} 256 256)`} filter="url(#splash-glow)">
            {[0.09, 0.05, 0].map((lag, i) => (
              <circle key={i} r={i === 2 ? 17 : 11 - i * 2} fill={i === 2 ? "#ffffff" : o.color} opacity={i === 2 ? 1 : 0.35 + i * 0.25}>
                <animateMotion
                  dur={o.dur}
                  begin={`${parseFloat(o.begin) - lag * parseFloat(o.dur)}s`}
                  repeatCount="indefinite"
                  path={ORBIT}
                />
              </circle>
            ))}
          </g>
        ))}
        {/* นิวเคลียส: หายใจเบา ๆ */}
        <g filter="url(#splash-glow)">
          <circle cx="256" cy="256" r="40" fill="#ffe14d">
            <animate attributeName="r" values="38;43;38" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
        <circle cx="244" cy="244" r="12" fill="#fff6b8" fillOpacity=".8" />
      </svg>
      <p className="app-splash-name">ครูขยัน ฟิสิกส์</p>
    </div>
  );
}
