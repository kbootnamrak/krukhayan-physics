import type { MetadataRoute } from "next";

/**
 * ข้อมูลตอน "เพิ่มลงหน้าจอหลัก" / ติดตั้งเป็นแอปบนมือถือ
 * ไอคอนเป็นอะตอมนีออนบนพื้นกรมท่า (ต้นฉบับ SVG เก็บที่ public/icon.svg)
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KruKhayan Physics — ห้องเรียนฟิสิกส์ของครูขยัน",
    short_name: "ครูขยัน ฟิสิกส์",
    description: "คะแนน สื่อการสอน แบบทดสอบ และข้อมูลจากเครื่องวัดจริง",
    // id คงค่าเดิม (เดิมคิดจาก start_url "/dashboard") — แอปที่ติดตั้งไว้แล้วจะอัปเดตเป็นตัวเดิม ไม่กลายเป็นแอปใหม่
    id: "/dashboard",
    // เปิดที่หน้าเปิดแอป (static) ให้อะตอมขยับได้ทันที แล้วค่อยไปหน้าหลัก — ดู src/app/launch
    start_url: "/launch",
    display: "standalone",
    background_color: "#0b1330",
    theme_color: "#0b1330",
    lang: "th",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // พื้นเต็มกรอบ และลายสำคัญอยู่ในวงกลางปลอดภัย → Android ตัดเป็นวงกลม/สี่เหลี่ยมมนได้ไม่เสีย
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
