/**
 * Bóc tách lịch tuần từ TÊN lớp — dữ liệu import cũ ghi lịch ngay trong tên,
 * vd: "HSK1 T3,5 (17h30-19h00)", "YCT2 T7,CN (14h00-15h30)", "Giao tiếp T2,4,6 (16:00-17:30)".
 * Trả về null nếu không nhận diện được cả thứ lẫn giờ.
 */

export interface ParsedSchedule {
  /** 0 = CN, 1 = T2 ... 6 = T7 (khớp Date.getDay() và cột class_schedules.weekday) */
  weekdays: number[];
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
}

/** "17h30" / "17:30" / "17h" → "17:30" | "17:00"; null nếu không hợp lệ. */
function normalizeTime(hour: string, minute: string | undefined): string | null {
  const h = Number(hour);
  const m = Number(minute ?? "0");
  if (Number.isNaN(h) || h > 23 || Number.isNaN(m) || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseScheduleFromName(name: string): ParsedSchedule | null {
  // --- Khung giờ: "17h30-19h00", "16:00 - 17:30", "18h-19h30" ---
  const timeMatch = name.match(
    /(\d{1,2})\s*[h:](\d{2})?\s*(?:-|–|—|đến)\s*(\d{1,2})\s*[h:](\d{2})?/i,
  );
  if (!timeMatch) return null;
  const start = normalizeTime(timeMatch[1], timeMatch[2]);
  const end = normalizeTime(timeMatch[3], timeMatch[4]);
  if (!start || !end || end <= start) return null;

  // --- Thứ trong tuần: "T3,5" / "T7,CN" / "T2,4,6" / "CN" ---
  // Chỉ tìm trong phần TRƯỚC khung giờ để tránh nhầm số trong giờ.
  const head = name.slice(0, timeMatch.index);
  const dayChunk = head.match(/\b(?:T\s*[2-7]|CN)(?:\s*[,+\-&/]\s*(?:T?\s*[2-7]|CN))*/i);
  if (!dayChunk) return null;

  const weekdays: number[] = [];
  for (const token of dayChunk[0].split(/[,+\-&/]/)) {
    const t = token.replace(/\s+/g, "").toUpperCase();
    if (t === "CN") {
      weekdays.push(0);
    } else {
      const n = Number(t.replace(/^T/, ""));
      // "T5" hoặc "5" (sau dấu phẩy) → thứ 5 = weekday 4
      if (n >= 2 && n <= 7) weekdays.push(n - 1);
    }
  }
  if (!weekdays.length) return null;

  return { weekdays: [...new Set(weekdays)].sort(), start_time: start, end_time: end };
}
