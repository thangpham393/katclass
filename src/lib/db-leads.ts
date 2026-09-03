"use client";

/**
 * KHÁCH HÀNG TIỀM NĂNG (migration 0032).
 *
 * Khác mọi module khác, danh sách này KHÔNG lọc theo chi nhánh đang xem:
 * phụ huynh mới hỏi thăm thường chưa chọn cơ sở nào, và văn phòng cần thấy
 * hết để chia nhau gọi. Trang tự có ô lọc "Trung tâm" riêng.
 */

import { getSupabase } from "./supabase";

const BUCKET = "leads";
const SIGNED_TTL = 60 * 60; // 1 giờ

export type LeadStatus = "new" | "followup" | "invoiced" | "registered" | "lost";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Mới",
  followup: "Đang chăm",
  invoiced: "Đã gửi Invoice",
  registered: "Đã đăng ký",
  lost: "Không theo",
};

export interface LeadRow {
  id: string;
  parent_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  student_name: string | null;
  dob: string | null;
  test_level: string | null;
  branch_id: string | null;
  status: LeadStatus;
  note: string | null;
  student_id: string | null;
  created_at: string;
  updated_at: string;
  /** Đếm sẵn để thẻ khách hàng hiện số ghi chú / file mà không phải mở ra. */
  noteCount: number;
  fileCount: number;
  imageCount: number;
}

export interface LeadNoteRow {
  id: string;
  lead_id: string;
  body: string;
  created_at: string;
  created_by_name: string | null;
}

export interface LeadFileRow {
  id: string;
  lead_id: string;
  name: string;
  path: string;
  kind: "file" | "image";
  size: number | null;
  created_at: string;
}

export interface LeadInput {
  parent_name: string;
  phone?: string;
  email?: string;
  address?: string;
  student_name?: string;
  dob?: string | null;
  test_level?: string | null;
  branch_id?: string | null;
  note?: string;
}

function clean(v?: string | null): string | null {
  const s = (v ?? "").trim();
  return s || null;
}

/* ================= Hồ sơ ================= */

export async function fetchLeads(): Promise<LeadRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("leads")
    .select(
      "id, parent_name, phone, email, address, student_name, dob, test_level, branch_id, status, note, student_id, created_at, updated_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const leads = (data ?? []) as Omit<LeadRow, "noteCount" | "fileCount" | "imageCount">[];
  if (!leads.length) return [];

  const ids = leads.map((l) => l.id);
  const [notes, files] = await Promise.all([
    sb.from("lead_notes").select("lead_id").in("lead_id", ids),
    sb.from("lead_files").select("lead_id, kind").in("lead_id", ids),
  ]);
  if (notes.error) throw notes.error;
  if (files.error) throw files.error;

  const noteCount = new Map<string, number>();
  for (const n of notes.data ?? []) noteCount.set(n.lead_id, (noteCount.get(n.lead_id) ?? 0) + 1);
  const fileCount = new Map<string, number>();
  const imageCount = new Map<string, number>();
  for (const f of (files.data ?? []) as { lead_id: string; kind: "file" | "image" }[]) {
    const map = f.kind === "image" ? imageCount : fileCount;
    map.set(f.lead_id, (map.get(f.lead_id) ?? 0) + 1);
  }

  return leads.map((l) => ({
    ...l,
    noteCount: noteCount.get(l.id) ?? 0,
    fileCount: fileCount.get(l.id) ?? 0,
    imageCount: imageCount.get(l.id) ?? 0,
  }));
}

