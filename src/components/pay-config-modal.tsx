"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/select";
import { ErrorNote } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { dbErrorMessage } from "@/lib/db";
import { fmtVND } from "@/lib/db-tuition";
import {
  DEFAULT_TIERS,
  PAY_TYPE_LABELS,
  savePayConfig,
  tierLabel,
  type PayProfileRow,
  type PayTierRow,
  type PayType,
} from "@/lib/db-payroll";

interface TierDraft {
  min: string;
  max: string; // rỗng = không giới hạn trên
  amount: string;
}

/** Thiết lập tiền công cho 1 giáo viên: thỉnh giảng (bậc theo sĩ số) hoặc full time. */
export function PayConfigModal({
  teacher,
  profile,
  tiers,
  onClose,
  onSaved,
}: {
  teacher: { id: string; name: string } | null;
  profile: PayProfileRow | null;
  tiers: PayTierRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [payType, setPayType] = useState<PayType>("visiting");
  const [rows, setRows] = useState<TierDraft[]>([]);
  const [baseSalary, setBaseSalary] = useState("");
  const [standardHours, setStandardHours] = useState("");
  const [overtimeRate, setOvertimeRate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teacher) return;
    setPayType(profile?.pay_type ?? "visiting");
    setBaseSalary(profile ? String(profile.base_salary) : "");
    setStandardHours(profile ? String(profile.standard_hours) : "");
    setOvertimeRate(profile ? String(profile.overtime_rate) : "");
    setNote(profile?.note ?? "");
    setRows(
      tiers.length
        ? tiers.map((t) => ({
            min: String(t.min_students),
            max: t.max_students == null ? "" : String(t.max_students),
            amount: String(t.amount),
          }))
        : [],
    );
    setError(null);
  }, [teacher, profile, tiers]);

  if (!teacher) return null;

  function usePreset() {
    setRows(
      DEFAULT_TIERS.map((t) => ({
        min: String(t.min_students),
        max: t.max_students == null ? "" : String(t.max_students),
        amount: String(t.amount),
      })),
    );
  }

  function setRow(i: number, patch: Partial<TierDraft>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    if (!teacher) return;
    const parsed = rows.map((r) => ({
      min_students: Number(r.min) || 0,
      max_students: r.max.trim() === "" ? null : Number(r.max),
      amount: Number(r.amount) || 0,
    }));

    if (payType === "visiting") {
      if (!parsed.length) {
        setError("Thêm ít nhất một bậc theo sĩ số (hoặc bấm “Dùng bậc gợi ý”).");
        return;
      }
      for (const t of parsed) {
        if (t.max_students != null && t.max_students < t.min_students) {
          setError("Bậc không hợp lệ: số HV tối đa phải ≥ số HV tối thiểu.");
          return;
        }
      }
    } else if (Number(overtimeRate) > 0 && !(Number(standardHours) > 0)) {
      setError("Nhập số giờ chuẩn của tháng thì mới tính được giờ vượt.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await savePayConfig({
        teacherId: teacher.id,
        payType,
        baseSalary: Number(baseSalary) || 0,
        standardHours: Number(standardHours) || 0,
        overtimeRate: Number(overtimeRate) || 0,
        note,
        tiers: parsed,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Tiền công — ${teacher.name}`} className="max-w-xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PAY_TYPE_LABELS) as PayType[]).map((k) => (
            <button
              key={k}
              onClick={() => setPayType(k)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                payType === k ? "border-brand-500 bg-brand-50" : "hover:bg-secondary",
              )}
            >
              <div className="text-sm font-bold">{PAY_TYPE_LABELS[k]}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {k === "visiting"
                  ? "Trả theo buổi dạy, mức tiền theo sĩ số lớp"
                  : "Lương cứng tháng + tiền vượt giờ chuẩn"}
              </div>
            </button>
          ))}
        </div>

        {payType === "visiting" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Bậc tiền công theo sĩ số lớp</span>
              <Button variant="ghost" size="sm" onClick={usePreset}>
                <Wand2 className="h-3.5 w-3.5" /> Dùng bậc gợi ý
              </Button>
            </div>

            {rows.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                Chưa có bậc nào — buổi dạy sẽ tính 0 ₫.
              </div>
            )}

            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="w-20">
                    <label className="text-[11px] text-muted-foreground">Từ (HV)</label>
                    <Input
                      type="number"
                      min={0}
                      value={r.min}
                      onChange={(e) => setRow(i, { min: e.target.value })}
                    />
                  </div>
                  <div className="w-20">
                    <label className="text-[11px] text-muted-foreground">Đến (HV)</label>
                    <Input
                      type="number"
                      min={0}
                      value={r.max}
                      placeholder="∞"
                      onChange={(e) => setRow(i, { max: e.target.value })}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] text-muted-foreground">Tiền / buổi</label>
                    <Input
                      type="number"
                      min={0}
                      step={10000}
                      value={r.amount}
                      onChange={(e) => setRow(i, { amount: e.target.value })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Xóa bậc"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  { min: String((Number(prev[prev.length - 1]?.max) || 0) + 1), max: "", amount: "" },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" /> Thêm bậc
            </Button>

            {rows.length > 0 && (
              <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                {rows.map((r, i) => (
                  <div key={i}>
                    {tierLabel({
                      min_students: Number(r.min) || 0,
                      max_students: r.max.trim() === "" ? null : Number(r.max),
                    })}{" "}
                    → <span className="font-semibold text-foreground">{fmtVND(Number(r.amount) || 0)}</span> / buổi
                  </div>
                ))}
                <div className="mt-1">Sĩ số lấy theo số học viên đang học của lớp (buổi bù riêng lấy số HV được xếp).</div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Lương cứng mỗi tháng (₫)" required>
              <Input
                type="number"
                min={0}
                step={100000}
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                placeholder="vd: 12000000"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số giờ dạy chuẩn / tháng">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={standardHours}
                  onChange={(e) => setStandardHours(e.target.value)}
                  placeholder="vd: 80"
                />
              </Field>
              <Field label="Tiền mỗi giờ vượt (₫)">
                <Input
                  type="number"
                  min={0}
                  step={10000}
                  value={overtimeRate}
                  onChange={(e) => setOvertimeRate(e.target.value)}
                  placeholder="vd: 120000"
                />
              </Field>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
              Lương tháng = {fmtVND(Number(baseSalary) || 0)} + số giờ vượt trên{" "}
              {Number(standardHours) || 0}h × {fmtVND(Number(overtimeRate) || 0)}. Giờ dạy lấy theo giờ thực tế đã chấm
              công, buổi chưa chấm tạm tính theo giờ lịch.
            </div>
          </div>
        )}

        <Field label="Ghi chú">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="vd: áp dụng từ tháng 8/2026" />
        </Field>

        {error && <ErrorNote message={error} />}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu mức lương"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
