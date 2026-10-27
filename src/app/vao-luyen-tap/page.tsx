"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/brand/logo";

/** Cổng nhập mã học viên trước khi mở một bài trong /luyen-tap. */
export default function PracticeGatePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/practice-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Có lỗi xảy ra, thử lại sau.");
        setSubmitting(false);
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      // Bài là file HTML tĩnh → điều hướng cứng, không qua router của Next.
      window.location.href =
        next && next.startsWith("/luyen-tap/") ? next : "/luyen-tap/index.html";
    } catch {
      setError("Không kết nối được máy chủ, thử lại sau.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 md:p-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 inline-block">
          <Logo />
        </Link>

        <h1 className="text-2xl font-extrabold tracking-tight">Vào làm bài</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Nhập mã học viên do KAT Education cấp để bắt đầu luyện tập.
        </p>

        {error && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2.5 text-sm text-gold-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium" htmlFor="practice-code">Mã học viên</label>
            <Input
              id="practice-code"
              placeholder="HVKAT00123"
              className="mt-1.5 font-mono tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Chỉ cần nhập một lần — máy này sẽ nhớ mã trong 30 ngày.
            </p>
          </div>
          <Button className="w-full" size="lg" type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Bắt đầu làm bài
          </Button>
        </form>

        <p className="mt-10 text-center text-sm">
          <a href="/luyen-tap/index.html" className="text-muted-foreground hover:text-foreground">
            ← Quay lại danh sách bài
          </a>
        </p>
      </div>
    </div>
  );
}
