"use client";

import { useState } from "react";
import { fetchMyHomeworkReview, QUESTION_TYPE_LABELS, type QuestionRow } from "@/lib/db-content";
import { reviewAnswerText, reviewStatus, type QuestionReview, type ReviewPart } from "@/lib/homework-review";
import { sourceQuestionLabel } from "@/lib/question-order";
import { pinyinAllowed } from "@/lib/question-pinyin";
import { useLoad } from "@/lib/use-load";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { ErrorNote, LoadingRows } from "./ui/loading";
import { QuestionImage, QuestionPinyinContext, QuestionText } from "./question-visuals";
import { QuestionInput } from "./question-player-input";
import { WorkbookQuestionList } from "./workbook-question-list";
import { isManualMedia } from "./question-manual-response";

const labels = { correct: "Đúng", incorrect: "Sai", partial: "Đúng một phần", skipped: "Bỏ trống", manual: "Giáo viên chấm" };

export function HomeworkReviewPanel({ homeworkId, questions, showPinyin }: { homeworkId: string; questions: QuestionRow[]; showPinyin: boolean }) {
  const review = useLoad(() => fetchMyHomeworkReview(homeworkId), [homeworkId]);
  const [filter, setFilter] = useState<"all" | "incorrect">("all");
  if (review.loading) return <Card><LoadingRows rows={4} /></Card>;
  if (review.error) return <div className="space-y-2"><ErrorNote message={`Chưa tải được chi tiết kết quả: ${review.error}`} /><Button variant="outline" onClick={review.reload}>Thử tải lại kết quả</Button></div>;
  if (!review.data) return null;
  const byId = new Map(review.data.questions.map(q => [q.question_id, q]));
  // Use the content saved at submission time so a later edit cannot change this review.
  const rows = questions.filter(q => byId.has(q.id)).map(q => ({ ...q, type: byId.get(q.id)!.type, content: byId.get(q.id)!.content }));
  const wrong = review.data.questions.filter(q => ["incorrect", "partial", "skipped"].includes(reviewStatus(q))).length;
  const correct = review.data.questions.filter(q => reviewStatus(q) === "correct").length;
  const visible = rows.filter(q => filter === "all" || ["incorrect", "partial", "skipped"].includes(reviewStatus(byId.get(q.id)!)));
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">Xem lại bài làm</h2><p className="mt-1 text-sm text-muted-foreground">{correct} câu đúng · {wrong} câu cần xem lại. Đáp án và cách tính điểm ở từng câu bên dưới.</p></div>
      <div className="flex gap-2"><Button variant={filter === "all" ? "secondary" : "outline"} onClick={() => setFilter("all")}>Tất cả</Button><Button variant={filter === "incorrect" ? "secondary" : "outline"} onClick={() => setFilter("incorrect")}>Cần xem lại ({wrong})</Button></div>
    </div>
    {review.data.legacy && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Lượt nộp này dùng quy tắc chấm cũ. Điểm đã lưu được giữ nguyên; phần đối chiếu dựa trên đáp án hiện có. Các lượt nộp mới chấp nhận Pinyin không dấu.</p>}
    {!visible.length && <p className="rounded-xl border p-5 text-center text-sm text-muted-foreground">Không có câu cần xem lại.</p>}
    <WorkbookQuestionList questions={visible} introQuestions={rows} showPinyin={showPinyin} prefix="review" renderQuestion={(q, index) => {
      const detail = byId.get(q.id)!;
      const status = reviewStatus(detail);
      const actual = detail.actual;
      return <Card key={q.id}><CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{sourceQuestionLabel(q, index)}</span><Badge variant="outline">{QUESTION_TYPE_LABELS[q.type]}</Badge></div>
          <Badge variant={status === "correct" ? "jade" : status === "manual" ? "muted" : "gold"}>{labels[status]}{detail.total > 0 ? ` · ${detail.correct}/${detail.total}` : ""}</Badge>
        </div>
        <QuestionPinyinContext.Provider value={{ show: showPinyin && pinyinAllowed(q), dictionary: q.content.pinyin }}>
          <fieldset disabled className="min-w-0 space-y-3"><QuestionImage image={q.content.image} /><QuestionInput question={q} value={actual} onChange={() => {}} /></fieldset>
          <div className="space-y-3">{detail.parts.map(part => <ReviewPartRow key={part.key} detail={detail} part={part} />)}</div>
          {detail.explanation && <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm leading-relaxed"><p className="mb-1 font-semibold">Giải thích</p><QuestionText text={detail.explanation} /></div>}
        </QuestionPinyinContext.Provider>
      </CardContent></Card>;
    }} />
  </div>;
}

function ReviewPartRow({ detail, part }: { detail: QuestionReview; part: ReviewPart }) {
  return <div className={`space-y-2 rounded-xl border p-3 text-sm ${part.correct === true ? "border-emerald-200 bg-emerald-50/50" : part.correct === null ? "bg-muted/30" : "border-rose-200 bg-rose-50/50"}`}>
    <p className="font-semibold">{part.label} · {part.correct === null ? "Chờ giáo viên chấm" : part.correct ? "Đúng" : "Chưa đúng"}</p>
    {!(typeof part.actual === "string" && isManualMedia(part.actual)) && <p className="whitespace-pre-wrap break-words"><span className="text-muted-foreground">Bạn trả lời: </span><QuestionText text={reviewAnswerText(detail, part, part.actual)} /></p>}
    {part.expected != null && <p className="whitespace-pre-wrap break-words"><span className="font-medium text-emerald-800">{["translation", "sentence_correction"].includes(detail.type) ? "Mẫu được chấp nhận: " : "Đáp án đúng: "}</span><QuestionText text={reviewAnswerText(detail, part, part.expected)} /></p>}
    <p className="text-xs leading-relaxed text-muted-foreground">{part.reason}</p>
  </div>;
}