export async function createLead(input: LeadInput, createdBy?: string | null): Promise<string> {
  const { data, error } = await getSupabase()
    .from("leads")
    .insert({
      parent_name: input.parent_name.trim(),
      phone: clean(input.phone),
      email: clean(input.email)?.toLowerCase() ?? null,
      address: clean(input.address),
      student_name: clean(input.student_name),
      dob: input.dob || null,
      test_level: input.test_level || null,
      branch_id: input.branch_id || null,
      note: clean(input.note),
      created_by: createdBy || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateLead(id: string, input: Partial<LeadInput>) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.parent_name !== undefined) patch.parent_name = input.parent_name.trim();
  if (input.phone !== undefined) patch.phone = clean(input.phone);
  if (input.email !== undefined) patch.email = clean(input.email)?.toLowerCase() ?? null;
  if (input.address !== undefined) patch.address = clean(input.address);
  if (input.student_name !== undefined) patch.student_name = clean(input.student_name);
  if (input.dob !== undefined) patch.dob = input.dob || null;
  if (input.test_level !== undefined) patch.test_level = input.test_level || null;
  if (input.branch_id !== undefined) patch.branch_id = input.branch_id || null;
  if (input.note !== undefined) patch.note = clean(input.note);
  const { error } = await getSupabase().from("leads").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  const { error } = await getSupabase()
    .from("leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Xoá hồ sơ tiềm năng — file trong kho xoá theo để không rác bucket. */
export async function deleteLead(id: string) {
  const sb = getSupabase();
  const { data } = await sb.from("lead_files").select("path").eq("lead_id", id);
  const paths = ((data ?? []) as { path: string }[]).map((f) => f.path);
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
  const { error } = await sb.from("leads").delete().eq("id", id);
  if (error) throw error;
}

/** Ghi nhận đã chốt: gắn hồ sơ học viên vừa tạo vào khách hàng tiềm năng. */
export async function linkLeadToStudent(id: string, studentId: string) {
  const { error } = await getSupabase()
    .from("leads")
    .update({ student_id: studentId, status: "registered", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/* ================= Ghi chú ================= */

export async function fetchLeadNotes(leadId: string): Promise<LeadNoteRow[]> {
  const { data, error } = await getSupabase()
    .from("lead_notes")
    .select("id, lead_id, body, created_at, by:created_by ( name )")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (
    data as unknown as (Omit<LeadNoteRow, "created_by_name"> & { by: { name: string } | null })[]
  ).map((r) => ({ ...r, created_by_name: r.by?.name ?? null }));
}

export async function addLeadNote(leadId: string, body: string, createdBy?: string | null) {
  const { error } = await getSupabase()
    .from("lead_notes")
    .insert({ lead_id: leadId, body: body.trim(), created_by: createdBy || null });
  if (error) throw error;
}

export async function deleteLeadNote(id: string) {
  const { error } = await getSupabase().from("lead_notes").delete().eq("id", id);
  if (error) throw error;
}

/* ================= File & hình ================= */

export async function fetchLeadFiles(leadId: string, kind: "file" | "image"): Promise<LeadFileRow[]> {
  const { data, error } = await getSupabase()
    .from("lead_files")
    .select("id, lead_id, name, path, kind, size, created_at")
    .eq("lead_id", leadId)
    .eq("kind", kind)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadFileRow[];
}

export async function uploadLeadFile(
  leadId: string,
  file: File,
  kind: "file" | "image",
  createdBy?: string | null,
): Promise<void> {
  const sb = getSupabase();
  // Thư mục riêng từng khách hàng, tên file giữ nguyên phần đuôi để tải về
  // vẫn mở đúng ứng dụng; tiền tố ngẫu nhiên tránh trùng tên.
  const path = `${leadId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (up.error) throw up.error;
  const { error } = await sb.from("lead_files").insert({
    lead_id: leadId,
    name: file.name,
    path,
    kind,
    size: file.size,
    created_by: createdBy || null,
  });
  if (error) throw error;
}

export async function deleteLeadFile(row: LeadFileRow) {
  const sb = getSupabase();
  await sb.storage.from(BUCKET).remove([row.path]);
  const { error } = await sb.from("lead_files").delete().eq("id", row.id);
  if (error) throw error;
}

/** Link tạm để xem/tải một file đính kèm. */
export async function signLeadFile(path: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (error) throw error;
  return data.signedUrl;
}

export async function signLeadFiles(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}

/* ================= Mẫu tin nhắn ================= */

export type TemplateKey = "lead_invoice" | "lead_followup" | "invoice_terms";

const TEMPLATE_TITLES: Record<TemplateKey, string> = {
  lead_invoice: "Gửi Invoice",
  lead_followup: "Hỏi thăm (follow-up)",
  invoice_terms: "Nội quy khoá học",
};

export interface MessageTemplate {
  key: string;
  title: string;
  body: string;
}

export async function fetchTemplate(key: TemplateKey): Promise<MessageTemplate> {
  const { data, error } = await getSupabase()
    .from("message_templates")
    .select("key, title, body")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as MessageTemplate;
  // Chưa chạy migration hoặc ai đó xoá mất dòng mẫu — vẫn phải gửi được tin
  return { key, title: TEMPLATE_TITLES[key], body: "" };
}

export async function saveTemplate(key: TemplateKey, body: string, updatedBy?: string | null) {
  const { error } = await getSupabase().from("message_templates").upsert({
    key,
    title: TEMPLATE_TITLES[key],
    body,
    updated_by: updatedBy || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Điền tên phụ huynh / học viên / trung tâm vào mẫu. */
export function fillTemplate(
  body: string,
  vars: { parent: string; student?: string | null; center?: string | null },
): string {
  return body
    .replaceAll("{parent}", vars.parent)
    .replaceAll("{student}", vars.student?.trim() || "con")
    .replaceAll("{center}", vars.center?.trim() || "KAT CHINESE");
}
