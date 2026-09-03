import Link from "next/link";
import { ArrowRight, Hammer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Trang chức năng ĐÃ CÓ TRONG MENU NHƯNG CHƯA XÂY XONG.
 *
 * Menu dựng sẵn theo bản thiết kế đầy đủ rồi mới làm dần từng chức năng, nên
 * phải có chỗ đáp cho những mục chưa tới lượt — bấm vào thấy trang trắng hay
 * lỗi 404 thì người dùng tưởng phần mềm hỏng. Trang này nói rõ mục đó sẽ làm
 * gì, và chỉ sang chỗ đang tạm làm việc đó nếu có.
 */
export function ComingSoon({
  title,
  description,
  plan,
  fallback,
}: {
  title: string;
  description: string;
  /** Các việc mục này sẽ làm được khi hoàn thiện. */
  plan?: string[];
  /** Trang hiện đang gánh việc này, nếu có. */
  fallback?: { href: string; label: string };
}) {
  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold-50 text-gold-600">
          <Hammer className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-xl font-extrabold tracking-tight">{title}</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>

        {plan && plan.length > 0 && (
          <div className="mt-5 max-w-2xl rounded-xl border bg-secondary/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              Khi hoàn thiện sẽ làm được
            </div>
            <ul className="mt-2 space-y-1.5">
              {plan.map((p) => (
                <li key={p} className="flex gap-2 text-sm">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {fallback && (
          <Link
            href={fallback.href}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            {fallback.label} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
