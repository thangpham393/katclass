"use client";

/**
 * KHO HỌC CỤ.
 *
 * Một trang, hai cách nhìn cùng bộ dữ liệu: "Danh mục" trả lời câu hỏi
 * thường ngày (còn bao nhiêu, bán bao nhiêu, sắp hết chưa) và "Nhật ký
 * kho" trả lời câu hỏi khi số không khớp (ai lấy, ngày nào, bao nhiêu).
 *
 * Tồn kho không sửa trực tiếp được — muốn đổi phải qua phiếu Nhập / Cấp
 * phát / Kiểm kê. Chậm hơn một cú nhấp nhưng đổi lại mỗi con số trên
 * trang này luôn giải thích được bằng lịch sử ngay bên cạnh.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ClipboardCheck,
  Download,
  History,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { StatTile } from "@/components/ui/stat-tile";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useBranch } from "@/components/shell/branch-provider";
import { cn } from "@/lib/utils";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage, fetchProfilesByRole, todayISO, type ProfileRow } from "@/lib/db";
import { downloadCSV } from "@/lib/db-finance";
import { fmtVND, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/db-tuition";
import {
  adjustSupplyStock,
  createSupplyItem,
  CSV_HEADERS,
  deleteSupplyItem,
  deleteSupplyMove,
  fetchSupplyItems,
  fetchSupplyMoves,
  importSupplyItems,
  isLowStock,
  issueSupply,
  MOVE_KIND_LABELS,
  parseSupplyCSV,
  receiveSupply,
  stockValue,
  supplyCategoryLabel,
  supplyCategoryOptions,
  updateSupplyItem,
  type SupplyCSVRow,
  type SupplyItemRow,
  type SupplyMoveKind,
  type SupplyMoveRow,
} from "@/lib/db-supplies";

type Tab = "catalog" | "log";
type MoveDialog = { kind: SupplyMoveKind; item: SupplyItemRow };

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("vi-VN");
}

export default function SuppliesPage() {
  const { user, can } = useAuth();
  const editable = can("supplies.manage");
  const { branch } = useBranch();

  const items = useLoad(fetchSupplyItems, []);
  const moves = useLoad(() => fetchSupplyMoves({ limit: 300 }), []);

  const [tab, setTab] = useState<Tab>("catalog");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  const [itemDialog, setItemDialog] = useState<SupplyItemRow | "new" | null>(null);
  const [moveDialog, setMoveDialog] = useState<MoveDialog | null>(null);
  const [historyOf, setHistoryOf] = useState<SupplyItemRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState<SupplyItemRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    items.reload();
    moves.reload();
  }

  const all = useMemo(() => items.data ?? [], [items.data]);

  const shown = useMemo(() => {
    const key = q.trim().toLowerCase();
    return all.filter((it) => {
      if (category && it.category !== category) return false;
      if (onlyLow && !isLowStock(it)) return false;
      if (!key) return true;
      return (
        it.name.toLowerCase().includes(key) ||
        (it.sku ?? "").toLowerCase().includes(key) ||
        supplyCategoryLabel(it.category).toLowerCase().includes(key)
      );
    });
  }, [all, q, category, onlyLow]);

  const lowCount = all.filter(isLowStock).length;
  const totalQty = all.reduce((s, i) => s + Math.max(0, i.stock), 0);

  function exportCSV() {
    downloadCSV(
      `kho-hoc-cu-${todayISO()}.csv`,
      CSV_HEADERS,
      shown.map((i) => [
        i.sku ?? "",
        i.name,
        supplyCategoryLabel(i.category),
        i.unit,
        i.cost_price,
        i.sale_price,
        i.low_stock,
        i.stock,
      ]),
    );
  }

  function downloadTemplate() {
    downloadCSV("mau-kho-hoc-cu.csv", CSV_HEADERS, [
      ["SGK-HSK1", "Giáo trình HSK 1", "Sách & giáo trình", "cuốn", 90000, 120000, 5, 20],
      ["THE-HSK1", "Bộ thẻ từ HSK 1", "Bộ thẻ từ", "bộ", 45000, 70000, 3, 10],
    ]);
  }

  async function handleDelete(item: SupplyItemRow) {
    try {
      await deleteSupplyItem(item.id);
      setRemoving(null);
      refresh();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Kho học cụ</h1>
          <p className="mt-1 text-muted-foreground">
            Sách, vở, bộ thẻ từ và dụng cụ học tập
            {branch ? ` — tồn kho cơ sở ${branch.name}` : ""}.
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4" /> Mẫu CSV
            </Button>
            <Button variant="outline" onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4" /> Nhập CSV
            </Button>
            <Button onClick={() => setItemDialog("new")}>
              <Plus className="h-4 w-4" /> Thêm học cụ
            </Button>
          </div>
        )}
      </div>

      {error && <ErrorNote message={error} />}
      {items.error && <ErrorNote message={items.error} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Mặt hàng" value={all.length} icon={Package} tone="brand" />
        <StatTile label="Tổng tồn kho" value={totalQty} icon={PackagePlus} hint="đơn vị hàng" />
        <StatTile
          label="Giá trị tồn (giá nhập)"
          value={fmtVND(stockValue(all))}
          icon={Wallet}
          tone="jade"
          valueClassName="text-xl sm:text-2xl"
        />
        <button
          type="button"
          className="text-left"
          onClick={() => {
            setTab("catalog");
            setOnlyLow(lowCount > 0);
          }}
        >
          <StatTile
            label="Sắp hết / đã hết"
            value={lowCount}
            icon={AlertTriangle}
            hint={lowCount ? "Bấm để chỉ xem các mặt hàng này" : "Kho đủ hàng"}
            className={cn("h-full", lowCount > 0 && "border-gold-300 bg-gold-50/60")}
          />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-card p-1">
          {(
            [
              ["catalog", "Danh mục"],
              ["log", "Nhật ký kho"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                tab === key ? "bg-brand-50 text-brand-700" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "catalog" && (
          <>
            <div className="relative min-w-0 flex-1 basis-52">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Tìm theo tên hoặc mã..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select
              wrapClassName="w-44"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Tất cả nhóm</option>
              {supplyCategoryOptions().map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Button
              variant={onlyLow ? "gold" : "outline"}
              onClick={() => setOnlyLow((v) => !v)}
              title="Chỉ hiện mặt hàng đã chạm ngưỡng cảnh báo"
            >
              <AlertTriangle className="h-4 w-4" /> Sắp hết
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={shown.length === 0}>
              <Download className="h-4 w-4" /> Tải CSV
            </Button>
          </>
        )}
      </div>

      {tab === "catalog" ? (
        items.loading ? (
          <Card>
            <LoadingRows rows={5} />
          </Card>
        ) : all.length === 0 ? (
          <Empty
            icon={Package}
            title="Kho chưa có mặt hàng nào"
            description="Thêm cuốn giáo trình hoặc bộ thẻ từ đầu tiên, rồi nhập số lượng vào kho để bắt đầu theo dõi tồn."
            action={
              editable ? (
                <Button onClick={() => setItemDialog("new")}>
                  <Plus className="h-4 w-4" /> Thêm học cụ
                </Button>
              ) : undefined
            }
          />
        ) : shown.length === 0 ? (
          <Empty icon={Search} title="Không có mặt hàng nào khớp bộ lọc" />
        ) : (
          <ItemTable
            items={shown}
            editable={editable}
            onEdit={(it) => setItemDialog(it)}
            onMove={(kind, it) => setMoveDialog({ kind, item: it })}
            onHistory={(it) => setHistoryOf(it)}
            onDelete={(it) => setRemoving(it)}
          />
        )
      ) : moves.loading ? (
        <Card>
          <LoadingRows rows={5} />
        </Card>
      ) : (
        <MoveTable
          moves={moves.data ?? []}
          editable={editable}
          onDelete={async (m) => {
            try {
              await deleteSupplyMove(m);
              refresh();
            } catch (e) {
              setError(dbErrorMessage(e));
            }
          }}
        />
      )}

      {itemDialog && (
        <ItemModal
          editing={itemDialog}
          onClose={() => setItemDialog(null)}
          onSaved={() => {
            setItemDialog(null);
            refresh();
          }}
        />
      )}

      {moveDialog && (
        <MoveModal
          dialog={moveDialog}
          userId={user?.id ?? null}
          onClose={() => setMoveDialog(null)}
          onSaved={() => {
            setMoveDialog(null);
            refresh();
          }}
        />
      )}

      {historyOf && <HistoryModal item={historyOf} onClose={() => setHistoryOf(null)} />}

      {importing && (
        <ImportModal
          userId={user?.id ?? null}
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false);
            refresh();
          }}
        />
      )}

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Xoá "${removing?.name ?? ""}"?`}
      >
        <p className="text-sm text-muted-foreground">
          Toàn bộ phiếu nhập và cấp phát của mặt hàng này cũng bị xoá theo. Nếu chỉ muốn ngừng
          bán, hãy sửa mặt hàng và bỏ tích &ldquo;Còn sử dụng&rdquo; — lịch sử vẫn giữ nguyên.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRemoving(null)}>
            Huỷ
          </Button>
          <Button variant="destructive" onClick={() => removing && handleDelete(removing)}>
            Xoá hẳn
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ============ Bảng danh mục ============ */

