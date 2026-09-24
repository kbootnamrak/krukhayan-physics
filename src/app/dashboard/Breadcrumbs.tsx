import Link from "next/link";

/**
 * ลิงก์ย้อนกลับด้านบนของหน้า เช่น หน้าหลัก › รายวิชาของฉัน › ฟิสิกส์ 5
 * เดิมหน้าในส่วนนี้ไม่มีทางกลับเลย ต้องกดปุ่ม Back ของเบราว์เซอร์เอง
 */
export default function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="ตำแหน่งของหน้านี้" className="text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && <span aria-hidden className="text-slate-300">›</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-slate-800 hover:underline truncate">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-slate-700 truncate">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
