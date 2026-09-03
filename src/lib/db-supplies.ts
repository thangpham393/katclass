"use client";

/**
 * KHO HỌC CỤ (migration 0037).
 *
 * Danh mục (`supply_items`) dùng chung hai cơ sở; tồn kho là TỔNG nhật ký
 * vào/ra của từng cơ sở (`supply_moves`, xem qua view `supply_stock`) chứ
 * không phải một con số ghi sẵn — mọi thay đổi tồn kho ở đây đều đi kèm
 * một phiếu giải thích được: nhập ngày nào, cấp cho ai, kiểm kê hụt bao
 * nhiêu.
 *
 * Tiền thì KHÔNG có sổ riêng: nhập hàng có giá → một dòng chi, cấp phát
 * có thu tiền → một dòng thu, đều nằm trong sổ thu chi (`finance_entries`,
 * migration 0034) nên trang Doanh thu tự cộng vào mà không cần biết gì về
 * kho. Id dòng tiền được giữ ở `supply_moves.finance_entry_id` để xoá
 * phiếu là xoá luôn khoản tiền, không để lại dòng mồ côi.
 */

import { getSupabase } from "./supabase";
import { branchFilter, branchStamp, currentBranchId } from "./branch";
import { createFinanceEntry, deleteFinanceEntry } from "./db-finance";
import type { PaymentMethod } from "./db-tuition";

/* ============ Danh mục ============ */

export const SUPPLY_CATEGORIES = {
  book: "Sách & giáo trình",
  notebook: "Vở & tài liệu in",
  cards: "Bộ thẻ từ",
  tool: "Dụng cụ học tập",
  uniform: "Đồng phục & quà tặng",
  other: "Khác",
} as const;

export type SupplyCategory = keyof typeof SUPPLY_CATEGORIES;

export function supplyCategoryLabel(key: string): string {
  return (SUPPLY_CATEGORIES as Record<string, string>)[key] ?? key;
}

export function supplyCategoryOptions(): { key: string; label: string }[] {
  return Object.entries(SUPPLY_CATEGORIES).map(([key, label]) => ({ key, label }));
}

/** Nhận cả khóa (`book`) lẫn nhãn tiếng Việt khi nhập từ file CSV. */
function parseCategory(raw: string): SupplyCategory {
  const s = raw.trim().toLowerCase();
  if (!s) return "other";
  const keys = Object.keys(SUPPLY_CATEGORIES) as SupplyCategory[];
  const byKey = keys.find((k) => k === s);
  if (byKey) return byKey;
  const byLabel = keys.find((k) => SUPPLY_CATEGORIES[k].toLowerCase() === s);
  return byLabel ?? "other";
}

/* ============ Kiểu dữ liệu ============ */

export interface SupplyItemRow {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  sale_price: number;
  low_stock: number;
  note: string | null;
  is_active: boolean;
  created_at: string;
  /** Tồn kho của chi nhánh đang xem. */
  stock: number;
  /** Tồn kho cộng cả hai cơ sở — để quản lý biết hàng còn ở đâu. */
  stockAll: number;
  /** Ngày có phiếu vào/ra gần nhất tại chi nhánh đang xem. */
  lastMoveOn: string | null;
}

export type SupplyMoveKind = "in" | "issue" | "adjust";

export const MOVE_KIND_LABELS: Record<SupplyMoveKind, string> = {
  in: "Nhập kho",
  issue: "Cấp phát",
  adjust: "Kiểm kê",
};

export interface SupplyMoveRow {
  id: string;
  item_id: string;
  item_name: string;
  unit: string;
  branch_id: string | null;
  kind: SupplyMoveKind;
  qty: number;
  unit_price: number;
  student_id: string | null;
  student_name: string | null;
  finance_entry_id: string | null;
  occurred_on: string;
  note: string | null;
  created_at: string;
}

export interface SupplyItemInput {
  sku?: string | null;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  sale_price: number;
  low_stock: number;
  note?: string | null;
  is_active?: boolean;
}

const ITEM_SELECT =
  "id, sku, name, category, unit, cost_price, sale_price, low_stock, note, is_active, created_at";

const MOVE_SELECT =
  "id, item_id, branch_id, kind, qty, unit_price, student_id, finance_entry_id, occurred_on, note, created_at, item:supply_items ( name, unit ), student:profiles!student_id ( name )";

function clean(v?: string | null): string | null {
  const s = (v ?? "").trim();
  return s || null;
}

