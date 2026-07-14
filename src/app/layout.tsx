import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const notoSC = Noto_Sans_SC({ subsets: ["latin"], variable: "--font-zh", display: "swap", weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "KAT CLASS · Học tiếng Trung thông minh",
  description:
    "Nền tảng học và ôn tập tiếng Trung của KAT Education — quản lý lớp, từ vựng, flashcard, quiz, bài tập về nhà.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} ${jakarta.variable} ${notoSC.variable}`}>
      <body>{children}</body>
    </html>
  );
}
