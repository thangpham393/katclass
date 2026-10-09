"use client";

import { useMemo } from "react";
import { Play, Volume2 } from "lucide-react";
import { QuestionImage, QuestionText } from "@/components/question-visuals";
import { ManualResponseInput } from "@/components/question-manual-response";
import { QuestionDialogue } from "@/components/question-dialogue";
import { parseDialogue } from "@/lib/question-dialogue";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CHOICE_LETTERS, MATCHING_LETTERS, readTokenOrder, shuffleTokens, type QuestionRow, type QuestionAnswer } from "@/lib/db-content";
import { textWithoutEmbeddedPinyin } from "@/lib/question-pinyin";

function speak(text: string) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/** Có chứa chữ Hán không — để chọn font hiển thị phù hợp. */
function hasHanzi(s: string | undefined): boolean {
  return Boolean(s && /[一-鿿]/.test(s));
}

export function QuestionInput({
  question: q,
  value,
  onChange,
}: {
  question: QuestionRow;
  value: QuestionAnswer | undefined;
  onChange: (v: QuestionAnswer) => void;
}) {
  switch (q.type) {
    case "translation":
    case "sentence_correction":
    case "essay": {
      const dialogue = parseDialogue(q.content.prompt ?? "");
      const inlineReply = dialogue && !dialogue.turns.at(-1)?.text && (!q.content.response_mode || q.content.response_mode === "text");
      const response = <Textarea aria-label={q.type === "essay" ? "Bài viết" : q.type === "sentence_correction" ? "Câu đã sửa" : q.content.target_language === "vi" ? "Bản dịch tiếng Việt" : "Bản dịch tiếng Trung"}
        className={q.content.target_language === "vi" ? "" : "zh"} rows={inlineReply ? 2 : q.type === "essay" ? 6 : 3} value={typeof value === "string" ? value : ""}
        onChange={e => onChange(e.target.value)} placeholder={inlineReply ? "Viết lời đáp của bạn…" : q.type === "essay" ? "Viết đoạn văn của bạn…" : q.type === "sentence_correction" ? "Viết lại câu đúng…" : q.content.target_language === "vi" ? "Viết bản dịch tiếng Việt…" : "Viết bản dịch bằng chữ Hán…"} />;
      return <div className="space-y-2">
        {q.content.passage && <div className="zh rounded-xl bg-secondary p-4"><QuestionDialogue text={q.content.passage} /></div>}
        <QuestionDialogue text={q.content.prompt ?? ""} renderTurn={inlineReply ? (turn, i) => i === dialogue.turns.length - 1 ? response : <QuestionText text={turn.text} /> : undefined} />
        {q.type === "essay" && q.content.response_mode === "ordering"
          ? <ReorderInput q={q} value={typeof value === "string" ? readTokenOrder(value) : []} onChange={tokens => onChange(JSON.stringify(tokens))} />
          : q.type === "essay" && ["drawing", "oral"].includes(q.content.response_mode ?? "")
          ? <ManualResponseInput content={q.content} value={typeof value === "string" ? value : ""} onChange={onChange} />
          : !inlineReply && response}
        {q.type === "essay" && <p className="text-sm text-muted-foreground">Giáo viên sẽ đọc và chấm bài viết của bạn.</p>}
        {q.content.response_mode === "oral" && q.content.passage && <Button type="button" variant="outline" onClick={() => speak(q.content.passage!)}><Volume2 className="mr-2 h-4 w-4" />Nghe mẫu</Button>}
        {q.content.hint && <p className="text-sm text-muted-foreground"><QuestionText text={q.content.hint} /></p>}
      </div>;
    }
    case "hanzi_pinyin":
      return <WrittenPairInput q={q} value={value && typeof value === "object" && !Array.isArray(value) ? value : {}} onChange={onChange} />;
    case "multi_matching":
      return <MultiMatchingInput q={q} value={value && typeof value === "object" && !Array.isArray(value) ? value : {}} onChange={onChange} />;
    case "reading": {
      const responses = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      return <div className="space-y-4">
        <div className="zh rounded-xl bg-secondary p-4"><QuestionDialogue text={q.content.passage ?? ""} /></div>
        {(q.content.items ?? []).map((item, i) => <div key={i} className="space-y-2">
          <div className="font-medium"><span className="mb-1 block text-sm">Câu {i + 1}</span><QuestionDialogue text={item.prompt} /></div><QuestionImage image={item.image} />
          {item.type === "multiple_choice" ? <div className="space-y-2">{item.options?.map((option, k) => <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3"><input type="radio" name={`${q.id}-${i}`} checked={responses[String(i)] === CHOICE_LETTERS[k]} onChange={() => onChange({ ...responses, [String(i)]: CHOICE_LETTERS[k] })} />{CHOICE_LETTERS[k]}. <QuestionText text={option} /></label>)}</div> : <Input value={responses[String(i)] ?? ""} onChange={e => onChange({ ...responses, [String(i)]: e.target.value })} placeholder="Nhập câu trả lời" />}
        </div>)}
      </div>;
    }

    case "multiple_choice":
    case "pinyin_choice":
    case "listening":
      return <ChoiceInput q={q} value={typeof value === "string" ? value : ""} onChange={onChange} />;
    case "fill_blank":
      return <FillBlankInput q={q} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />;
    case "reorder":
      if (q.content.require_pinyin) {
        const pair = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        return <div className="space-y-3">
          <ReorderInput q={q} value={readTokenOrder(pair.order)} onChange={tokens => onChange({ ...pair, hanzi: tokens.join(""), order: JSON.stringify(tokens) })} />
          <label className="block space-y-1 text-sm font-medium">Pinyin
            <Input value={pair.pinyin ?? ""} onChange={e => onChange({ ...pair, pinyin: e.target.value })} placeholder="Viết Pinyin của câu vừa xếp…" />
            <span className="block text-xs font-normal text-muted-foreground">Có thể nhập có dấu, không dấu hoặc dùng số thanh.</span>
          </label>
        </div>;
      }
      return <ReorderInput q={q} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />;
    case "matching":
      return (
        <MatchingInput
          q={q}
          value={value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string>) : {}}
          onChange={onChange}
        />
      );
  }
}

function WrittenPairInput({ q, value, onChange }: {
  q: QuestionRow; value: Record<string, string>; onChange: (v: Record<string, string>) => void;
}) {
  return <div className="space-y-3">
    <QuestionDialogue text={q.content.prompt ?? ""} />
    <label className="block space-y-1 text-sm font-medium">Chữ Hán
      <Textarea className="zh" rows={2} value={value.hanzi ?? ""} onChange={e => onChange({ ...value, hanzi: e.target.value })} placeholder="Nhập chữ Hán…" />
    </label>
    <label className="block space-y-1 text-sm font-medium">Pinyin
      <Input value={value.pinyin ?? ""} onChange={e => onChange({ ...value, pinyin: e.target.value })} placeholder="Ví dụ: ni hao hoặc nǐ hǎo…" />
      <span className="block text-xs font-normal text-muted-foreground">Không bắt buộc dấu thanh. Có thể dùng ü, v hoặc u:.</span>
    </label>
    {q.content.hint && <p className="text-sm text-muted-foreground"><QuestionText text={q.content.hint} /></p>}
  </div>;
}

function MultiMatchingInput({ q, value, onChange }: {
  q: QuestionRow; value: Record<string, string>; onChange: (v: Record<string, string>) => void;
}) {
  return <div className="space-y-3">
    <QuestionDialogue text={q.content.prompt ?? "Nối mỗi chữ Hán với Pinyin và nghĩa tương ứng."} />
    {(q.content.columns ?? []).map((column, col) => column.images && <div key={col} className="space-y-2">
      <p className="text-sm font-medium">{column.label}</p>
      <div className="flex flex-wrap gap-3">{column.images.map((img, i) => img && <figure key={i} className="w-28"><QuestionImage image={img} /><figcaption>{MATCHING_LETTERS[i]}</figcaption></figure>)}</div>
    </div>)}
    {(q.content.left ?? []).map((left, row) => <div key={row} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[6rem_1fr_1fr]">
      <p className="zh self-center text-lg font-bold"><QuestionImage image={q.content.left_images?.[row] ?? undefined} /><QuestionText text={left} /></p>
      {(q.content.columns ?? []).map((column, col) => <label key={col} className="space-y-1 text-sm">
        <span>{column.label}</span>
        <Select value={value[`${row}:${col}`] ?? ""} onChange={e => onChange({ ...value, [`${row}:${col}`]: e.target.value })}>
          <option value="">— Chọn —</option>
          {column.options.map((option, i) => <option key={i} value={MATCHING_LETTERS[i].toLowerCase()}>{MATCHING_LETTERS[i]}. {option}</option>)}
        </Select>
      </label>)}
    </div>)}
  </div>;
}

function ChoiceInput({
  q,
  value,
  onChange,
}: {
  q: QuestionRow;
  value: string;
  onChange: (v: string) => void;
}) {
  const c = q.content;
  const audioText = c.tts;
  const hidePronunciation = q.type === "pinyin_choice" &&
    (q.level?.startsWith("YCT") || q.tags.some(tag => /^yct/i.test(tag)));
  return (
    <div>
      {c.hanzi && (
        <div className="mb-3 flex items-center justify-center">
          {hidePronunciation ? <span className="zh text-3xl font-bold">{c.hanzi}</span> : <button
            type="button"
            onClick={() => speak(c.hanzi!)}
            className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-brand-600 hover:bg-brand-50"
          >
            <Volume2 className="h-4 w-4" />
            <span className="zh text-3xl font-bold"><QuestionText text={c.hanzi} /></span>
          </button>}
        </div>
      )}
      {q.type === "listening" && (
        <div className="mb-3 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (c.audio_url) new Audio(c.audio_url).play().catch(() => {});
              else if (audioText) speak(audioText);
            }}
            className="grid h-16 w-16 place-items-center rounded-full bg-gradient-brand text-white shadow-soft transition-transform hover:scale-105"
          >
            <Volume2 className="h-7 w-7" />
          </button>
          <span className="text-xs text-muted-foreground">Nhấn để nghe</span>
        </div>
      )}
      {c.prompt && (
        <div className={cn("whitespace-pre-line text-base font-semibold", hasHanzi(c.prompt) && "zh text-lg")}>
          <QuestionDialogue text={c.prompt} />
        </div>
      )}
      {c.passage && (
        <div
          className={cn(
            "mt-3 whitespace-pre-line rounded-xl border bg-muted/40 p-4 leading-relaxed",
            hasHanzi(c.passage) ? "zh text-lg" : "text-sm",
          )}
        >
          <QuestionDialogue text={c.passage} />
        </div>
      )}
      {c.hint && <div className="mt-2 text-xs text-muted-foreground">Gợi ý: <QuestionText text={c.hint} /></div>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(c.options ?? []).map((opt, i) => {
          const letter = CHOICE_LETTERS[i];
          const active = value === letter;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(letter)}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left text-sm font-medium transition-all",
                active
                  ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                  : "hover:border-brand-300 hover:bg-brand-50/40",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                  active ? "border-brand-500 bg-brand-600 text-white" : "text-muted-foreground",
                )}
              >
                {letter}
              </span>
              <span className={cn(hasHanzi(opt) && "zh text-lg")}><QuestionImage image={c.option_images?.[i] ?? undefined} /><QuestionText text={opt} /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FillBlankInput({
  q,
  value,
  onChange,
}: {
  q: QuestionRow;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const parts = (q.content.prompt ?? "").split("___");
  const blanks = Math.max(parts.length - 1, 1);
  const vals = Array.from({ length: blanks }, (_, i) => value[i] ?? "");

  function setBlank(i: number, s: string) {
    const next = [...vals];
    next[i] = s;
    onChange(next);
  }

  const dialogue = parseDialogue(q.content.prompt ?? "");
  function renderBlanks(text: string, offset: number) {
    return text.split("___").map((part, i, all) => <span key={i}>
      <QuestionText text={part} />
      {i < all.length - 1 && <input aria-label={`Chỗ trống ${offset + i + 1}`} value={vals[offset + i] ?? ""}
        onChange={e => setBlank(offset + i, e.target.value)} placeholder={`(${offset + i + 1})`}
        className="mx-1 inline-block w-28 max-w-full rounded-lg border-2 border-brand-300 bg-card px-2 py-1 text-center text-base text-foreground outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200" />}
    </span>);
  }

  return (
    <div>
      <div className="zh whitespace-pre-wrap rounded-xl bg-muted/50 p-4 text-xl leading-loose">
        {dialogue ? <QuestionDialogue text={q.content.prompt ?? ""} renderTurn={(turn, i) =>
          renderBlanks(turn.text, dialogue.turns.slice(0, i).reduce((n, previous) => n + previous.text.split("___").length - 1, 0))} />
          : renderBlanks(q.content.prompt ?? "", 0)}
      </div>
      {q.content.hint && (
        <div className="mt-2 text-xs text-muted-foreground">Gợi ý: <QuestionText text={q.content.hint} /></div>
      )}
      {parts.length === 1 && <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {vals.map((v, i) => (
          <Input
            key={i}
            value={v}
            onChange={(e) => setBlank(i, e.target.value)}
            placeholder={blanks > 1 ? `Chỗ trống ${i + 1}` : "Nhập đáp án..."}
          />
        ))}
      </div>}
    </div>
  );
}

function ReorderInput({
  q,
  value,
  onChange,
}: {
  q: QuestionRow;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  // Xáo lại ngay lúc hiển thị, cố định theo id câu hỏi: câu cũ lỡ lưu đúng
  // thứ tự vẫn thành đề sắp xếp thật, và học viên mở lại vẫn thấy y như cũ.
  const tokens = useMemo(() => shuffleTokens(q.content.tokens ?? [], q.id), [q.content.tokens, q.id]);
  // Pool = các token chưa dùng (theo số lần xuất hiện, vì token có thể lặp)
  const pool = useMemo(() => {
    const used = new Map<string, number>();
    for (const t of value) used.set(t, (used.get(t) ?? 0) + 1);
    return tokens.filter((t) => {
      const n = used.get(t) ?? 0;
      if (n > 0) {
        used.set(t, n - 1);
        return false;
      }
      return true;
    });
  }, [tokens, value]);

  return (
    <div>
      {q.content.translation && (
        <p className="text-sm text-muted-foreground">Nghĩa: {q.content.translation}</p>
      )}
      <div className="zh mt-3 flex min-h-[64px] flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-3 text-xl">
        {value.length === 0 && (
          <span className="text-sm text-muted-foreground">Nhấn các từ bên dưới để xếp câu...</span>
        )}
        {value.map((t, i) => (
          <button
            key={`${t}-${i}`}
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded-xl bg-card px-3 py-1.5 shadow-sm hover:bg-rose-50"
          >
            <QuestionText text={t} />
          </button>
        ))}
      </div>
      <div className="zh mt-3 flex flex-wrap gap-2">
        {pool.map((t, i) => (
          <button
            key={`${t}-${i}`}
            type="button"
            onClick={() => onChange([...value, t])}
            className="rounded-xl border bg-card px-4 py-2 text-lg hover:bg-brand-50"
          >
            <QuestionText text={t} />
          </button>
        ))}
      </div>
    </div>
  );
}

function MatchingInput({
  q,
  value,
  onChange,
}: {
  q: QuestionRow;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const left = q.content.left ?? [];
  const right = q.content.right ?? [];
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground"><QuestionDialogue text={q.content.prompt ?? "Chọn mục tương ứng:"} /></div>
      {right.some(hasHanzi) && <div className="grid gap-2 rounded-xl bg-muted/30 p-3 sm:grid-cols-2">{right.map((text, i) => <div key={i} className="zh text-lg leading-loose"><span className="mr-2 font-sans text-sm font-bold">{MATCHING_LETTERS[i]}.</span><QuestionText text={text} /></div>)}</div>}
      {q.content.right_images && <div className="flex flex-wrap gap-3">{q.content.right_images.map((img, i) => img && <figure key={i} className="max-w-28"><QuestionImage image={img} /><figcaption>{MATCHING_LETTERS[i]}</figcaption></figure>)}</div>}
      {left.map((l, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="zh w-20 shrink-0 text-base font-bold text-brand-700 sm:w-28 sm:text-lg">{q.content.left_tts?.[i]
            ? <button type="button" aria-label={`Nghe mục ${i+1}`} onClick={() => speak(q.content.left_tts![i])} className="inline-flex items-center gap-2 rounded-lg border p-2"><Volume2 className="h-5 w-5" />{i+1}</button>
            : <><QuestionImage image={q.content.left_images?.[i] ?? undefined} /><QuestionText text={l} /></>}</div>
          <Select
            wrapClassName="flex-1"
            value={value[String(i)] ?? ""}
            onChange={(e) => onChange({ ...value, [String(i)]: e.target.value })}
          >
            <option value="">— Chọn —</option>
            {right.map((r, j) => (
              <option key={j} value={MATCHING_LETTERS[j].toLowerCase()}>
                {MATCHING_LETTERS[j]}. {textWithoutEmbeddedPinyin(r)}
              </option>
            ))}
          </Select>
        </div>
      ))}
    </div>
  );
}