function num(v: unknown): number {
  return Math.round(Number(v) || 0);
}

/* ============ Đọc danh mục + tồn kho ============ */

interface StockRow {
  item_id: string;
  branch_id: string | null;
  qty: number;
  last_move_on: string | null;
}

/**
 * Danh mục kèm tồn kho. Tồn kho lấy MỘT lượt cho mọi chi nhánh rồi tách ở
 * máy khách: hai cơ sở và vài trăm mặt hàng thì một lần đọc rẻ hơn hai,
 * mà lại có sẵn số tổng để hiện "còn ở cơ sở kia".
 */
export async function fetchSupplyItems(): Promise<SupplyItemRow[]> {
  const [itemsRes, stockRes] = await Promise.all([
    getSupabase().from("supply_items").select(ITEM_SELECT).order("name").limit(2000),
    getSupabase().from("supply_stock").select("item_id, branch_id, qty, last_move_on").limit(5000),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (stockRes.error) throw stockRes.error;

  const branch = currentBranchId();
  const here = new Map<string, StockRow>();
  const total = new Map<string, number>();
  for (const s of (stockRes.data ?? []) as StockRow[]) {
    total.set(s.item_id, (total.get(s.item_id) ?? 0) + (Number(s.qty) || 0));
    if (!branch || s.branch_id === branch) here.set(s.item_id, s);
  }

  type Raw = Omit<SupplyItemRow, "stock" | "stockAll" | "lastMoveOn">;
  return ((itemsRes.data ?? []) as Raw[]).map((it) => ({
    ...it,
    cost_price: Number(it.cost_price) || 0,
    sale_price: Number(it.sale_price) || 0,
    stock: Number(here.get(it.id)?.qty) || 0,
    stockAll: total.get(it.id) ?? 0,
    lastMoveOn: here.get(it.id)?.last_move_on ?? null,
  }));
}

/** Còn hàng nhưng đã chạm ngưỡng, hoặc hết sạch — cùng một cảnh báo. */
export function isLowStock(item: SupplyItemRow): boolean {
  return item.is_active && item.stock <= item.low_stock;
}

/**
 * Số mặt hàng đã chạm ngưỡng — cho chấm đỏ trên menu. Phải đọc cả danh
 * mục lẫn tồn kho vì ngưỡng nằm ở mặt hàng còn số tồn nằm ở nhật ký; kho
 * học cụ của một trung tâm cỡ vài trăm dòng nên vẫn nhẹ.
 */
export async function fetchLowStockCount(): Promise<number> {
  const items = await fetchSupplyItems();
  return items.filter(isLowStock).length;
}

/** Giá trị tồn kho theo giá nhập (thứ kế toán hỏi khi chốt sổ). */
export function stockValue(items: SupplyItemRow[]): number {
  return items.reduce((s, i) => s + Math.max(0, i.stock) * i.cost_price, 0);
}

/* ============ Sửa danh mục ============ */

function itemPayload(input: SupplyItemInput) {
  return {
    sku: clean(input.sku),
    name: input.name.trim(),
    category: input.category,
    unit: input.unit.trim() || "cái",
    cost_price: num(input.cost_price),
    sale_price: num(input.sale_price),
    low_stock: Math.max(0, num(input.low_stock)),
    note: clean(input.note),
    is_active: input.is_active ?? true,
  };
}

export async function createSupplyItem(input: SupplyItemInput): Promise<string> {
  const { data, error } = await getSupabase()
    .from("supply_items")
    .insert(itemPayload(input))
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateSupplyItem(id: string, input: SupplyItemInput) {
  const { error } = await getSupabase()
    .from("supply_items")
    .update({ ...itemPayload(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Xoá hẳn mặt hàng — kéo theo toàn bộ phiếu vào/ra của nó (on delete cascade). */
export async function deleteSupplyItem(id: string) {
  const { error } = await getSupabase().from("supply_items").delete().eq("id", id);
  if (error) throw error;
}

/* ============ Phiếu vào / ra ============ */

interface MoveJoin {
  id: string;
  item_id: string;
  branch_id: string | null;
  kind: SupplyMoveKind;
  qty: number;
  unit_price: number;
  student_id: string | null;
  finance_entry_id: string | null;
  occurred_on: string;
  note: string | null;
  created_at: string;
  item: { name: string; unit: string } | null;
  student: { name: string } | null;
}

export async function fetchSupplyMoves(opts?: {
  itemId?: string;
  studentId?: string;
  limit?: number;
}): Promise<SupplyMoveRow[]> {
  let q = branchFilter(getSupabase().from("supply_moves").select(MOVE_SELECT));
  if (opts?.itemId) q = q.eq("item_id", opts.itemId);
  if (opts?.studentId) q = q.eq("student_id", opts.studentId);
  const { data, error } = await q
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 300);
  if (error) throw error;
  return ((data ?? []) as unknown as MoveJoin[]).map((m) => ({
    id: m.id,
    item_id: m.item_id,
    item_name: m.item?.name ?? "—",
    unit: m.item?.unit ?? "",
    branch_id: m.branch_id,
    kind: m.kind,
    qty: Number(m.qty) || 0,
    unit_price: Number(m.unit_price) || 0,
    student_id: m.student_id,
    student_name: m.student?.name ?? null,
    finance_entry_id: m.finance_entry_id,
    occurred_on: m.occurred_on,
    note: m.note,
    created_at: m.created_at,
  }));
}

interface MoveBase {
  item_id: string;
  /** Số lượng luôn nhập số dương; hàm tự đặt dấu theo loại phiếu. */
  qty: number;
  unit_price?: number;
  occurred_on: string;
  note?: string | null;
  createdBy?: string | null;
}

async function insertMove(row: Record<string, unknown>): Promise<string> {
  const { data, error } = await getSupabase()
    .from("supply_moves")
    .insert({ ...branchStamp(), ...row })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Nhập kho. `recordExpense` ghi tiền hàng vào sổ chi — bỏ tích khi hoá
 * đơn nhà cung cấp đã được kế toán vào sổ bằng tay, để khỏi đếm hai lần.
 */
export async function receiveSupply(
  input: MoveBase & { itemName: string; recordExpense?: boolean },
): Promise<void> {
  const qty = Math.abs(num(input.qty));
  if (!qty) throw new Error("Số lượng phải lớn hơn 0.");
  const price = Math.max(0, num(input.unit_price));
  const amount = qty * price;

  let entryId: string | null = null;
  if (input.recordExpense && amount > 0) {
    entryId = await createFinanceEntry(
      {
        kind: "expense",
        category: "supplies",
        amount,
        occurred_on: input.occurred_on,
        method: "cash",
        title: `Nhập kho: ${input.itemName} × ${qty}`,
        note: clean(input.note),
      },
      input.createdBy,
    );
  }

  try {
    await insertMove({
      item_id: input.item_id,
      kind: "in",
      qty,
      unit_price: price,
      occurred_on: input.occurred_on,
      note: clean(input.note),
      finance_entry_id: entryId,
      created_by: input.createdBy || null,
    });
  } catch (err) {
    // Phiếu hỏng thì dòng chi vừa ghi cũng phải biến mất, nếu không sổ
    // chi sẽ có một khoản không có hàng nào đối ứng.
    if (entryId) await deleteFinanceEntry(entryId).catch(() => {});
    throw err;
  }
}

/**
 * Cấp phát cho học viên. `recordRevenue` ghi tiền vào sổ thu — bỏ tích khi
 * số tiền này đã nằm trên một tờ hoá đơn (hoá đơn tự tính doanh thu).
 */
export async function issueSupply(
  input: MoveBase & {
    itemName: string;
    student_id: string | null;
    studentName?: string | null;
    unit_price?: number;
    method?: PaymentMethod;
    recordRevenue?: boolean;
    invoice_id?: string | null;
  },
): Promise<void> {
  const qty = Math.abs(num(input.qty));
  if (!qty) throw new Error("Số lượng phải lớn hơn 0.");
  const price = Math.max(0, num(input.unit_price));
  const amount = qty * price;

  let entryId: string | null = null;
  if (input.recordRevenue && amount > 0) {
    entryId = await createFinanceEntry(
      {
        kind: "revenue",
        category: "supplies",
        amount,
        occurred_on: input.occurred_on,
        method: input.method ?? "cash",
        title: `${input.itemName} × ${qty}${input.studentName ? ` — ${input.studentName}` : ""}`,
        note: clean(input.note),
      },
      input.createdBy,
    );
  }

  try {
    await insertMove({
      item_id: input.item_id,
      kind: "issue",
      qty: -qty,
      unit_price: price,
      student_id: input.student_id,
      invoice_id: input.invoice_id ?? null,
      occurred_on: input.occurred_on,
      note: clean(input.note),
      finance_entry_id: entryId,
      created_by: input.createdBy || null,
    });
  } catch (err) {
    if (entryId) await deleteFinanceEntry(entryId).catch(() => {});
    throw err;
  }
}

/**
 * Kiểm kê: đặt lại tồn kho về con số đếm được. Phiếu ghi PHẦN CHÊNH để
 * lịch sử vẫn cộng ra đúng số mới mà không xoá dấu vết cũ.
 */
export async function adjustSupplyStock(input: {
  item_id: string;
  currentStock: number;
  countedStock: number;
  occurred_on: string;
  note?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const diff = num(input.countedStock) - num(input.currentStock);
  if (!diff) return;
  await insertMove({
    item_id: input.item_id,
    kind: "adjust",
    qty: diff,
    occurred_on: input.occurred_on,
    note: clean(input.note) ?? `Kiểm kê: ${input.currentStock} → ${input.countedStock}`,
    created_by: input.createdBy || null,
  });
}

/** Xoá phiếu (ghi nhầm) — kèm dòng tiền đã sinh ra từ nó. */
export async function deleteSupplyMove(move: {
  id: string;
  finance_entry_id: string | null;
}) {
  const { error } = await getSupabase().from("supply_moves").delete().eq("id", move.id);
  if (error) throw error;
  if (move.finance_entry_id) await deleteFinanceEntry(move.finance_entry_id).catch(() => {});
}

/* ============ Nhập / xuất CSV ============ */

export const CSV_HEADERS = [
  "Mã",
  "Tên học cụ",
  "Nhóm",
  "Đơn vị",
  "Giá nhập",
  "Giá bán",
  "Ngưỡng cảnh báo",
  "Tồn kho",
];

export interface SupplyCSVRow extends SupplyItemInput {
  /** Tồn kho ban đầu — sinh một phiếu nhập kho nếu > 0. */
  stock: number;
}

/**
 * Đọc CSV do Excel xuất ra: tự nhận dấu phân cách (`;` hay `,`), bỏ qua
 * dòng tiêu đề, chấp nhận số kiểu "120.000" lẫn "120000".
 */
export function parseSupplyCSV(text: string): SupplyCSVRow[] {
  const body = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const first = body.split("\n")[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const money = (v: string) => Math.round(Number((v ?? "").replace(/[^\d-]/g, "")) || 0);
  const out: SupplyCSVRow[] = [];
  for (const r of rows) {
    const [sku, name, category, unit, cost, sale, low, stock] = r.map((c) => (c ?? "").trim());
    if (!name) continue;
    // Dòng tiêu đề (dù người dùng có đổi chữ hoa/thường) không phải hàng hoá.
    if (name.toLowerCase() === CSV_HEADERS[1].toLowerCase()) continue;
    out.push({
      sku: sku || null,
      name,
      category: parseCategory(category ?? ""),
      unit: unit || "cái",
      cost_price: money(cost),
      sale_price: money(sale),
      low_stock: Math.max(0, money(low)),
      stock: money(stock),
    });
  }
  return out;
}

/**
 * Nhập danh mục từ CSV. Trùng mã (hoặc trùng tên khi không có mã) thì CẬP
 * NHẬT mặt hàng cũ chứ không tạo bản sao — file CSV thường được sửa rồi
 * nhập lại nhiều lần.
 *
 * Tồn kho trong file chỉ dùng cho mặt hàng MỚI (một phiếu nhập kho ban
 * đầu). Với mặt hàng đã có, số tồn phải đi qua phiếu nhập/kiểm kê để lịch
 * sử không bị viết lại sau lưng.
 */
export async function importSupplyItems(
  rows: SupplyCSVRow[],
  createdBy?: string | null,
): Promise<{ created: number; updated: number }> {
  const existing = await fetchSupplyItems();
  const bySku = new Map(existing.filter((e) => e.sku).map((e) => [e.sku!.toLowerCase(), e]));
  const byName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e]));

  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const match =
      (r.sku ? bySku.get(r.sku.toLowerCase()) : undefined) ??
      byName.get(r.name.trim().toLowerCase());
    if (match) {
      await updateSupplyItem(match.id, r);
      updated++;
      continue;
    }
    const id = await createSupplyItem(r);
    created++;
    if (r.stock > 0) {
      await insertMove({
        item_id: id,
        kind: "in",
        qty: r.stock,
        unit_price: r.cost_price,
        occurred_on: new Date().toISOString().slice(0, 10),
        note: "Tồn đầu kỳ (nhập từ CSV)",
        created_by: createdBy || null,
      });
    }
  }
  return { created, updated };
}
