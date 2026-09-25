import { Fragment } from "react";

/**
 * แสดงข้อความโจทย์/ตัวเลือก พร้อมตัวยกและตัวห้อยแบบง่าย ๆ สำหรับสูตรฟิสิกส์
 *   ^2 หรือ ^{-19}  → ตัวยก     เช่น 10^{-19}, m^2
 *   _{g}            → ตัวห้อย   เช่น P_{g}
 * ขึ้นบรรทัดใหม่ในโจทย์ได้ตามที่พิมพ์
 */
const TOKEN = /\^\{([^}]*)\}|\^(-?[0-9A-Za-z.]+)|_\{([^}]*)\}/g;

function renderLine(line: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (m.index > last) out.push(line.slice(last, m.index));
    if (m[3] !== undefined) out.push(<sub key={i++}>{m[3]}</sub>);
    else out.push(<sup key={i++}>{m[1] ?? m[2]}</sup>);
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export default function QuizText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {renderLine(line)}
        </Fragment>
      ))}
    </span>
  );
}
