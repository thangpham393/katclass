"use client";

/**
 * CHI NHÁNH (migration 0026).
 *
 * Trung tâm có 2 cơ sở: Landmark (dữ liệu hiện có) và Thủ Đức (mới, trống).
 * Chi nhánh đang xem được giữ ở module-level + localStorage, KHÔNG truyền
 * qua tham số từng hàm — nhờ vậy toàn bộ hàm fetch trong `db*.ts` chỉ cần
 * gắn thêm `branchFilter(...)` mà mọi trang gọi chúng không phải sửa gì.
 *
 * Đổi chi nhánh = tải lại trang (`switchBranch`) để mọi bảng dữ liệu đang
 * mở nạp lại theo cơ sở mới — thao tác hiếm nên tải lại là chấp nhận được.
 *
 * Kho học liệu (giáo trình, bài học, từ vựng, ngân hàng câu hỏi, khóa học)
 * DÙNG CHUNG cả 2 chi nhánh nên không lọc theo branch.
 */

import { getSupabase } from "./supabase";

export interface Branch {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  is_default: boolean;
}

const STORAGE_KEY = "kat.branch_id";

let currentId: string | null = null;

/** Chi nhánh đang xem (null khi chưa nạp xong → tạm thời không lọc). */
export function currentBranchId(): string | null {
  return currentId;
}

/** Đặt chi nhánh đang xem (BranchProvider gọi lúc khởi động). */
export function setCurrentBranchId(id: string | null) {
  currentId = id;
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(STORAGE_KEY, id);
  else window.localStorage.removeItem(STORAGE_KEY);
}

/** Lựa chọn đã lưu ở lần truy cập trước (nếu có). */
export function storedBranchId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

/** Đổi chi nhánh rồi tải lại trang để mọi dữ liệu nạp lại theo cơ sở mới. */
export function switchBranch(id: string) {
  if (id === currentId) return;
  setCurrentBranchId(id);
  window.location.reload();
}

/**
 * Gắn điều kiện lọc theo chi nhánh vào một query Supabase.
 * `column` cho phép lọc qua bảng nối, vd `"session.branch_id"` khi đã
 * embed `session:sessions!inner (...)`.
 */
export function branchFilter<T>(query: T, column = "branch_id"): T {
  if (!currentId) return query;
  // Query builder của supabase-js được gõ kiểu theo từng bảng nên phải ép kiểu
  // để dùng chung một helper cho mọi bảng; kiểu trả về vẫn giữ nguyên là T.
  return (query as unknown as { eq(c: string, v: string): T }).eq(column, currentId);
}

/** Cột branch_id để chèn kèm khi tạo bản ghi mới (lớp, phòng, hồ sơ...). */
export function branchStamp(): { branch_id?: string } {
  return currentId ? { branch_id: currentId } : {};
}

export async function fetchBranchList(): Promise<Branch[]> {
  const { data, error } = await getSupabase()
    .from("branches")
    .select("id, name, code, address, phone, is_default")
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw error;
  return data as Branch[];
}

/**
 * Id các hồ sơ thuộc chi nhánh đang xem — dùng khi bảng/view cần lọc
 * KHÔNG có sẵn cột branch_id (vd view `package_balances`).
 * Trả về null khi chưa biết chi nhánh (không lọc).
 */
export async function branchProfileIds(role?: string): Promise<string[] | null> {
  if (!currentId) return null;
  let q = getSupabase().from("profiles").select("id").eq("branch_id", currentId);
  if (role) q = q.eq("role", role);
  const { data, error } = await q.limit(10000);
  if (error) throw error;
  return (data as { id: string }[]).map((r) => r.id);
}

/** Sửa thông tin một chi nhánh (tên, địa chỉ, điện thoại). */
export async function updateBranch(
  id: string,
  input: { name?: string; address?: string | null; phone?: string | null },
) {
  const { error } = await getSupabase().from("branches").update(input).eq("id", id);
  if (error) throw error;
}

/** Chuyển hồ sơ (học viên / giáo viên / nhân viên) sang chi nhánh khác. */
export async function moveProfileToBranch(profileId: string, branchId: string) {
  const { error } = await getSupabase()
    .from("profiles")
    .update({ branch_id: branchId })
    .eq("id", profileId);
  if (error) throw error;
}
