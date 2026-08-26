"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  fetchBranchList,
  setCurrentBranchId,
  storedBranchId,
  switchBranch,
  type Branch,
} from "@/lib/branch";
import type { Role, User } from "@/lib/types";

/** Vai trò được phép xem/chuyển giữa các chi nhánh. */
const SWITCHER_ROLES: Role[] = ["admin", "staff", "accountant"];

interface BranchState {
  branches: Branch[];
  branchId: string | null;
  branch: Branch | null;
  canSwitch: boolean;
  switchTo: (id: string) => void;
}

const BranchContext = createContext<BranchState>({
  branches: [],
  branchId: null,
  branch: null,
  canSwitch: false,
  switchTo: () => {},
});

/**
 * Xác định chi nhánh đang xem TRƯỚC khi render nội dung — nếu render sớm,
 * các trang sẽ kịp gọi API khi chưa biết chi nhánh và đổ ra dữ liệu cả 2 cơ sở.
 *
 * - Admin / hành chính / kế toán: dùng lựa chọn đã lưu, mặc định là chi
 *   nhánh trong hồ sơ, rồi tới chi nhánh mặc định (Landmark).
 * - Giáo viên / học viên / phụ huynh: khóa cứng theo chi nhánh trong hồ sơ.
 */
export function BranchProvider({ user, children }: { user: User; children: React.ReactNode }) {
  const canSwitch = SWITCHER_ROLES.includes(user.role);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchBranchList()
      .then((list) => {
        if (cancelled) return;
        const stored = storedBranchId();
        const fallback =
          list.find((b) => b.id === user.branchId)?.id ??
          list.find((b) => b.is_default)?.id ??
          list[0]?.id ??
          null;
        const id = canSwitch ? (list.find((b) => b.id === stored)?.id ?? fallback) : fallback;
        setCurrentBranchId(id);
        setBranches(list);
        setBranchId(id);
      })
      .catch((err) => {
        // Không chặn cả ứng dụng vì lỗi đọc danh sách chi nhánh
        console.error("Không tải được danh sách chi nhánh:", err);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user.branchId, canSwitch]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <span className="text-sm">Đang tải...</span>
        </div>
      </div>
    );
  }

  return (
    <BranchContext.Provider
      value={{
        branches,
        branchId,
        branch: branches.find((b) => b.id === branchId) ?? null,
        canSwitch,
        switchTo: switchBranch,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch(): BranchState {
  return useContext(BranchContext);
}
