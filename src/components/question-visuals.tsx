"use client";

import { createContext, useContext } from "react";
import type { QuestionContent } from "@/lib/question-schema";
import { alignPinyin, pinyinSegments, textWithoutEmbeddedPinyin } from "@/lib/question-pinyin";

export const QuestionPinyinContext = createContext<{ show: boolean; dictionary?: Record<string, string> }>({ show: false });

export function QuestionText({ text }: { text?: string }) {
  const { show, dictionary } = useContext(QuestionPinyinContext);
  if (!text) return null;
  if (!show) return <>{textWithoutEmbeddedPinyin(text)}</>;
  const parts = pinyinSegments(text, dictionary).flatMap(part => {
    if (!part.pinyin) return [part];
    const characters = [...part.text];
    const syllables = alignPinyin(part.pinyin, characters.length);
    return syllables && characters.every(c => /[\u3400-\u9fff]/u.test(c))
      ? characters.map((character, i) => ({ text: character, pinyin: syllables[i] })) : [part];
  });
  return <>{parts.map((part, i) => part.pinyin
    ? <ruby key={i} className="question-ruby">{part.text}<rt className="font-sans text-[0.6em] font-normal text-muted-foreground">{part.pinyin}</rt></ruby>
    : <span key={i}>{part.text}</span>)}</>;
}

export function QuestionImage({ image, className = "" }: { image?: { url: string; alt: string }; className?: string }) {
  if (!image) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.url} alt={image.alt} loading="lazy" className={`max-h-96 max-w-full rounded-lg object-contain ${className}`} />;
}

/** Also used by staff previews so image-only questions remain reviewable. */
export function QuestionVisualPreview({ content }: { content: QuestionContent }) {
  const groups = [content.option_images, content.left_images, content.right_images,
    ...(content.columns ?? []).map(column => column.images)].filter(Boolean);
  return <div className="space-y-2">
    <QuestionImage image={content.image} />
    {groups.map((group, i) => <div key={i} className="flex flex-wrap gap-3">{group?.map((img, j) => img && <figure key={j} className="max-w-32"><QuestionImage image={img} /><figcaption className="text-xs">{String.fromCharCode(65+j)}</figcaption></figure>)}</div>)}
    {content.items?.map((item, i) => <QuestionImage key={i} image={item.image} />)}
  </div>;
}
