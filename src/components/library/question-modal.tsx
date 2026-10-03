"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { dbErrorMessage } from "@/lib/db";
import { createQuestion, updateQuestion, shuffleTokens, CHOICE_LETTERS, QUESTION_TYPE_LABELS, type LessonRow, type QuestionAnswer, type QuestionContent, type QuestionRow, type QuestionType } from "@/lib/db-content";
export function QuestionModal({
  question,
  answer,
  lessons,
  onClose,
  onSaved,
}: {
  question: QuestionRow | null;
  answer: QuestionAnswer | undefined;
  lessons: LessonRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [type, setType] = useState<QuestionType>(question?.type ?? "multiple_choice");
  const [lessonId, setLessonId] = useState(question?.lesson_id ?? "");

  // Choice (trắc nghiệm / pinyin / nghe)
  const [prompt, setPrompt] = useState(question?.content.prompt ?? "");
  const [hanzi, setHanzi] = useState(question?.content.hanzi ?? "");
  const [tts, setTts] = useState(question?.content.tts ?? "");
  const [options, setOptions] = useState<string[]>(
    question?.content.options?.length ? question.content.options : ["", "", "", ""],
  );
  const [correct, setCorrect] = useState<string>(
    typeof answer === "string" ? answer : "A",
  );

  // Điền từ
  const [blanks, setBlanks] = useState<string>(
    Array.isArray(answer) && question?.type === "fill_blank" ? (answer as string[]).join(" | ") : "",
  );
  const [passage, setPassage] = useState(question?.content.passage ?? "");
  const [readingItems, setReadingItems] = useState((question?.content.items ?? [{ prompt: "", type: "multiple_choice" as const, options: ["", "", "", ""] }]).map((item, i) => ({ ...item, correct: answer && typeof answer === "object" && !Array.isArray(answer) ? answer[String(i)] ?? "" : "" })));
  const [hint, setHint] = useState(question?.content.hint ?? "");

  // Sắp xếp câu
  const [sentence, setSentence] = useState(
    Array.isArray(answer) && question?.type === "reorder" ? (answer as string[]).join(" / ") : "",
  );
  const [translation, setTranslation] = useState(question?.content.translation ?? "");

  // Nối từ – nghĩa: dựng lại cặp từ content + answer hiện có
  const initialPairs = useMemo(() => {
    if (question?.type === "matching" && question.content.left && question.content.right && answer) {
      const map = answer as Record<string, string>;
      return question.content.left.map((l, i) => {
        const letter = map[String(i)] ?? "";
        const j = CHOICE_LETTERS.findIndex((c) => c.toLowerCase() === letter.toLowerCase());
        return { left: l, right: question.content.right?.[j] ?? "" };
      });
    }
    return [
      { left: "", right: "" },
      { left: "", right: "" },
      { left: "", right: "" },
    ];
  }, [question, answer]);
  const [pairs, setPairs] = useState(initialPairs);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setOption(i: number, v: string) {
    setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  }
  function setPair(i: number, side: "left" | "right", v: string) {
    setPairs((p) => p.map((x, j) => (j === i ? { ...x, [side]: v } : x)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    let content: QuestionContent;
    let ans: QuestionAnswer;

    if (type === "reading") {
      if (!passage.trim() || !readingItems.length) return setError("Nhập bài đọc và ít nhất một câu hỏi.");
      if (readingItems.some(item => !item.prompt.trim() || !item.correct.trim() || (item.type === "multiple_choice" && ((item.options ?? []).some(o => !o.trim()) || !CHOICE_LETTERS.slice(0, item.options?.length).includes(item.correct))))) return setError("Nhập đầy đủ câu hỏi, lựa chọn và đáp án đọc hiểu.");
      content = { passage: passage.trim(), items: readingItems.map(({ prompt, type, options }) => ({ prompt: prompt.trim(), type, options: type === "multiple_choice" ? options?.map(o => o.trim()) : undefined })) };
      ans = Object.fromEntries(readingItems.map((item, i) => [String(i), item.correct.trim()]));
    } else if (type === "multiple_choice" || type === "pinyin_choice" || type === "listening") {
      const opts = options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) return setError("Cần ít nhất 2 lựa chọn.");
      if (type === "pinyin_choice" && !hanzi.trim()) return setError("Nhập chữ Hán cần chọn pinyin.");
      if (type === "listening" && !tts.trim()) return setError("Nhập nội dung tiếng Trung để hệ thống đọc.");
      const letterIdx = CHOICE_LETTERS.indexOf(correct);
      if (letterIdx < 0 || letterIdx >= opts.length) return setError("Chọn đáp án đúng trong số lựa chọn đã nhập.");
      content = {
        prompt: prompt.trim() || undefined,
        hanzi: hanzi.trim() || undefined,
        tts: type === "listening" ? tts.trim() : undefined,
        options: opts,
      };
      ans = correct;
    } else if (type === "fill_blank") {
      const blankCount = (prompt.match(/___/g) ?? []).length;
      if (blankCount === 0) return setError("Đề bài cần ít nhất một chỗ trống ___ (3 dấu gạch dưới).");
      const answersArr = blanks.split("|").map((s) => s.trim()).filter(Boolean);
      if (answersArr.length !== blankCount) {
        return setError(`Đề có ${blankCount} chỗ trống nhưng bạn nhập ${answersArr.length} đáp án (ngăn cách bằng dấu |).`);
      }
      content = { prompt: prompt.trim(), hint: hint.trim() || undefined };
      ans = answersArr;
    } else if (type === "reorder") {
      const tokens = sentence.split("/").map((s) => s.trim()).filter(Boolean);
      if (tokens.length < 2) return setError("Nhập câu đúng, ngăn cách các cụm bằng dấu / (ít nhất 2 cụm).");
      // Xáo cụm từ khi lưu — nếu để nguyên thứ tự đúng thì học viên không
      // còn gì để sắp xếp. Đáp án vẫn là thứ tự đúng vừa nhập.
      content = { tokens: shuffleTokens(tokens), translation: translation.trim() || undefined };
      ans = tokens;
    } else {
      // matching
      const valid = pairs.filter((p) => p.left.trim() && p.right.trim());
      if (valid.length < 2) return setError("Cần ít nhất 2 cặp từ – nghĩa.");
      // Trộn cột phải để thứ tự hiển thị không trùng thứ tự đáp án
      const rightShuffled = valid
        .map((p, i) => ({ text: p.right.trim(), i }))
        .sort(() => Math.random() - 0.5);
      const map: Record<string, string> = {};
      valid.forEach((p, i) => {
        const j = rightShuffled.findIndex((r) => r.i === i);
        map[String(i)] = CHOICE_LETTERS[j].toLowerCase();
      });
      content = {
        left: valid.map((p) => p.left.trim()),
        right: rightShuffled.map((r) => r.text),
      };
      ans = map;
    }

    setSaving(true);
    try {
      const input = { type, content, lesson_id: lessonId || null };
      if (question) await updateQuestion(question.id, input, ans);
      else await createQuestion(input, ans, user.id);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(err));
      setSaving(false);
    }
  }

  const isChoice = type === "multiple_choice" || type === "pinyin_choice" || type === "listening";

  return (
    <Modal open onClose={onClose} title={question ? "Sửa câu hỏi" : "Tạo câu hỏi"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dạng câu hỏi">
            <Select value={type} onChange={(e) => setType(e.target.value as QuestionType)} disabled={!!question}>
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Gắn với bài học">
            <Select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              <option value="">— Không gắn —</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.unit != null ? `Bài ${l.unit}: ` : ""}{l.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {type === "reading" && <div className="space-y-4">
          <Field label="Nội dung bài đọc" required><Textarea rows={6} value={passage} onChange={e => setPassage(e.target.value)} /></Field>
          {readingItems.map((item, i) => <div key={i} className="space-y-2 rounded-xl border p-3">
            <Field label={`Câu hỏi ${i + 1}`}><Input value={item.prompt} onChange={e => setReadingItems(items => items.map((x, j) => j === i ? { ...x, prompt: e.target.value } : x))} /></Field>
            <Select value={item.type} onChange={e => setReadingItems(items => items.map((x, j) => j === i ? { ...x, type: e.target.value as "multiple_choice" | "short_answer", correct: "", options: ["", "", "", ""] } : x))}><option value="multiple_choice">Trắc nghiệm</option><option value="short_answer">Điền câu trả lời</option></Select>
            {item.type === "multiple_choice" && item.options?.map((option, k) => <Input key={k} placeholder={`Lựa chọn ${CHOICE_LETTERS[k]}`} value={option} onChange={e => setReadingItems(items => items.map((x, j) => j === i ? { ...x, options: x.options?.map((o, n) => n === k ? e.target.value : o) } : x))} />)}
            <Field label={item.type === "multiple_choice" ? "Đáp án đúng (A, B, C hoặc D)" : "Câu trả lời đúng"} hint={item.type === "short_answer" ? "Hệ thống chấm theo câu trả lời chính xác đã nhập." : undefined}><Input value={item.correct} onChange={e => setReadingItems(items => items.map((x, j) => j === i ? { ...x, correct: item.type === "multiple_choice" ? e.target.value.toUpperCase() : e.target.value } : x))} /></Field>
            <Button type="button" variant="outline" onClick={() => setReadingItems(items => items.filter((_, j) => j !== i))}>Xóa câu hỏi</Button>
          </div>)}
          <Button type="button" variant="secondary" onClick={() => setReadingItems(items => [...items, { prompt: "", type: "multiple_choice", options: ["", "", "", ""], correct: "" }])}>Thêm câu hỏi đọc hiểu</Button>
        </div>}

        {isChoice && (
          <>
            {type === "pinyin_choice" ? (
              <Field label="Chữ Hán" required hint="Học viên chọn pinyin đúng cho chữ này.">
                <Input value={hanzi} onChange={(e) => setHanzi(e.target.value)} className="zh text-lg" placeholder="学习" />
              </Field>
            ) : type === "listening" ? (
              <Field label="Nội dung nghe (tiếng Trung)" required hint="Hệ thống đọc bằng giọng máy zh-CN, học viên nghe rồi chọn.">
                <Input value={tts} onChange={(e) => setTts(e.target.value)} className="zh" placeholder="我喜欢喝咖啡" />
              </Field>
            ) : (
              <Field label="Chữ Hán minh họa (không bắt buộc)">
                <Input value={hanzi} onChange={(e) => setHanzi(e.target.value)} className="zh" placeholder="喜欢" />
              </Field>
            )}
            <Field label={type === "pinyin_choice" ? "Câu hỏi (không bắt buộc)" : "Câu hỏi"}>
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={type === "listening" ? "Bạn nghe thấy gì?" : "“喜欢” nghĩa là gì?"}
              />
            </Field>
            <div>
              <span className="text-sm font-medium">Các lựa chọn & đáp án đúng</span>
              <div className="mt-1.5 space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrect(CHOICE_LETTERS[i])}
                      title="Chọn làm đáp án đúng"
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${
                        correct === CHOICE_LETTERS[i]
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "text-muted-foreground hover:border-emerald-400"
                      }`}
                    >
                      {CHOICE_LETTERS[i]}
                    </button>
                    <Input
                      value={opt}
                      onChange={(e) => setOption(i, e.target.value)}
                      placeholder={`Lựa chọn ${CHOICE_LETTERS[i]}`}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setOptions((o) => o.filter((_, j) => j !== i))}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < CHOICE_LETTERS.length && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setOptions((o) => [...o, ""])}
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm lựa chọn
                </Button>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                Nhấn vào chữ cái tròn để đánh dấu đáp án đúng (đang chọn: <b>{correct}</b>).
              </p>
            </div>
          </>
        )}

        {type === "fill_blank" && (
          <>
            <Field label="Đề bài" required hint="Dùng ___ (3 dấu gạch dưới) cho mỗi chỗ trống.">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                className="zh"
                placeholder="我昨天去___商店，买___一本书。"
              />
            </Field>
            <Field
              label="Đáp án theo thứ tự chỗ trống"
              required
              hint="Nhiều chỗ trống ngăn cách bằng dấu | — vd: 了 | 的"
            >
              <Input value={blanks} onChange={(e) => setBlanks(e.target.value)} className="zh" placeholder="了 | 了" />
            </Field>
            <Field label="Gợi ý (không bắt buộc)">
              <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Trợ từ chỉ hành động đã hoàn thành" />
            </Field>
          </>
        )}

        {type === "reorder" && (
          <>
            <Field label="Câu đúng (tách cụm bằng dấu /)" required hint="Học viên sẽ thấy các cụm bị xáo trộn và xếp lại.">
              <Input
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                className="zh"
                placeholder="我 / 喜欢 / 学习 / 中文"
              />
            </Field>
            <Field label="Nghĩa tiếng Việt (không bắt buộc)">
              <Input value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder="Tôi thích học tiếng Trung." />
            </Field>
          </>
        )}

        {type === "matching" && (
          <div>
            <span className="text-sm font-medium">Các cặp từ – nghĩa</span>
            <div className="mt-1.5 space-y-2">
              {pairs.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={p.left}
                    onChange={(e) => setPair(i, "left", e.target.value)}
                    className="zh"
                    placeholder="咖啡"
                  />
                  <span className="text-muted-foreground">=</span>
                  <Input
                    value={p.right}
                    onChange={(e) => setPair(i, "right", e.target.value)}
                    placeholder="cà phê"
                  />
                  {pairs.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPairs((ps) => ps.filter((_, j) => j !== i))}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {pairs.length < CHOICE_LETTERS.length && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setPairs((ps) => [...ps, { left: "", right: "" }])}
              >
                <Plus className="h-3.5 w-3.5" /> Thêm cặp
              </Button>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Cột nghĩa sẽ được trộn thứ tự khi lưu — học viên chọn nghĩa đúng cho từng từ.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Đang lưu..." : question ? "Lưu thay đổi" : "Tạo câu hỏi"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
