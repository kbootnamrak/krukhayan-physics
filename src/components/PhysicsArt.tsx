/**
 * ภาพตกแต่งแนวฟิสิกส์ + ไซเบอร์พังค์ วาดเป็น SVG ทั้งหมด (ไม่มีไฟล์ภาพ โหลดเร็วบนมือถือ)
 * สีมาจากโทเคน --trace-* ใน globals.css จึงเปลี่ยนตามธีมมืด/สว่างเอง
 * ภาพเป็นของตกแต่งล้วน ๆ — ทุกชิ้นใส่ aria-hidden
 */

const M = "var(--trace-magenta)";
const C = "var(--trace-cyan)";
const Y = "var(--trace-yellow)";
const L = "var(--trace-lime)";
const INK = "var(--porcelain)";

// คลื่นทำจากครึ่งคาบต่อกัน (ครึ่งคาบละ 60 → ความยาวคลื่น 120) ยาวพอเลื่อนได้หนึ่งคาบโดยไม่เห็นปลาย
const halfWaves = (n: number, half: number) => Array.from({ length: n }, () => `t ${half} 0`).join(" ");
const WAVE_E = `q 30 -44 60 0 ${halfWaves(13, 60)}`;
const WAVE_B = `q 30 18 60 0 ${halfWaves(13, 60)}`;
const BANNER_WAVE_E = `q 25 -40 50 0 ${halfWaves(12, 50)}`;
const BANNER_WAVE_B = `q 25 16 50 0 ${halfWaves(12, 50)}`;

