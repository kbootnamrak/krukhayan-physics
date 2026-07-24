import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KruKhayan Physics",
  description: "เว็บไซต์จัดการเรียนการสอนวิชาฟิสิกส์ - ครูขยัน",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
