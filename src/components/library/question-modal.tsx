"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { ErrorNote } from "@/components/ui/loading";
import { QuestionVisualPreview } from "@/components/question-visuals";
import { useAuth } from "@/components/auth/auth-provider";
import { dbErrorMessage } from "@/lib/db";
import { createQuestion, updateQuestion, shuffleTokens, CHOICE_LETTERS, MATCHING_LETTERS, readTokenOrder, QUESTION_TYPE_LABELS, type LessonRow, type QuestionAnswer, type QuestionContent, type QuestionRow, type QuestionType } from "@/lib/db-content";
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
  const [imageUrl, setImageUrl] = useState(question?.content.image?.url ?? "");
  const [imageAlt, setImageAlt] = useState(question?.content.image?.alt ?? "");
  const [pinyinMode, setPinyinMode] = useState<"auto" | "hidden">(question?.content.pinyin_mode ?? "auto");
  const [responseMode, setResponseMode] = useState<"text" | "drawing" | "oral" | "ordering">(question?.content.response_mode ?? "text");

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
  const writtenAnswer = answer && typeof answer === "object" && !Array.isArray(answer) ? answer : {};
  const [writtenHanzi, setWrittenHanzi] = useState(writtenAnswer.hanzi ?? "");
  const [writtenPinyin, setWrittenPinyin] = useState(writtenAnswer.pinyin ?? "");
  const [targetLanguage, setTargetLanguage] = useState<"zh" | "vi">(question?.content.target_language ?? "zh");
  const [acceptedTranslations, setAcceptedTranslations] = useState(question && ["translation", "sentence_correction", "essay"].includes(question.type) ?
    (Array.isArray(answer) ? answer.join("\n") : typeof answer === "string" ? answer : "") : "");
  const [requirePinyin, setRequirePinyin] = useState(question?.content.require_pinyin ?? false);

  // Sắp xếp câu
  const [sentence, setSentence] = useState(
    question?.content.response_mode === "ordering" ? (question.content.tokens ?? []).join("\n") : question?.type === "reorder" ? (Array.isArray(answer) ? answer : readTokenOrder(writtenAnswer.order)).join(" / ") : "",
  );
  const [translation, setTranslation] = useState(question?.content.translation ?? "");

  // Nối từ – nghĩa: dựng lại cặp từ content + answer hiện có
  const initialPairs = useMemo(() => {
    if (question?.type === "multi_matching" && question.content.left && answer && typeof answer === "object" && !Array.isArray(answer)) {
      return question.content.left.map((left, i) => ({ left,
        pinyin: question.content.columns?.[0]?.options[MATCHING_LETTERS.findIndex(c => c.toLowerCase() === answer[`${i}:0`])] ?? "",
        right: question.content.columns?.[1]?.options[MATCHING_LETTERS.findIndex(c => c.toLowerCase() === answer[`${i}:1`])] ?? "" }));
    }
    if (question?.type === "matching" && question.content.left && question.content.right && answer) {
      const map = answer as Record<string, string>;
      return question.content.left.map((l, i) => {
        const letter = map[String(i)] ?? "";
        const j = MATCHING_LETTERS.findIndex((c) => c.toLowerCase() === letter.toLowerCase());
        return { left: l, pinyin: "", right: question.content.right?.[j] ?? "" };
      });
    }
    return [
      { left: "", pinyin: "", right: "" },
      { left: "", pinyin: "", right: "" },
      { left: "", pinyin: "", right: "" },
    ];
  }, [question, answer]);
  const [pairs, setPairs] = useState(initialPairs);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setOption(i: number, v: string) {
    setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  }
  function setPair(i: number, side: "left" | "right" | "pinyin", v: string) {
    setPairs((p) => p.map((x, j) => (j === i ? { ...x, [side]: v } : x)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    let content: QuestionContent;
    let ans: QuestionAnswer;

    if (type === "translation" || type === "sentence_correction" || type === "essay") {
      const accepted = [...new Set(acceptedTranslations.split("\n").map(s => s.trim()).filter(Boolean))];
      if (!prompt.trim() || !accepted.length) return setError("Nhập đề bài và ít nhất một đáp án hoặc bài mẫu.");
      content = { prompt: prompt.trim(), passage: passage.trim() || undefined, hint: hint.trim() || undefined, target_language: targetLanguage,
        tokens: type === "essay" && responseMode === "ordering" ? sentence.split("\n").map(s => s.trim()).filter(Boolean) : undefined };
      ans = accepted;
    } else if (type === "hanzi_pinyin") {
      if (!prompt.trim() || !writtenHanzi.trim() || !writtenPinyin.trim()) return setError("Nhập đề bài và đủ hai đáp án chữ Hán, Pinyin.");
      content = { prompt: prompt.trim(), hint: hint.trim() || undefined };
      ans = { hanzi: writtenHanzi.trim(), pinyin: writtenPinyin.trim() };
    } else if (type === "reading") {
      if (!passage.trim() || !readingItems.length) return setError("Nhập bài đọc và ít nhất một câu hỏi.");
      if (readingItems.some(item => !item.prompt.trim() || !item.correct.trim() || (item.type === "multiple_choice" && ((item.options ?? []).some(o => !o.trim()) || !CHOICE_LETTERS.slice(0, item.options?.length).includes(item.correct))))) return setError("Nhập đầy đủ câu hỏi, lựa chọn và đáp án đọc hiểu.");
      content = { passage: passage.trim(), items: readingItems.map(({ prompt, type, options, image }) => ({ prompt: prompt.trim(), type, image, options: type === "multiple_choice" ? options?.map(o => o.trim()) : undefined })) };
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
      if (requirePinyin && !writtenPinyin.trim()) return setError("Nhập đáp án Pinyin của câu sắp xếp.");
      // Xáo cụm từ khi lưu — nếu để nguyên thứ tự đúng thì học viên không
      // còn gì để sắp xếp. Đáp án vẫn là thứ tự đúng vừa nhập.
      content = { tokens: shuffleTokens(tokens), translation: translation.trim() || undefined, require_pinyin: requirePinyin };
      ans = requirePinyin ? { hanzi: tokens.join(""), pinyin: writtenPinyin.trim(), order: JSON.stringify(tokens) } : tokens;
    } else {
      // matching
      const valid = pairs.filter(p => p.left.trim() || p.right.trim() || (type === "multi_matching" && p.pinyin.trim()));
      if (valid.length < 2) return setError("Cần ít nhất 2 cặp từ – nghĩa.");
      if (valid.length > MATCHING_LETTERS.length || valid.some(p => !p.left.trim() || !p.right.trim() || (type === "multi_matching" && !p.pinyin.trim()))) return setError("Nhập đủ mỗi dòng (tối đa 26 mục).");
      if (type === "multi_matching") {
        const columns = ["pinyin", "right"].map((side, column) => {
          const values = valid.map((p, i) => ({ text: p[side as "pinyin" | "right"].trim(), i }));
          // Keep the source's unused alternatives when editing a question.
          const extras = (question?.content.columns?.[column]?.options ?? [])
            .filter(text => !values.some(v => v.text === text)).map(text => ({ text, i: -1 }));
          const all = [...values, ...extras];
          return shuffleTokens(all.map((_, i) => String(i))).map(i => all[Number(i)]);
        });
        if (columns.some(values => values.length > MATCHING_LETTERS.length)) return setError("Mỗi cột tối đa 26 lựa chọn.");
        content = { left: valid.map(p => p.left.trim()), columns: columns.map((values, i) => ({
          label: question?.content.columns?.[i]?.label ?? (i === 0 ? "Pinyin" : "Nghĩa"), options: values.map(v => v.text),
          images: question?.content.columns?.[i]?.images ? values.map(v => question.content.columns?.[i]?.images?.[question.content.columns[i].options.indexOf(v.text)] ?? null) : undefined })) };
        ans = Object.fromEntries(valid.flatMap((_, row) => columns.map((values, col) =>
          [`${row}:${col}`, MATCHING_LETTERS[values.findIndex(v => v.i === row)].toLowerCase()])));
      } else {
        // Trộn cột phải để thứ tự hiển thị không trùng thứ tự đáp án
        const paired = valid.map((p, i) => ({ text: p.right.trim(), i }));
        const extras = (question?.content.right ?? []).filter(text => !paired.some(p => p.text === text))
          .map(text => ({ text, i: -1 }));
        if (paired.length + extras.length > MATCHING_LETTERS.length) return setError("Cột phải tối đa 26 lựa chọn.");
        const rightShuffled = [...paired, ...extras]
          .sort(() => Math.random() - 0.5);
        const map: Record<string, string> = {};
        valid.forEach((p, i) => {
          const j = rightShuffled.findIndex((r) => r.i === i);
          map[String(i)] = MATCHING_LETTERS[j].toLowerCase();
        });
        content = {
          left: valid.map((p) => p.left.trim()),
          right: rightShuffled.map((r) => r.text),
          right_images: question?.content.right_images ? rightShuffled.map(r => question.content.right_images?.[question.content.right?.indexOf(r.text) ?? -1] ?? null) : undefined,
        };
        ans = map;
      }
    }

    setSaving(true);
    try {
      const input = { type, content: { ...question?.content, ...content,
        left_images: question?.content.left_images && content.left ? content.left.map(text => question.content.left_images?.[question.content.left?.indexOf(text) ?? -1] ?? null) : undefined,
        left_tts: question?.content.left_tts && content.left ? content.left.map(text => question.content.left_tts?.[question.content.left?.indexOf(text) ?? -1] ?? text) : undefined,
        option_images: question?.content.option_images && content.options ? content.options.map(text => question.content.option_images?.[question.content.options?.indexOf(text) ?? -1] ?? null) : undefined,
        image: imageUrl.trim() ? { url: imageUrl.trim(), alt: imageAlt.trim() } : undefined,
        pinyin_mode: pinyinMode, response_mode: type === "essay" ? responseMode : undefined,
      }, lesson_id: lessonId || null };
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

        <Field label="Phiên âm hỗ trợ (YCT 1–2–3)">
          <Select value={pinyinMode} onChange={e => setPinyinMode(e.target.value as "auto" | "hidden")}>
            <option value="auto">Cho phép bật / tắt</option>
            <option value="hidden">Ẩn để học viên tự làm bài</option>
          </Select>
        </Field>
        <Field label="Hình minh hoạ — đường dẫn ảnh HTTPS">
          <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…" />
        </Field>
        {imageUrl && <Field label="Mô tả hình" required><Input value={imageAlt} onChange={e => setImageAlt(e.target.value)} /></Field>}
        {question && <QuestionVisualPreview content={question.content} />}
        {type === "essay" && <Field label="Cách học viên nộp bài">
          <Select value={responseMode} onChange={e => setResponseMode(e.target.value as "text" | "drawing" | "oral" | "ordering")}>
            <option value="text">Viết câu / đoạn văn</option>
            <option value="drawing">Luyện viết / tô màu / nộp ảnh</option>
            <option value="oral">Bài nói / nộp bản ghi âm</option>
            <option value="ordering">Sắp xếp đoạn văn · giáo viên chấm</option>
          </Select>
        </Field>}

        {(["translation", "sentence_correction", "essay", "hanzi_pinyin"].includes(type)) && <>
          <Field label="Đề bài" required>
            <Textarea rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} />
          </Field>
          {type === "essay" && <Field label="Bài đọc / nội dung luyện nói"><Textarea rows={4} value={passage} onChange={e => setPassage(e.target.value)} /></Field>}
          {type === "essay" && responseMode === "ordering" && <Field label="Các câu cần sắp xếp" hint="Mỗi dòng một câu."><Textarea rows={6} value={sentence} onChange={e => setSentence(e.target.value)} /></Field>}
          {type !== "hanzi_pinyin" ? <>
            <Field label="Ngôn ngữ trả lời"><Select value={targetLanguage} onChange={e => setTargetLanguage(e.target.value as "zh" | "vi")}><option value="zh">Tiếng Trung</option><option value="vi">Tiếng Việt</option></Select></Field>
            <Field label={type === "essay" ? "Bài mẫu cho giáo viên" : "Các đáp án được chấp nhận"} required hint={type === "essay" ? "Giáo viên chấm thủ công; bài mẫu không dùng để chấm tự động và không gửi cho học viên." : "Mỗi dòng một đáp án đúng; có thể khai báo nhiều cách diễn đạt."}>
              <Textarea className={targetLanguage === "zh" ? "zh" : ""} rows={type === "essay" ? 6 : 4} value={acceptedTranslations} onChange={e => setAcceptedTranslations(e.target.value)} />
            </Field>
          </> : <>
            <Field label="Đáp án chữ Hán" required><Textarea className="zh" rows={2} value={writtenHanzi} onChange={e => setWrittenHanzi(e.target.value)} /></Field>
            <Field label="Đáp án Pinyin" required><Input value={writtenPinyin} onChange={e => setWrittenPinyin(e.target.value)} /></Field>
          </>}
          <Field label="Gợi ý"><Input value={hint} onChange={e => setHint(e.target.value)} /></Field>
          {type !== "essay" && <p className="text-xs text-muted-foreground">Chấm theo đáp án đã khai báo, bỏ qua khoảng trắng, chữ hoa và dấu câu; Pinyin vẫn cần đúng dấu thanh.</p>}
        </>}

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
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requirePinyin} onChange={e => setRequirePinyin(e.target.checked)} />Yêu cầu viết thêm Pinyin</label>
            {requirePinyin && <Field label="Đáp án Pinyin" required><Input value={writtenPinyin} onChange={e => setWrittenPinyin(e.target.value)} /></Field>}
          </>
        )}

        {(type === "matching" || type === "multi_matching") && (
          <div>
            <span className="text-sm font-medium">{type === "multi_matching" ? "Các dòng chữ Hán – Pinyin – nghĩa" : "Các cặp từ – nghĩa"}</span>
            <div className="mt-1.5 space-y-2">
              {pairs.map((p, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border p-2 sm:flex sm:items-center">
                  <Input
                    value={p.left}
                    onChange={(e) => setPair(i, "left", e.target.value)}
                    className="zh"
                    placeholder="咖啡"
                  />
                  <span className="text-muted-foreground">=</span>
                  {type === "multi_matching" && <Input value={p.pinyin} onChange={e => setPair(i, "pinyin", e.target.value)} placeholder="Pinyin" />}
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
            {pairs.length < MATCHING_LETTERS.length && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setPairs((ps) => [...ps, { left: "", pinyin: "", right: "" }])}
              >
                <Plus className="h-3.5 w-3.5" /> Thêm cặp
              </Button>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              {type === "multi_matching" ? "Hai cột Pinyin và nghĩa được trộn độc lập; học viên chọn cả hai cho mỗi từ." : "Cột nghĩa được trộn thứ tự; học viên chọn nghĩa đúng cho từng từ."}
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
