"use client";

/**
 * KHÁCH HÀNG TIỀM NĂNG — phụ huynh đã hỏi thăm nhưng chưa ghi danh.
 *
 * Mỗi thẻ là một việc đang dở: gửi Invoice, hỏi thăm lại, chốt đăng ký.
 * Vì vậy các nút trên thẻ vừa mở mẫu tin nhắn để copy gửi Zalo, vừa tự
 * đổi trạng thái — nhân viên gọi xong không phải nhớ vào sửa lần nữa.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  FileText,
  Plus as PlusIcon,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { InvoiceFormModal } from "@/components/invoice-form";
import { useBranch } from "@/components/shell/branch-provider";
import { cn } from "@/lib/utils";
import {
  createStudentProfile,
  dbErrorMessage,
  LEVELS,
  LEVEL_LABELS,
  todayISO,
} from "@/lib/db";
import { fmtVND, PAYMENT_METHOD_LABELS } from "@/lib/db-tuition";
import {
  deleteInvoice,
  fetchLeadInvoices,
  invoiceDebt,
  invoiceStatus,
  invoiceTotal,
  lineTotal,
  INVOICE_STATUS_LABELS,
  type InvoiceRow,
} from "@/lib/db-invoices";
import {
  addLeadNote,
  createLead,
  deleteLead,
  deleteLeadFile,
  deleteLeadNote,
  fetchLeadFiles,
  fetchLeadNotes,
  fetchLeads,
  fetchTemplate,
  fillTemplate,
  linkLeadToStudent,
  saveTemplate,
  setLeadStatus,
  signLeadFile,
  signLeadFiles,
  uploadLeadFile,
  updateLead,
  LEAD_STATUS_LABELS,
  type LeadFileRow,
  type LeadNoteRow,
  type LeadRow,
  type LeadStatus,
  type TemplateKey,
} from "@/lib/db-leads";
import { useLoad } from "@/lib/use-load";

const STATUS_VARIANT: Record<LeadStatus, "default" | "gold" | "jade" | "muted"> = {
  new: "default",
  followup: "gold",
  invoiced: "gold",
  registered: "jade",
  lost: "muted",
};

function fmtDate(iso: string): string {
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("vi-VN");
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type NoteTab = "notes" | "template";

type Dialog =
  | { kind: "form"; lead: LeadRow | null }
  | { kind: "invoice"; lead: LeadRow }
  | { kind: "notes"; lead: LeadRow; tab: NoteTab; template?: TemplateKey }
  | { kind: "files"; lead: LeadRow; fileKind: "file" | "image" }
  | { kind: "register"; lead: LeadRow }
  | { kind: "delete"; lead: LeadRow };

export default function AdminLeadsPage() {
  const { branches } = useBranch();
  const { data, loading, error, reload } = useLoad(fetchLeads, []);

  const [branchFilterId, setBranchFilterId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all" | "open">("all");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (branchFilterId !== "all" && (r.branch_id ?? "") !== branchFilterId) return false;
      if (statusFilter === "open" && (r.status === "registered" || r.status === "lost")) return false;
      if (statusFilter !== "all" && statusFilter !== "open" && r.status !== statusFilter) return false;
      if (!needle) return true;
      return `${r.parent_name} ${r.student_name ?? ""} ${r.phone ?? ""} ${r.email ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, branchFilterId, statusFilter, q]);

  const openCount = rows.filter((r) => r.status !== "registered" && r.status !== "lost").length;

  /** Đổi trạng thái ngay trên thẻ, không cần mở hộp thoại. */
  const changeStatus = useCallback(
    async (lead: LeadRow, status: LeadStatus) => {
      await setLeadStatus(lead.id, status);
      reload();
    },
    [reload],
  );

  return (
    <div className="space-y-5">
      {error && <ErrorNote message={error} />}

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold sm:text-xl">Khách hàng tiềm năng</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Theo dõi phụ huynh quan tâm nhưng chưa đăng ký học — {openCount} khách đang chờ
                  xử lý.
                </p>
              </div>
            </div>
            <Button onClick={() => setDialog({ kind: "form", lead: null })}>
              <Plus className="h-4 w-4" /> Khách hàng mới
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <label className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-muted-foreground">Trung tâm</span>
              <Select
                wrapClassName="flex-1"
                value={branchFilterId}
                onChange={(e) => setBranchFilterId(e.target.value)}
              >
                <option value="all">Tất cả trung tâm</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
                <option value="">Chưa chọn trung tâm</option>
              </Select>
            </label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all" | "open")}
            >
              <option value="all">Mọi trạng thái</option>
              <option value="open">Đang chờ xử lý</option>
              {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
                <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
              ))}
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm tên phụ huynh, học viên, số điện thoại..."
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><LoadingRows rows={4} /></Card>
      ) : filtered.length === 0 ? (
        <Empty
          icon={UserPlus}
          title={rows.length === 0 ? "Chưa có khách hàng tiềm năng nào" : "Không có ai khớp bộ lọc"}
          description={
            rows.length === 0
              ? "Thêm phụ huynh vừa gọi hỏi khóa học để không quên gọi lại."
              : "Thử đổi từ khóa, trung tâm hoặc trạng thái."
          }
          action={
            rows.length === 0 ? (
              <Button onClick={() => setDialog({ kind: "form", lead: null })}>
                <Plus className="h-4 w-4" /> Khách hàng mới
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              branchName={branches.find((b) => b.id === lead.branch_id)?.name ?? null}
              onStatus={(s) => changeStatus(lead, s)}
              onOpen={setDialog}
            />
          ))}
        </div>
      )}

      {dialog?.kind === "form" && (
        <LeadFormModal
          lead={dialog.lead}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {dialog?.kind === "invoice" && (
        <InvoiceModal lead={dialog.lead} onClose={() => setDialog(null)} onChanged={reload} />
      )}
      {dialog?.kind === "notes" && (
        <NotesModal
          lead={dialog.lead}
          initialTab={dialog.tab}
          initialTemplate={dialog.template}
          centerName={branches.find((b) => b.id === dialog.lead.branch_id)?.name ?? null}
          onClose={() => setDialog(null)}
          onChanged={reload}
        />
      )}
      {dialog?.kind === "files" && (
        <FilesModal
          lead={dialog.lead}
          fileKind={dialog.fileKind}
          onClose={() => setDialog(null)}
          onChanged={reload}
        />
      )}
      {dialog?.kind === "register" && (
        <RegisterModal
          lead={dialog.lead}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteModal
          lead={dialog.lead}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ================= Một khách hàng ================= */

function LeadCard({
  lead,
  branchName,
  onStatus,
  onOpen,
}: {
  lead: LeadRow;
  branchName: string | null;
  onStatus: (s: LeadStatus) => void;
  onOpen: (d: Dialog) => void;
}) {
  const { can } = useAuth();
  const closed = lead.status === "registered" || lead.status === "lost";
  // Hoá đơn là việc của học phí (0038): hành chính chỉ theo dõi khách, không lập
  // được hoá đơn — RLS cũng chặn, nút bày ra chỉ tổ bấm vào rồi báo lỗi.
  const canInvoice = can("tuition.manage");

  return (
    <Card className={cn(lead.status === "new" && "border-l-4 border-l-primary")}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold">
              {lead.parent_name}
              {lead.student_name && (
                <span className="font-semibold text-muted-foreground"> — {lead.student_name}</span>
              )}
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {lead.phone}
                </a>
              ) : (
                <span>chưa có số điện thoại</span>
              )}
              {lead.email && <span>· {lead.email}</span>}
              {lead.test_level && <span>· test {LEVEL_LABELS[lead.test_level] ?? lead.test_level}</span>}
              {branchName && <span>· {branchName}</span>}
              {lead.dob && <span>· sinh {fmtDate(lead.dob)}</span>}
              <span>· vào sổ {fmtDate(lead.created_at)}</span>
            </div>
            {lead.note && <p className="mt-1.5 text-sm text-muted-foreground">{lead.note}</p>}
            {lead.student_id && (
              <Link
                href={`/admin/members/${lead.student_id}`}
                className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
              >
                Xem hồ sơ học viên →
              </Link>
            )}
          </div>
          <Badge variant={STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canInvoice && (
            <Button size="sm" onClick={() => onOpen({ kind: "invoice", lead })}>
              <FileText className="h-3.5 w-3.5" /> Invoice
            </Button>
          )}
          <Button
            size="sm"
            variant="gold"
            onClick={() =>
              onOpen({ kind: "notes", lead, tab: "template", template: "lead_followup" })
            }
          >
            <PhoneCall className="h-3.5 w-3.5" /> Follow-up
          </Button>
          {lead.status !== "registered" && (
            <Button size="sm" variant="secondary" onClick={() => onOpen({ kind: "register", lead })}>
              <Check className="h-3.5 w-3.5" /> Đã đăng ký
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            title="File đính kèm"
            onClick={() => onOpen({ kind: "files", lead, fileKind: "file" })}
          >
            <Paperclip className="h-3.5 w-3.5" />
            {lead.fileCount > 0 && lead.fileCount}
          </Button>
          <Button
            size="sm"
            variant="outline"
            title="Ghi chú & mẫu tin nhắn"
            onClick={() => onOpen({ kind: "notes", lead, tab: "notes" })}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {lead.noteCount > 0 && lead.noteCount}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpen({ kind: "files", lead, fileKind: "image" })}
          >
            <ImageIcon className="h-3.5 w-3.5" /> Hình ảnh
            {lead.imageCount > 0 && ` (${lead.imageCount})`}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onOpen({ kind: "form", lead })}>
            <Pencil className="h-3.5 w-3.5" /> Sửa
          </Button>
          {!closed && (
            <Button size="sm" variant="ghost" onClick={() => onStatus("lost")}>
              Không theo
            </Button>
          )}
          {closed && (
            <Button size="sm" variant="ghost" onClick={() => onStatus("followup")}>
              Mở lại
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            title="Xóa khách hàng"
            onClick={() => onOpen({ kind: "delete", lead })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ================= Thêm / sửa hồ sơ ================= */

function LeadFormModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: LeadRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const { branches } = useBranch();
  const [parentName, setParentName] = useState(lead?.parent_name ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [address, setAddress] = useState(lead?.address ?? "");
  const [studentName, setStudentName] = useState(lead?.student_name ?? "");
  const [dob, setDob] = useState(lead?.dob ?? "");
  const [level, setLevel] = useState(lead?.test_level ?? "");
  const [branchId, setBranchId] = useState(lead?.branch_id ?? "");
  const [note, setNote] = useState(lead?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input = {
      parent_name: parentName,
      phone,
      email,
      address,
      student_name: studentName,
      dob: dob || null,
      test_level: level || null,
      branch_id: branchId || null,
      note,
    };
    try {
      if (lead) await updateLead(lead.id, input);
      else await createLead(input, user?.id);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={lead ? "Sửa khách hàng" : "Khách hàng mới"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <p className="text-sm text-muted-foreground">Nhập thông tin phụ huynh và học viên tiềm năng.</p>

        <Field label="Họ tên phụ huynh" required>
          <Input value={parentName} onChange={(e) => setParentName(e.target.value)} required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số điện thoại">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>

        <Field label="Địa chỉ">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Họ tên học viên">
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          </Field>
          <Field label="Ngày sinh">
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cấp độ test đầu vào">
            <Select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">—</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{LEVEL_LABELS[l] ?? l}</option>
              ))}
            </Select>
          </Field>
          <Field label="Trung tâm">
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">—</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Ghi chú">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving || !parentName.trim()}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ================= Mẫu tin nhắn ================= */

/**
 * Nằm chung hộp thoại với ghi chú: gọi phụ huynh xong là gõ ghi chú và
 * copy tin nhắn gửi Zalo trong cùng một lượt mở.
 */
function TemplatePane({
  lead,
  initialTemplate,
  centerName,
}: {
  lead: LeadRow;
  initialTemplate?: TemplateKey;
  centerName: string | null;
}) {
  const { user } = useAuth();
  const [templateKey, setTemplateKey] = useState<TemplateKey>(initialTemplate ?? "lead_invoice");
  const [raw, setRaw] = useState("");
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fill = useCallback(
    (body: string) =>
      fillTemplate(body, {
        parent: lead.parent_name,
        student: lead.student_name,
        center: centerName,
      }),
    [lead.parent_name, lead.student_name, centerName],
  );

  useEffect(() => {
    let cancelled = false;
    setEditing(false);
    fetchTemplate(templateKey)
      .then((t) => {
        if (cancelled) return;
        setRaw(t.body);
        setText(fill(t.body));
      })
      .catch((err) => !cancelled && setError(dbErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [templateKey, fill]);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    // Đã copy thì coi như sắp gửi — ghi luôn trạng thái để lần sau biết
    try {
      await setLeadStatus(lead.id, templateKey === "lead_invoice" ? "invoiced" : "followup");
    } catch {
      // Không đổi được trạng thái thì tin nhắn vẫn nằm trong clipboard,
      // không cần chặn thao tác gửi của nhân viên.
    }
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveEdited() {
    setError(null);
    try {
      await saveTemplate(templateKey, raw, user?.id);
      setEditing(false);
      setText(fill(raw));
    } catch (err) {
      setError(dbErrorMessage(err));
    }
  }

  return (
    <div className="space-y-3">
      {error && <ErrorNote message={error} />}
      <Select value={templateKey} onChange={(e) => setTemplateKey(e.target.value as TemplateKey)}>
        <option value="lead_invoice">Gửi Invoice</option>
        <option value="lead_followup">Hỏi thăm (follow-up)</option>
      </Select>
      <p className="text-sm text-muted-foreground">
        {editing
          ? "Sửa mẫu dùng chung. {parent} = tên phụ huynh, {student} = tên học viên, {center} = tên trung tâm."
          : "Sao chép và gửi cho phụ huynh."}
      </p>
      <Textarea
        className="min-h-[220px]"
        value={editing ? raw : text}
        onChange={(e) => (editing ? setRaw(e.target.value) : setText(e.target.value))}
      />
      <div className="flex flex-wrap justify-end gap-2">
        {editing ? (
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>Hủy sửa</Button>
            <Button onClick={saveEdited}>Lưu mẫu</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>Sửa mẫu</Button>
            <Button onClick={copy}>{copied ? "Đã sao chép" : "Sao chép"}</Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ================= Ghi chú trao đổi ================= */

function NotesModal({
  lead,
  initialTab,
  initialTemplate,
  centerName,
  onClose,
  onChanged,
}: {
  lead: LeadRow;
  initialTab: NoteTab;
  initialTemplate?: TemplateKey;
  centerName: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState<NoteTab>(initialTab);
  const [notes, setNotes] = useState<LeadNoteRow[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchLeadNotes(lead.id)
      .then(setNotes)
      .catch((err) => setError(dbErrorMessage(err)));
  }, [lead.id]);

  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addLeadNote(lead.id, body, user?.id);
      setBody("");
      load();
      onChanged();
    } catch (err) {
      setError(dbErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteLeadNote(id);
      load();
      onChanged();
    } catch (err) {
      setError(dbErrorMessage(err));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Ghi chú — ${lead.parent_name}`}>
      <div className="space-y-4">
        <div className="flex gap-1.5">
          {([
            { key: "notes", label: "Ghi chú" },
            { key: "template", label: "Mẫu tin nhắn" },
          ] as { key: NoteTab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                tab === t.key
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "template" ? (
          <TemplatePane lead={lead} initialTemplate={initialTemplate} centerName={centerName} />
        ) : (
          <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        <form onSubmit={add} className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Phụ huynh hỏi gì, hẹn khi nào gọi lại, quan tâm lớp nào..."
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={busy || !body.trim()}>
              {busy ? "Đang lưu..." : "Thêm ghi chú"}
            </Button>
          </div>
        </form>

        {notes === null ? (
          <LoadingRows rows={2} className="p-0" />
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có ghi chú nào.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="rounded-lg bg-muted/60 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                  <button
                    onClick={() => remove(n.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Xóa ghi chú"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fmtDateTime(n.created_at)}
                  {n.created_by_name ? ` · ${n.created_by_name}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ================= File & hình đính kèm ================= */

function FilesModal({
  lead,
  fileKind,
  onClose,
  onChanged,
}: {
  lead: LeadRow;
  fileKind: "file" | "image";
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [files, setFiles] = useState<LeadFileRow[] | null>(null);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchLeadFiles(lead.id, fileKind)
      .then(async (rows) => {
        setFiles(rows);
        // Ảnh cần link ngay để hiện thumbnail; file thường ký lúc bấm tải
        if (fileKind === "image") setUrls(await signLeadFiles(rows.map((r) => r.path)));
      })
      .catch((err) => setError(dbErrorMessage(err)));
  }, [lead.id, fileKind]);

  useEffect(load, [load]);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(list)) await uploadLeadFile(lead.id, f, fileKind, user?.id);
      load();
      onChanged();
    } catch (err) {
      setError(dbErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: LeadFileRow) {
    try {
      await deleteLeadFile(row);
      load();
      onChanged();
    } catch (err) {
      setError(dbErrorMessage(err));
    }
  }

  async function open(row: LeadFileRow) {
    try {
      window.open(await signLeadFile(row.path), "_blank");
    } catch (err) {
      setError(dbErrorMessage(err));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${fileKind === "image" ? "Hình ảnh" : "File đính kèm"} — ${lead.parent_name}`}
    >
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground hover:bg-muted/50">
          <input
            type="file"
            multiple
            className="hidden"
            accept={fileKind === "image" ? "image/*" : undefined}
            onChange={(e) => upload(e.target.files)}
          />
          {busy
            ? "Đang tải lên..."
            : fileKind === "image"
              ? "Bấm để chọn ảnh (chụp màn hình Zalo, ảnh bài test...)"
              : "Bấm để chọn file (Invoice, phiếu test, hợp đồng...)"}
        </label>

        {files === null ? (
          <LoadingRows rows={2} className="p-0" />
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có gì được đính kèm.</p>
        ) : fileKind === "image" ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {files.map((f) => (
              <div key={f.id} className="group relative overflow-hidden rounded-lg border">
                {/* Ảnh từ Supabase Storage có link ký hạn giờ, không qua next/image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urls.get(f.path) ?? ""}
                  alt={f.name}
                  className="h-28 w-full cursor-pointer object-cover"
                  onClick={() => open(f)}
                />
                <button
                  onClick={() => remove(f)}
                  className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-lg bg-card/90 text-muted-foreground hover:text-destructive"
                  aria-label="Xóa ảnh"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg bg-muted/60 p-2.5">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <button onClick={() => open(f)} className="min-w-0 flex-1 truncate text-left text-sm hover:underline">
                  {f.name}
                </button>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmtDateTime(f.created_at)}
                </span>
                <button
                  onClick={() => remove(f)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Xóa file"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ================= Hoá đơn ================= */

/**
 * Lập hoá đơn thẳng từ thẻ khách hàng tiềm năng — không cần biến khách
 * thành học viên trước, vì phần lớn phụ huynh xem hoá đơn rồi mới quyết.
 * Hoá đơn ghi vào bảng `invoices` chung nên trang Hoá đơn thấy luôn.
 */
function InvoiceModal({
  lead,
  onClose,
  onChanged,
}: {
  lead: LeadRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const { branches, branchId: currentBranch } = useBranch();
  const [list, setList] = useState<InvoiceRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchLeadInvoices(lead.id)
      .then(setList)
      .catch((err) => setError(dbErrorMessage(err)));
  }, [lead.id]);

  useEffect(load, [load]);

  async function remove(id: string) {
    try {
      await deleteInvoice(id);
      load();
      onChanged();
    } catch (err) {
      setError(dbErrorMessage(err));
    }
  }

  const title = `Hoá đơn — ${lead.parent_name}${lead.student_name ? ` · ${lead.student_name}` : ""}`;

  return (
    <Modal open onClose={onClose} title={title} className="sm:max-w-2xl">
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-md text-sm text-muted-foreground">
            Tạo hoá đơn ngay cho khách hàng tiềm năng, không cần thêm vào danh sách học viên. Hoá
            đơn cũng hiển thị trong trang Hoá đơn.
          </p>
          {!creating && (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon className="h-4 w-4" /> Tạo hoá đơn
            </Button>
          )}
        </div>

        {list === null ? (
          <LoadingRows rows={2} className="p-0" />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có hoá đơn cho khách hàng này.</p>
        ) : (
          <div className="space-y-2">
            {list.map((inv) => (
              <div key={inv.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {inv.invoice_no}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {fmtDate(inv.issued_on)}
                      {inv.due_on ? ` · hạn ${fmtDate(inv.due_on)}` : ""}
                      {` · ${PAYMENT_METHOD_LABELS[inv.method]}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={invoiceStatus(inv) === "paid" ? "jade" : invoiceStatus(inv) === "partial" ? "gold" : "muted"}>
                      {INVOICE_STATUS_LABELS[invoiceStatus(inv)]}
                    </Badge>
                    <button
                      onClick={() => remove(inv.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Xóa hoá đơn"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <ul className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
                  {inv.items.map((it, i) => (
                    <li key={i}>
                      {it.name} × {it.qty} — {fmtVND(lineTotal(it))}
                    </li>
                  ))}
                </ul>
                <div className="mt-1.5 text-sm">
                  Tổng cần đóng: <b>{fmtVND(invoiceTotal(inv.items, Number(inv.discount)))}</b> · Đã
                  thu: {fmtVND(Number(inv.paid_amount))} ·{" "}
                  <span className={cn(invoiceDebt(inv) > 0 && "font-semibold text-destructive")}>
                    Công nợ: {fmtVND(invoiceDebt(inv))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <InvoiceFormModal
          target={{
            kind: "lead",
            leadId: lead.id,
            customerName: lead.parent_name,
            studentName: lead.student_name,
            phone: lead.phone,
            studentId: lead.student_id,
            branchId: lead.branch_id ?? currentBranch,
          }}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            // Đã có hoá đơn nghĩa là đã báo giá xong — trạng thái đi theo việc thật
            if (lead.status === "new") await setLeadStatus(lead.id, "invoiced");
            load();
            onChanged();
          }}
        />
      )}
    </Modal>
  );
}

/* ================= Chốt đăng ký ================= */

function RegisterModal({
  lead,
  onClose,
  onDone,
}: {
  lead: LeadRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [createProfile, setCreateProfile] = useState(!lead.student_id);
  const [name, setName] = useState(lead.student_name ?? lead.parent_name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (createProfile) {
        const profile = await createStudentProfile({
          name,
          phone: lead.phone ?? undefined,
          email: lead.email ?? undefined,
          address: lead.address ?? undefined,
          note: lead.note ?? undefined,
          dob: lead.dob,
          enrolled_at: todayISO(),
          branch_id: lead.branch_id,
        });
        await linkLeadToStudent(lead.id, profile.id);
      } else {
        await setLeadStatus(lead.id, "registered");
      }
      onDone();
    } catch (err) {
      setError(dbErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Chốt đăng ký — ${lead.parent_name}`}>
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        <label className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={createProfile}
            onChange={(e) => setCreateProfile(e.target.checked)}
          />
          <span className="text-sm">
            Tạo luôn hồ sơ học viên
            <span className="block text-xs text-muted-foreground">
              Mã học viên do hệ thống cấp; số điện thoại, địa chỉ, ngày sinh chuyển sang từ đây.
            </span>
          </span>
        </label>

        {createProfile && (
          <Field label="Họ tên học viên" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={submit} disabled={busy || (createProfile && !name.trim())}>
            {busy ? "Đang lưu..." : "Xác nhận đã đăng ký"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ================= Xóa ================= */

function DeleteModal({
  lead,
  onClose,
  onDeleted,
}: {
  lead: LeadRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await deleteLead(lead.id);
      onDeleted();
    } catch (err) {
      setError(dbErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Xóa khách hàng tiềm năng">
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        <p className="text-sm">
          Xóa <b>{lead.parent_name}</b>
          {lead.student_name ? ` — ${lead.student_name}` : ""}? Ghi chú và file đính kèm mất theo,
          không khôi phục được. Nếu chỉ là khách không theo học, hãy chọn “Không theo” để giữ lại lịch sử.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? "Đang xóa..." : "Xóa"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