/** ฟิลเตอร์แสงเรืองแบบหลอดนีออน — ธีมสว่างปิดด้วย .neon-off */
function NeonFilter({ id }: { id: string }) {
  return (
    <defs>
      <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3.2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/**
 * ภาพใหญ่หน้าเข้าสู่ระบบ: แท่งแม่เหล็กกับเส้นสนาม, คลื่นแม่เหล็กไฟฟ้า, วงจร และสมการของฟิสิกส์ ม.ปลาย
 * มีสัญญาณวิ่งไปตามลายวงจรเป็นภาพเคลื่อนไหวเดียวของหน้า (ปิดเมื่อผู้ใช้ขอลดการเคลื่อนไหว)
 */
export function PhysicsHero({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 560" className={className} aria-hidden fill="none">
      <NeonFilter id="hero-neon" />

      {/* ลายวงจรพื้นหลัง */}
      <g stroke={INK} strokeOpacity="0.14" strokeWidth="2" strokeLinecap="square">
        <path d="M0 64h120l40 40h180" />
        <path d="M640 120H520l-32-32H400" />
        <path d="M24 520V420l40-40h96" />
        <path d="M616 540V440l-40-40h-80" />
        <path d="M300 0v40l24 24v40" />
      </g>
      <g fill={INK} fillOpacity="0.22">
        <circle cx="340" cy="104" r="5" />
        <circle cx="400" cy="88" r="5" />
        <circle cx="160" cy="380" r="5" />
        <circle cx="496" cy="400" r="5" />
        <circle cx="324" cy="104" r="3" />
      </g>

      {/* สนามแม่เหล็ก: เส้นสนามออกจาก N วนเข้า S */}
      <g filter="url(#hero-neon)" className="neon-soft" strokeWidth="2.2">
        {[40, 72, 108, 150].map((r, i) => (
          <g key={r} stroke={i % 2 ? C : M}>
            {/* เส้นสนามจาง ๆ เป็นราง + จุดแสงไหลจาก N ไป S ตามทิศของสนาม (แบบกระแสในสายไฟ) */}
            <g strokeOpacity={0.35 - i * 0.05}>
              <path d={`M232 260 C 232 ${260 - r * 1.25}, 408 ${260 - r * 1.25}, 408 260`} />
              <path d={`M232 300 C 232 ${300 + r * 1.25}, 408 ${300 + r * 1.25}, 408 300`} />
            </g>
            <g strokeOpacity={0.95 - i * 0.12} strokeWidth="2.6" strokeLinecap="round" className="field-flow" style={{ animationDuration: `${1.4 + i * 0.35}s` }}>
              <path d={`M232 260 C 232 ${260 - r * 1.25}, 408 ${260 - r * 1.25}, 408 260`} />
              <path d={`M232 300 C 232 ${300 + r * 1.25}, 408 ${300 + r * 1.25}, 408 300`} />
            </g>
          </g>
        ))}
        {/* หัวลูกศรบอกทิศของสนาม (จาก N ไป S ด้านนอกแท่ง) */}
        <path d="M314 229l10 -6l-10 -6" stroke={M} />
        <path d="M314 331l10 6l-10 6" stroke={C} />
      </g>

      {/* แท่งแม่เหล็ก */}
      <g>
        <rect x="232" y="256" width="88" height="48" rx="3" fill={M} />
        <rect x="320" y="256" width="88" height="48" rx="3" fill={C} />
        <text x="276" y="289" textAnchor="middle" className="font-display" fontSize="24" fontWeight="700" fill="white">
          N
        </text>
        <text x="364" y="289" textAnchor="middle" className="font-display" fontSize="24" fontWeight="700" fill="var(--sign-ink)">
          S
        </text>
      </g>

      {/* คลื่นแม่เหล็กไฟฟ้า: E (เหลือง) กับ B (เขียวมะนาว) ตั้งฉากกัน เคลื่อนที่ไปทางขวา */}
      <defs>
        <clipPath id="hero-wave-clip">
          <rect x="36" y="410" width="584" height="100" />
        </clipPath>
      </defs>
      <g filter="url(#hero-neon)" className="neon-soft" strokeWidth="2.4" strokeLinecap="round">
        <g clipPath="url(#hero-wave-clip)">
          {/* เส้นยาวเกินกรอบไปหนึ่งความยาวคลื่น แล้วเลื่อนทีละหนึ่งความยาวคลื่น (120) วนไปเรื่อย ๆ */}
          <g className="wave-travel">
            <path d={`M-80 470 ${WAVE_E}`} stroke={Y} />
            <path d={`M-80 470 ${WAVE_B}`} stroke={L} strokeOpacity="0.8" />
          </g>
        </g>
        <path d="M32 470h588" stroke={INK} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="4 6" />
      </g>

      {/* วงจร: แบตเตอรี่ ตัวต้านทาน ตัวเก็บประจุ บนลายทองแดง */}
      <g stroke={C} strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M456 176h40l12 -12l12 24l12 -24l12 24l12 -24l12 24l6 -12h34v72h-52" />
        <path d="M562 248v-14m0 28v14" />
        <path d="M548 234h28M548 262h28" />
        <path d="M510 248h-54v-72" />
        <path d="M476 240v16M486 234v28" stroke={Y} />
      </g>
      <g fill={C}>
        <circle cx="456" cy="176" r="5" />
        <circle cx="604" cy="176" r="5" />
      </g>
      {/* สัญญาณวิ่งไปตามลายวงจร */}
      <path
        d="M456 176h40l12 -12l12 24l12 -24l12 24l12 -24l12 24l6 -12h34v72h-52"
        stroke={Y}
        strokeWidth="3"
        strokeLinecap="round"
        pathLength={100}
        className="signal-pulse"
        filter="url(#hero-neon)"
      />

      {/* สมการ */}
      <g className="font-display" fontWeight="600">
        <text x="40" y="150" fontSize="26" fill={M}>
          F = qvB sin θ
        </text>
        <text x="440" y="324" fontSize="24" fill={C}>
          ε = −dΦ/dt
        </text>
        <text x="60" y="380" fontSize="22" fill={Y}>
          PV = nRT
        </text>
        <text x="470" y="96" fontSize="20" fill={L}>
          P = ρgh
        </text>
        <text x="190" y="46" fontSize="18" fill={INK} fillOpacity="0.55">
          c = fλ
        </text>
      </g>
    </svg>
  );
}

/** แถบภาพกว้างสำหรับหัวหน้าหลัก — ความเข้มกลาง ๆ วางหลังคำทักทาย */
export function PhysicsBanner({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 960 200" preserveAspectRatio="xMaxYMid slice" className={className} aria-hidden fill="none">
      <NeonFilter id="banner-neon" />
      <defs>
        <clipPath id="banner-wave-clip">
          <rect x="520" y="90" width="440" height="70" />
        </clipPath>
      </defs>
      <g stroke={INK} strokeOpacity="0.12" strokeWidth="2" strokeLinecap="square">
        <path d="M420 0v40l30 30h140l30 -30V0" />
        <path d="M960 150H840l-30 30H700" />
        <path d="M380 200v-40l24 -24h100" />
      </g>
      <g fill={INK} fillOpacity="0.2">
        <circle cx="590" cy="70" r="5" />
        <circle cx="700" cy="180" r="5" />
        <circle cx="504" cy="136" r="5" />
      </g>
      <g filter="url(#banner-neon)" className="neon-soft" strokeWidth="2.2" strokeLinecap="round">
        <g clipPath="url(#banner-wave-clip)">
          <g className="wave-travel wave-travel-100">
            <path d={`M420 128 ${BANNER_WAVE_E}`} stroke={Y} />
            <path d={`M420 128 ${BANNER_WAVE_B}`} stroke={L} strokeOpacity="0.75" />
          </g>
        </g>
        {[26, 46, 70].map((r, i) => (
          <g key={r} stroke={i % 2 ? C : M}>
            <path d={`M700 78 C 700 ${78 - r}, 820 ${78 - r}, 820 78`} strokeOpacity={0.3} />
            <path
              d={`M700 78 C 700 ${78 - r}, 820 ${78 - r}, 820 78`}
              strokeOpacity={0.9 - i * 0.2}
              className="field-flow"
              style={{ animationDuration: `${1.3 + i * 0.35}s` }}
            />
          </g>
        ))}
      </g>
      <rect x="700" y="70" width="60" height="18" rx="2" fill={M} />
      <rect x="760" y="70" width="60" height="18" rx="2" fill={C} />
      <g className="font-display" fontWeight="600">
        <text x="600" y="176" fontSize="20" fill={C}>
          ε = −dΦ/dt
        </text>
        <text x="840" y="176" fontSize="18" fill={M}>
          F = qvB
        </text>
      </g>
    </svg>
  );
}

/**
 * ไอคอนประจำหน่วยการเรียน เลือกจากคำในชื่อหน่วย
 * ไม่ตรงคำไหนเลยใช้รูปอะตอม
 */
export function UnitGlyph({ title, className = "size-5" }: { title: string; className?: string }) {
  const t = title;
  const common = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (/แม่เหล็ก|ไฟฟ้า/.test(t)) {
    // แม่เหล็กเกือกม้า + ประกายไฟ
    return (
      <svg {...common}>
        <path d="M6 4v8a6 6 0 0 0 12 0V4" />
        <path d="M6 4h3v8a3 3 0 0 0 6 0V4h3" />
        <path d="M6 7h3M15 7h3" />
      </svg>
    );
  }
  if (/ความร้อน|แก๊ส|อุณหภูมิ/.test(t)) {
    // เทอร์โมมิเตอร์ + โมเลกุลแก๊ส
    return (
      <svg {...common}>
        <path d="M9 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0Z" />
        <path d="M11 15v-4" />
        <circle cx="18" cy="6" r="1.4" />
        <circle cx="19.5" cy="12" r="1.1" />
        <circle cx="17" cy="17.5" r="1.3" />
      </svg>
    );
  }
  if (/ของไหล|ของแข็ง|ความดัน|ของเหลว/.test(t)) {
    // หยดน้ำบนผลึกลูกบาศก์
    return (
      <svg {...common}>
        <path d="M14 3.5s-4.5 5-4.5 8a4.5 4.5 0 0 0 9 0c0-3-4.5-8-4.5-8Z" />
        <path d="M3 15l3.5-2l3.5 2v4l-3.5 2L3 19Z" />
        <path d="M3 15l3.5 2l3.5-2M6.5 17v4" />
      </svg>
    );
  }
  if (/คลื่น|แสง|เสียง/.test(t)) {
    return (
      <svg {...common}>
        <path d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-4 5-2" />
      </svg>
    );
  }
  // อะตอม
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="9.5" ry="3.8" />
      <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(-60 12 12)" />
    </svg>
  );
}

/** สัญลักษณ์เว็บ: ชิปกลางแผ่นวงจร มีลายทองแดงสี่สีของสี่หน่วยวิ่งออกไป */
export function ChipMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={`${className} shrink-0`} aria-hidden fill="none" strokeWidth="2.4" strokeLinecap="square">
      <path d="M2 8h5l3 3" stroke={M} />
      <path d="M26 8h-5l-3 3" stroke={C} />
      <path d="M2 20h5l3-3" stroke={L} />
      <path d="M26 20h-5l-3-3" stroke={Y} />
      <rect x="9" y="9" width="10" height="10" rx="1.5" fill="var(--c-slate-50)" stroke={INK} strokeWidth="2.2" />
      <circle cx="14" cy="14" r="1.6" fill={INK} />
    </svg>
  );
}
