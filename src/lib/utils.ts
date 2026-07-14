import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function relativeTime(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2419200, "week"],
    [29030400, "month"],
    [Infinity, "year"],
  ];
  let div = 1;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [limit, u] of units) {
    if (abs < limit) {
      unit = u;
      break;
    }
    div = limit;
  }
  const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
  return rtf.format(Math.round(diff / (div === 1 ? 1 : div / 60)), unit);
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(-2)
    .join("")
    .toUpperCase();
}

export function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}
