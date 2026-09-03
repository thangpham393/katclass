"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { fetchPendingRequestCount, fetchMyPendingRequestCount } from "@/lib/db-requests";
import { fetchPendingMakeupCount } from "@/lib/db";
import { fetchPendingAbsenceCount, fetchMyPendingMakeupCount } from "@/lib/db-absence";
import { fetchLowStockCount } from "@/lib/db-supplies";

/**
 * Số việc đang chờ xử lý, gắn thành chấm đỏ ngay trên mục menu — quản lý
 * thấy "Duyệt đổi lịch (3)" là biết phải vào duyệt, không phải mở từng trang.
 *
 * Khóa của map là đúng `href` của mục menu. Đếm lại mỗi khi đổi trang (vừa
 * duyệt xong một đơn thì badge tụt ngay) — không dùng polling để khỏi bắn
 * request nền suốt phiên làm việc. Không cần theo dõi chi nhánh vì đổi chi
 * nhánh là tải lại cả trang (`switchBranch`).
 */
export function useNavBadges(): Record<string, number> {
  const { user, can } = useAuth();
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const role = user?.role;
  const userId = user?.id;
  const canRequests = !!user && can("requests.manage");
  const canMakeup = !!user && can("makeup.manage");
  const canSupplies = !!user && can("supplies.manage");

  useEffect(() => {
    if (!role || !userId) return;
    let cancelled = false;
    const jobs: Promise<[string, number]>[] = [];

    if (role === "student") {
      jobs.push(fetchMyPendingMakeupCount(userId).then((n) => ["/student/makeup", n]));
    } else if (role === "teacher") {
      jobs.push(fetchMyPendingRequestCount(userId).then((n) => ["/teacher/requests", n]));
    } else if (role !== "parent") {
      if (canRequests) {
        jobs.push(fetchPendingRequestCount().then((n) => ["/admin/requests", n]));
      }
      if (canSupplies) {
        jobs.push(fetchLowStockCount().then((n) => ["/admin/supplies", n]));
      }
      if (canMakeup) {
        // Một mục menu, hai việc: lượt chờ xếp bù + đơn xin nghỉ HV tự gửi
        jobs.push(
          Promise.all([fetchPendingMakeupCount(), fetchPendingAbsenceCount()]).then(
            ([a, b]) => ["/admin/makeup", a + b] as [string, number],
          ),
        );
      }
    }
    if (!jobs.length) return;

    // Badge chỉ là thông tin phụ: lỗi mạng thì im lặng bỏ qua, không chặn menu.
    Promise.allSettled(jobs).then((res) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const r of res) {
        if (r.status === "fulfilled") next[r.value[0]] = r.value[1];
      }
      setCounts(next);
    });

    return () => {
      cancelled = true;
    };
  }, [role, userId, canRequests, canMakeup, canSupplies, pathname]);

  return counts;
}
