"use client";

import { useState } from "react";
import { Library, Pencil, Plus, Search, Trash2, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage, LEVELS, LEVEL_LABELS } from "@/lib/db";
import {
  createVocabItem,
  deleteVocabItem,
  fetchVocabItems,
  updateVocabItem,
  type VocabRow,
} from "@/lib/db-content";

function speakVocab(v: VocabRow) {
  if (v.audio_url) {
    new Audio(v.audio_url).play().catch(() => {});
    return;
  }
  const u = new SpeechSynthesisUtterance(v.hanzi);
  u.lang = "zh-CN";
  u.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export default function TeacherVocabPage() {
  const [q, setQ] = useState("");
  const vocab = useLoad(() => fetchVocabItems(q), [q]);
  const [editing, setEditing] = useState<VocabRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(v: VocabRow) {
    if (!confirm(`Xóa từ "${v.hanzi}" (${v.meaning})? Từ sẽ bị gỡ khỏi các bài học đang dùng.`)) return;
    setError(null);
    try {
      await deleteVocabItem(v.id);
      vocab.reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Kho từ vựng</h1>
          <p className="mt-1 text-muted-foreground">
            {vocab.loading ? "Đang tải..." : `${vocab.data?.length ?? 0} từ vựng dùng chung toàn trung tâm.`}
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Thêm từ
        </Button>
      </div>

      {error && <ErrorNote message={error} />}
      {vocab.error && <ErrorNote message={vocab.error} />}

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm Hán tự, pinyin, nghĩa..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {vocab.loading ? (
        <Card><LoadingRows rows={5} /></Card>
      ) : (vocab.data?.length ?? 0) === 0 ? (
        <Empty
          icon={Library}
          title={q ? "Không tìm thấy từ phù hợp" : "Kho từ vựng đang trống"}
          description={q ? "Thử từ khóa khác." : "Bấm “Thêm từ” để xây kho từ vựng cho flashcard và bài học."}
        />
      ) : (
        <Card>
          <div className="divide-y">
            {vocab.data!.map((v) => (
              <div key={v.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/20">
                <div className="zh w-20 shrink-0 text-2xl font-bold text-brand-700">{v.hanzi}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{v.pinyin}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {v.meaning}
                    {v.example?.zh && <span className="zh"> · {v.example.zh}</span>}
                  </div>
                </div>
                {v.level && <Badge variant="outline">{v.level}</Badge>}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => speakVocab(v)}
                    title="Nghe phát âm"
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-brand-50 hover:text-brand-600"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditing(v)}
                    title="Sửa"
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-brand-50 hover:text-brand-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(v)}
                    title="Xóa"
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {editing && (
        <VocabModal
          vocab={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            vocab.reload();
          }}
        />
      )}
    </div>
  );
}

function VocabModal({
  vocab,
  onClose,
  onSaved,
}: {
  vocab: VocabRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [hanzi, setHanzi] = useState(vocab?.hanzi ?? "");
  const [pinyin, setPinyin] = useState(vocab?.pinyin ?? "");
  const [meaning, setMeaning] = useState(vocab?.meaning ?? "");
  const [level, setLevel] = useState(vocab?.level ?? "");
  const [exZh, setExZh] = useState(vocab?.example?.zh ?? "");
  const [exPinyin, setExPinyin] = useState(vocab?.example?.pinyin ?? "");
  const [exVi, setExVi] = useState(vocab?.example?.vi ?? "");
  const [audioUrl, setAudioUrl] = useState(vocab?.audio_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    const input = {
      hanzi: hanzi.trim(),
      pinyin: pinyin.trim(),
      meaning: meaning.trim(),
      level: level || null,
      example: exZh.trim()
        ? { zh: exZh.trim(), pinyin: exPinyin.trim() || undefined, vi: exVi.trim() }
        : null,
      audio_url: audioUrl.trim() || null,
    };
    try {
      if (vocab) await updateVocabItem(vocab.id, input);
      else await createVocabItem(input, user.id);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={vocab ? `Sửa từ — ${vocab.hanzi}` : "Thêm từ vựng"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hán tự" required>
            <Input value={hanzi} onChange={(e) => setHanzi(e.target.value)} placeholder="你好" className="zh text-lg" required autoFocus />
          </Field>
          <Field label="Pinyin" required>
            <Input value={pinyin} onChange={(e) => setPinyin(e.target.value)} placeholder="nǐ hǎo" required />
          </Field>
        </div>
        <Field label="Nghĩa tiếng Việt" required>
          <Input value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="xin chào" required />
        </Field>
        <Field label="Cấp độ">
          <Select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">— Không gắn —</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Câu ví dụ (tiếng Trung)">
          <Textarea value={exZh} onChange={(e) => setExZh(e.target.value)} placeholder="你好，我叫小明。" rows={2} />
        </Field>
        {exZh.trim() && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pinyin ví dụ">
              <Input value={exPinyin} onChange={(e) => setExPinyin(e.target.value)} placeholder="Nǐ hǎo, wǒ jiào Xiǎomíng." />
            </Field>
            <Field label="Nghĩa ví dụ">
              <Input value={exVi} onChange={(e) => setExVi(e.target.value)} placeholder="Xin chào, tôi tên Tiểu Minh." />
            </Field>
          </div>
        )}
        <Field label="Link audio phát âm (không bắt buộc)" hint="Bỏ trống → dùng giọng đọc máy (zh-CN).">
          <Input value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="https://..." />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : vocab ? "Lưu thay đổi" : "Thêm từ"}</Button>
        </div>
      </form>
    </Modal>
  );
}
