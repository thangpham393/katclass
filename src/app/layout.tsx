import type { Metadata } from "next";
import { Be_Vietnam_Pro, Noto_Serif_SC } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});
const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  variable: "--font-zh",
  display: "swap",
  weight: ["400", "600", "900"],
});

export const metadata: Metadata = {
  title: "KAT CLASS · Học tiếng Trung thông minh",
  description:
    "Nền tảng học và quản lý trung tâm tiếng Trung của KAT Education — lớp học, điểm danh, từ vựng, flashcard, bài tập về nhà.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${notoSerifSC.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
