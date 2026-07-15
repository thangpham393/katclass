import { cn } from "@/lib/utils";

/** Khối skeleton nhấp nháy khi chờ dữ liệu. */
export function LoadingRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 p-5", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="m-5 rounded-lg border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">
      {message}
    </div>
  );
}
