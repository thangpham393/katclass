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
  const byBranch = await branchProfileFilter();
  let q = byBranch(getSupabase().from("profiles").select("id"));
  if (role) q = q.eq("role", role);
  const { data, error } = await q.limit(10000);
  if (error) throw error;
  return (data as { id: string }[]).map((r) => r.id);
}

/**
 * Id hồ sơ được THÊM vào chi nhánh đang xem (0060: GV dạy nhiều cơ sở),
 * ngoài các hồ sơ có chi nhánh chính là cơ sở này.
 * Chưa chạy migration 0060 thì coi như không có ai.
 */
async function extraBranchMemberIds(): Promise<string[]> {
  if (!currentId) return [];
  const { data, error } = await getSupabase()
    .from("profile_branches").select("profile_id").eq("branch_id", currentId);
  if (error) return [];
  return (data as { profile_id: string }[]).map((r) => r.profile_id);
}

/**
 * Như `branchFilter` nhưng cho bảng profiles: lấy cả hồ sơ có chi nhánh
 * chính là cơ sở đang xem lẫn hồ sơ được thêm vào cơ sở này.
 *
 * Trả về HÀM lọc (không trả query): query builder của supabase-js là
 * thenable, trả nó từ hàm async sẽ bị chạy luôn.
 */
export async function branchProfileFilter(): Promise<<T>(query: T) => T> {
  const id = currentId;
  if (!id) return (query) => query;
  const extra = await extraBranchMemberIds();
  return <T,>(query: T): T => {
    const q = query as unknown as { eq(c: string, v: string): T; or(f: string): T };
    return extra.length ? q.or(`branch_id.eq.${id},id.in.(${extra.join(",")})`) : q.eq("branch_id", id);
  };
}

/** Các chi nhánh THÊM của một hồ sơ (không gồm chi nhánh chính). */
export async function fetchProfileExtraBranches(profileId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("profile_branches").select("branch_id").eq("profile_id", profileId);
  if (error) throw error;
  return (data as { branch_id: string }[]).map((r) => r.branch_id);
}

/** Thêm / bỏ một chi nhánh phụ của hồ sơ. */
export async function setProfileExtraBranch(profileId: string, branchId: string, on: boolean) {
  const t = getSupabase().from("profile_branches");
  const { error } = on
    ? await t.upsert({ profile_id: profileId, branch_id: branchId }, { ignoreDuplicates: true })
    : await t.delete().eq("profile_id", profileId).eq("branch_id", branchId);
  if (error) throw error;
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
  // Chi nhánh mới thành chi nhánh chính → không còn là chi nhánh phụ nữa
  await getSupabase()
    .from("profile_branches").delete().eq("profile_id", profileId).eq("branch_id", branchId);
}

/**
 * Gộp hồ sơ trùng (0060, chỉ admin): mọi dữ liệu của `dropId` chuyển sang
 * `keepId`, chi nhánh của hồ sơ bỏ thành chi nhánh phụ, rồi xoá hồ sơ +
 * tài khoản đăng nhập của hồ sơ bỏ. Trả về số dòng dữ liệu đã chuyển.
 */
export async function mergeProfiles(keepId: string, dropId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc("merge_profiles", { p_keep: keepId, p_drop: dropId });
  if (error) throw error;
  return (data as number) ?? 0;
}
