import type { Metadata } from "next";
import { Anuphan, Barlow_Semi_Condensed, Chakra_Petch } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  variable: "--font-anuphan",
  display: "swap",
});

// หัวข้อและป้าย: ทรงเหลี่ยมแบบไซเบอร์พังค์ และมีตัวอักษรไทยในตัว
const chakra = Chakra_Petch({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra",
  display: "swap",
});

const barlow = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KruKhayan Physics",
  description: "เว็บไซต์จัดการเรียนการสอนวิชาฟิสิกส์ - ครูขยัน",
};

// ตั้งธีมก่อนหน้าแสดงผล กันหน้ากระพริบจากมืดเป็นสว่าง — ค่าเริ่มต้นคือธีมมืด
const THEME_SCRIPT = `try{if(localStorage.getItem("theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`h-full antialiased ${anuphan.variable} ${chakra.variable} ${barlow.variable}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        {/* beforeInteractive = ฝังใน HTML แรกจากเซิร์ฟเวอร์ ทำงานก่อนโค้ดของ Next */}
        <Script id="theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