function StockCell({ item }: { item: SupplyItemRow }) {
  const low = isLowStock(item);
  return (
    <div className="flex items-center justify-end gap-2">
      <span
        className={cn(
          "tabular-nums font-bold",
          item.stock <= 0 ? "text-destructive" : low ? "text-gold-700" : "",
        )}
      >
        {item.stock}
      </span>
      <span className="text-xs text-muted-foreground">{item.unit}</span>
      {item.stock <= 0 ? (
        <Badge variant="destructive">Hết</Badge>
      ) : low ? (
        <Badge variant="gold">Sắp hết</Badge>
      ) : null}
    </div>
  );
}

function ItemTable({
  items,
  editable,
  onEdit,
  onMove,
  onHistory,
  onDelete,
}: {
  items: SupplyItemRow[];
  editable: boolean;
  onEdit: (i: SupplyItemRow) => void;
  onMove: (kind: SupplyMoveKind, i: SupplyItemRow) => void;
  onHistory: (i: SupplyItemRow) => void;
  onDelete: (i: SupplyItemRow) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Học cụ</th>
              <th className="px-4 py-3 text-left font-semibold">Nhóm</th>
              <th className="px-4 py-3 text-right font-semibold">Giá nhập</th>
              <th className="px-4 py-3 text-right font-semibold">Giá bán</th>
              <th className="px-4 py-3 text-right font-semibold">Tồn kho</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((it) => (
              <tr key={it.id} className={cn("hover:bg-secondary/30", !it.is_active && "opacity-60")}>
                <td className="px-4 py-3">
                  <div className="font-semibold">{it.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {it.sku && <span className="font-mono">{it.sku}</span>}
                    {!it.is_active && <Badge variant="muted">Ngừng bán</Badge>}
                    {it.stockAll !== it.stock && <span>Cả hệ thống: {it.stockAll}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {supplyCategoryLabel(it.category)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {fmtVND(it.cost_price)}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {fmtVND(it.sale_price)}
                </td>
                <td className="px-4 py-3">
                  <StockCell item={it} />
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {editable && (
                      <>
                        <IconBtn
                          title="Nhập kho"
                          icon={ArrowDownToLine}
                          onClick={() => onMove("in", it)}
                        />
                        <IconBtn
                          title="Cấp phát cho học viên"
                          icon={UserPlus}
                          onClick={() => onMove("issue", it)}
                        />
                        <IconBtn
                          title="Kiểm kê"
                          icon={ClipboardCheck}
                          onClick={() => onMove("adjust", it)}
                        />
                      </>
                    )}
                    <IconBtn title="Lịch sử" icon={History} onClick={() => onHistory(it)} />
                    {editable && (
                      <>
                        <IconBtn title="Sửa" icon={Pencil} onClick={() => onEdit(it)} />
                        <IconBtn
                          title="Xoá"
                          icon={Trash2}
                          danger
                          onClick={() => onDelete(it)}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function IconBtn({
  title,
  icon: Icon,
  onClick,
  danger,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
        danger && "hover:bg-gold-50 hover:text-destructive",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/* ============ Nhật ký kho ============ */

function MoveTable({
  moves,
  editable,
  onDelete,
}: {
  moves: SupplyMoveRow[];
  editable: boolean;
  onDelete: (m: SupplyMoveRow) => void;
}) {
  if (moves.length === 0) {
    return (
      <Empty
        icon={History}
        title="Chưa có phiếu vào/ra nào"
        description="Mỗi lần nhập hàng hoặc cấp phát cho học viên sẽ để lại một dòng ở đây."
      />
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Ngày</th>
              <th className="px-4 py-3 text-left font-semibold">Loại</th>
              <th className="px-4 py-3 text-left font-semibold">Học cụ</th>
              <th className="px-4 py-3 text-left font-semibold">Học viên / ghi chú</th>
              <th className="px-4 py-3 text-right font-semibold">Số lượng</th>
              <th className="px-4 py-3 text-right font-semibold">Thành tiền</th>
              {editable && <th className="px-2 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {moves.map((m) => (
              <tr key={m.id} className="hover:bg-secondary/30">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {fmtDate(m.occurred_on)}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={m.kind === "in" ? "jade" : m.kind === "issue" ? "default" : "muted"}
                  >
                    {MOVE_KIND_LABELS[m.kind]}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-semibold">{m.item_name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {m.student_name ?? ""}
                  {m.student_name && m.note ? " — " : ""}
                  {m.note ?? ""}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-bold tabular-nums",
                    m.qty > 0 ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  {m.qty > 0 ? "+" : ""}
                  {m.qty} {m.unit}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {m.unit_price > 0 ? fmtVND(Math.abs(m.qty) * m.unit_price) : "—"}
                  {m.finance_entry_id && (
                    <div className="text-[11px] text-muted-foreground">đã vào sổ</div>
                  )}
                </td>
                {editable && (
                  <td className="px-2 py-3">
                    <IconBtn title="Xoá phiếu" icon={Trash2} danger onClick={() => onDelete(m)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ============ Thêm / sửa mặt hàng ============ */

function ItemModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: SupplyItemRow | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing === "new";
  const item = isNew ? null : editing;
  const [sku, setSku] = useState(item?.sku ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "book");
  const [unit, setUnit] = useState(item?.unit ?? "cuốn");
  const [cost, setCost] = useState(String(item?.cost_price ?? 0));
  const [sale, setSale] = useState(String(item?.sale_price ?? 0));
  const [low, setLow] = useState(String(item?.low_stock ?? 5));
  const [note, setNote] = useState(item?.note ?? "");
  const [active, setActive] = useState(item?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      sku,
      name,
      category,
      unit,
      cost_price: Number(cost) || 0,
      sale_price: Number(sale) || 0,
      low_stock: Number(low) || 0,
      note,
      is_active: active,
    };
    try {
      if (isNew) await createSupplyItem(payload);
      else await updateSupplyItem(item!.id, payload);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? "Thêm học cụ" : "Sửa học cụ"}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <Field label="Tên học cụ" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Giáo trình HSK 1"
            required
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Mã" hint="Để trống cũng được">
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SGK-HSK1" />
          </Field>
          <Field label="Nhóm" required>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {supplyCategoryOptions().map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Đơn vị" required>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="cuốn" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Giá nhập">
            <Input
              type="number"
              min={0}
              step={1000}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </Field>
          <Field label="Giá bán">
            <Input
              type="number"
              min={0}
              step={1000}
              value={sale}
              onChange={(e) => setSale(e.target.value)}
            />
          </Field>
          <Field label="Ngưỡng cảnh báo" hint="Tồn ≤ mức này là báo sắp hết">
            <Input type="number" min={0} value={low} onChange={(e) => setLow(e.target.value)} />
          </Field>
        </div>
        <Field label="Ghi chú">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhà cung cấp, bản in, kèm CD..."
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Còn sử dụng (bỏ tích để ẩn khỏi danh sách cấp phát)
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Đang lưu..." : isNew ? "Thêm vào kho" : "Lưu thay đổi"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ============ Phiếu nhập / cấp phát / kiểm kê ============ */

const MOVE_TITLES: Record<SupplyMoveKind, string> = {
  in: "Nhập kho",
  issue: "Cấp phát cho học viên",
  adjust: "Kiểm kê tồn kho",
};

function MoveModal({
  dialog,
  userId,
  onClose,
  onSaved,
}: {
  dialog: MoveDialog;
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { kind, item } = dialog;
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState(String(kind === "in" ? item.cost_price : item.sale_price));
  const [counted, setCounted] = useState(String(item.stock));
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [studentId, setStudentId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [toBook, setToBook] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const students = useLoad<ProfileRow[]>(
    () => (kind === "issue" ? fetchProfilesByRole("student") : Promise.resolve([])),
    [kind],
  );
  const sorted = useMemo(
    () => [...(students.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [students.data],
  );

  const qtyNum = Math.abs(Math.round(Number(qty) || 0));
  const amount = qtyNum * Math.max(0, Math.round(Number(price) || 0));
  const afterIssue = item.stock - qtyNum;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (kind !== "adjust" && qtyNum <= 0) return setError("Số lượng phải lớn hơn 0.");
    if (kind === "issue" && !studentId) return setError("Chọn học viên nhận học cụ.");
    setSaving(true);
    try {
      if (kind === "in") {
        await receiveSupply({
          item_id: item.id,
          itemName: item.name,
          qty: qtyNum,
          unit_price: Number(price) || 0,
          occurred_on: date,
          note,
          recordExpense: toBook,
          createdBy: userId,
        });
      } else if (kind === "issue") {
        await issueSupply({
          item_id: item.id,
          itemName: item.name,
          qty: qtyNum,
          unit_price: Number(price) || 0,
          student_id: studentId,
          studentName: sorted.find((s) => s.id === studentId)?.name ?? null,
          method,
          occurred_on: date,
          note,
          recordRevenue: toBook,
          createdBy: userId,
        });
      } else {
        await adjustSupplyStock({
          item_id: item.id,
          currentStock: item.stock,
          countedStock: Math.round(Number(counted) || 0),
          occurred_on: date,
          note,
          createdBy: userId,
        });
      }
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${MOVE_TITLES[kind]} — ${item.name}`}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrorNote message={error} />}

        <div className="rounded-xl border bg-secondary/30 px-4 py-3 text-sm">
          Tồn hiện tại:{" "}
          <span className="font-bold tabular-nums">
            {item.stock} {item.unit}
          </span>
        </div>

        {kind === "issue" && (
          <Field label="Học viên" required>
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">
                {students.loading ? "Đang tải học viên..." : "— Chọn học viên —"}
              </option>
              {sorted.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.student_code ? ` (${s.student_code})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {kind === "adjust" ? (
            <Field label="Số đếm được" required>
              <Input
                type="number"
                min={0}
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                required
              />
            </Field>
          ) : (
            <Field label="Số lượng" required>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </Field>
          )}
          <Field label="Ngày" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>

        {kind !== "adjust" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={kind === "in" ? "Giá nhập / đơn vị" : "Giá thu / đơn vị"}>
              <Input
                type="number"
                min={0}
                step={1000}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            {kind === "issue" && (
              <Field label="Hình thức thu">
                <Select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}

        {kind !== "adjust" && amount > 0 && (
          <label className="flex items-start gap-2 rounded-xl border bg-secondary/30 p-3 text-sm">
            <input
              type="checkbox"
              checked={toBook}
              onChange={(e) => setToBook(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <span>
              Ghi {fmtVND(amount)} vào sổ {kind === "in" ? "chi" : "thu"}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {kind === "in"
                  ? "Bỏ tích nếu hoá đơn nhà cung cấp đã được kế toán vào sổ."
                  : "Bỏ tích nếu khoản này đã nằm trên hoá đơn của học viên — hoá đơn tự tính doanh thu."}
              </span>
            </span>
          </label>
        )}

        {kind === "issue" && afterIssue < 0 && (
          <p className="rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-sm text-gold-800">
            Kho chỉ còn {item.stock} {item.unit}. Cấp phát vẫn ghi được (hàng có thể đang về),
            nhưng tồn kho sẽ thành {afterIssue}.
          </p>
        )}

        <Field label="Ghi chú">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={kind === "in" ? "Nhà cung cấp, số hoá đơn..." : "Lý do, lớp học..."}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu phiếu"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ============ Lịch sử một mặt hàng ============ */

function HistoryModal({ item, onClose }: { item: SupplyItemRow; onClose: () => void }) {
  const moves = useLoad(() => fetchSupplyMoves({ itemId: item.id, limit: 200 }), [item.id]);
  return (
    <Modal open onClose={onClose} title={`Lịch sử — ${item.name}`} className="max-w-2xl">
      {moves.loading ? (
        <LoadingRows rows={4} />
      ) : (moves.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Mặt hàng này chưa có phiếu vào/ra nào.</p>
      ) : (
        <ul className="divide-y">
          {moves.data!.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
              <Badge variant={m.kind === "in" ? "jade" : m.kind === "issue" ? "default" : "muted"}>
                {MOVE_KIND_LABELS[m.kind]}
              </Badge>
              <div className="min-w-0 flex-1">
                <div className="truncate">{m.student_name ?? m.note ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(m.occurred_on)}</div>
              </div>
              <div
                className={cn(
                  "whitespace-nowrap font-bold tabular-nums",
                  m.qty > 0 ? "text-emerald-600" : "text-destructive",
                )}
              >
                {m.qty > 0 ? "+" : ""}
                {m.qty}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ============ Nhập CSV ============ */

function ImportModal({
  userId,
  onClose,
  onDone,
}: {
  userId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<SupplyCSVRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    try {
      const parsed = parseSupplyCSV(await file.text());
      setRows(parsed);
      if (parsed.length === 0) setError("Không đọc được dòng nào. Hãy tải Mẫu CSV để đối chiếu.");
    } catch {
      setError("Không đọc được file. Hãy lưu lại dưới dạng CSV rồi thử lại.");
    }
  }

  async function run() {
    setSaving(true);
    setError(null);
    try {
      setResult(await importSupplyItems(rows, userId));
    } catch (err) {
      setError(dbErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Nhập danh mục từ CSV" className="max-w-xl">
      {result ? (
        <div className="space-y-4">
          <p className="text-sm">
            Đã thêm mới <b>{result.created}</b> mặt hàng và cập nhật <b>{result.updated}</b> mặt
            hàng có sẵn.
          </p>
          <div className="flex justify-end">
            <Button onClick={onDone}>Xong</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {error && <ErrorNote message={error} />}
          <p className="text-sm text-muted-foreground">
            File theo đúng thứ tự cột của Mẫu CSV: mã, tên, nhóm, đơn vị, giá nhập, giá bán, ngưỡng
            cảnh báo, tồn kho. Trùng mã (hoặc trùng tên) sẽ cập nhật mặt hàng cũ; cột tồn kho chỉ
            áp dụng cho mặt hàng mới.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={pick}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-input file:bg-card file:px-3 file:py-2 file:text-sm file:font-semibold"
          />
          {rows.length > 0 && (
            <div className="rounded-xl border">
              <div className="border-b px-4 py-2 text-sm font-semibold">
                {fileName} — {rows.length} dòng
              </div>
              <ul className="max-h-56 divide-y overflow-y-auto text-sm">
                {rows.slice(0, 50).map((r, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {supplyCategoryLabel(r.category)}
                    </span>
                    <span className="tabular-nums">{fmtVND(r.sale_price)}</span>
                    <span className="w-10 text-right tabular-nums text-muted-foreground">
                      {r.stock}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button onClick={run} disabled={saving || rows.length === 0}>
              {saving ? "Đang nhập..." : `Nhập ${rows.length} mặt hàng`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
