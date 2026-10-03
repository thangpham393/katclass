"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ErrorNote, LoadingRows } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage } from "@/lib/db";
import { fetchLessons, fetchQuestions, questionPreview, QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/db-content";
import { fetchTestTemplates, saveTestTemplate, deleteTestTemplate, TEST_CATEGORY_LABELS, type TestCategory, type TestTemplate } from "@/lib/db-tests";
import { QuestionModal } from "@/components/library/question-modal";

export default function TestLibraryPage() {
  const { user } = useAuth();
  const templates = useLoad(fetchTestTemplates);
  const questions = useLoad(() => fetchQuestions());
  const lessons = useLoad(fetchLessons);
  const [editing, setEditing] = useState<TestTemplate | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TestCategory>("lesson");
  const [minutes, setMinutes] = useState("15");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<QuestionType | "">("");
  const [newQuestion, setNewQuestion] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = user?.role === "teacher" || user?.role === "admin";
  function edit(template: TestTemplate | "new") {
    setEditing(template); setTitle(template === "new" ? "" : template.title);
    setCategory(template === "new" ? "lesson" : template.category);
    setMinutes(String(template === "new" ? 15 : template.time_limit_minutes));
    setSelected(template === "new" ? [] : template.question_ids); setError(null);
  }
  async function save() {
    if (!user || !editing) return;
    if (!title.trim() || !selected.length || !Number.isInteger(Number(minutes)) || Number(minutes) <= 0) return setError("Nhập tên đề, thời gian nguyên dương và chọn ít nhất một câu hỏi.");
    setSaving(true); setError(null);
    try { await saveTestTemplate({ id: editing === "new" ? undefined : editing.id, title: title.trim(), category, time_limit_minutes: Number(minutes), question_ids: selected, created_by: user.id }); setEditing(null); templates.reload(); }
    catch (e) { setError(dbErrorMessage(e)); } finally { setSaving(false); }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold">Bài kiểm tra</h1><p className="mt-1 text-muted-foreground">Soạn đề kết thúc bài, giữa kỳ và cuối kỳ để giao cho học viên.</p></div>{canManage && <Button onClick={() => edit("new")}>Tạo bài kiểm tra</Button>}</div>
    {error && <ErrorNote message={error} />}{templates.error && <ErrorNote message={templates.error} />}
    <Input placeholder="Tìm bài kiểm tra…" value={search} onChange={e => setSearch(e.target.value)} />
    {templates.loading ? <LoadingRows rows={4} /> : <div className="grid gap-4 md:grid-cols-2">{(templates.data ?? []).filter(t => t.title.toLowerCase().includes(search.toLowerCase())).map(t => <Card key={t.id}><CardContent className="space-y-3 p-5"><h2 className="font-bold">{t.title}</h2><p className="text-sm text-muted-foreground">{TEST_CATEGORY_LABELS[t.category]} · {t.time_limit_minutes} phút · {t.question_ids.length} câu / phần</p><div className="flex gap-2">{canManage && (user?.role === "admin" || t.created_by === user?.id) && <><Button variant="outline" onClick={() => edit(t)}>Sửa đề</Button><Button variant="outline" onClick={async () => { if (!confirm("Xóa đề kiểm tra khỏi thư viện?")) return; try { await deleteTestTemplate(t.id); templates.reload(); } catch(e) { setError(dbErrorMessage(e)); } }}>Xóa</Button></>}<Link href={`/teacher/homework/new?test=${t.id}`}><Button>Giao kiểm tra</Button></Link></div></CardContent></Card>)}</div>}
    {!templates.loading && !templates.data?.length && <p className="text-muted-foreground">Chưa có đề kiểm tra. Tạo đề đầu tiên để giao cho lớp.</p>}
    {editing && <Modal open onClose={() => !saving && setEditing(null)} title={editing === "new" ? "Tạo bài kiểm tra" : "Sửa bài kiểm tra"}><div className="space-y-4">
      {error && <ErrorNote message={error} />}
      <Field label="Tên bài kiểm tra"><Input value={title} onChange={e => setTitle(e.target.value)} /></Field>
      <Field label="Loại kiểm tra"><Select value={category} onChange={e => setCategory(e.target.value as TestCategory)}>{Object.entries(TEST_CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
      <Field label="Thời gian làm bài (phút)"><Input type="number" min={1} value={minutes} onChange={e => setMinutes(e.target.value)} /></Field>
      <div className="flex gap-2"><Select value={type} onChange={e => setType(e.target.value as QuestionType | "")}><option value="">Mọi dạng câu hỏi</option>{Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select><Button variant="outline" onClick={() => setNewQuestion(true)}>Tạo câu hỏi</Button></div>
      <p className="text-sm">Đã chọn {selected.length} câu / phần, theo thứ tự chọn.</p>
      {questions.error && <ErrorNote message={questions.error} />}
      <div className="max-h-80 space-y-2 overflow-y-auto">{questions.loading ? <LoadingRows rows={3} /> : (questions.data ?? []).filter(q => !type || q.type === type).map(q => <label key={q.id} className="flex items-start gap-2 rounded-lg border p-3"><input type="checkbox" checked={selected.includes(q.id)} onChange={() => setSelected(ids => ids.includes(q.id) ? ids.filter(id => id !== q.id) : [...ids, q.id])} /><span className="min-w-0 text-sm">{selected.includes(q.id) && `#${selected.indexOf(q.id) + 1} · `}{QUESTION_TYPE_LABELS[q.type]}: {questionPreview(q)}{q.type === "reading" && q.content.items?.map((item, i) => <span className="block text-muted-foreground" key={i}>{i + 1}. {item.prompt}</span>)}</span></label>)}</div>
      <Button disabled={saving} onClick={save}>{saving ? "Đang lưu…" : "Lưu đề kiểm tra"}</Button>
    </div></Modal>}
    {newQuestion && <QuestionModal question={null} answer={undefined} lessons={lessons.data ?? []} onClose={() => setNewQuestion(false)} onSaved={() => { setNewQuestion(false); questions.reload(); }} />}
  </div>;
}
