"use client";

import { Award, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/loading";
import { useLoad } from "@/lib/use-load";
import { fetchStudentReviews, type ReviewStats } from "@/lib/db-reviews";

/**
 * Nhận xét TỔNG KẾT theo kỳ (migration 0043) — bản dài giáo viên viết cho
 * cả tháng/khóa, khác với nhận xét từng buổi ngay bên dưới nó. RLS đã lọc
 * sẵn bản nháp nên ở đây cứ hiện hết những gì đọc được.
 *
 * Dùng chung cho khu học viên và cổng phụ huynh — chỉ khác đại từ xưng hô
 * nên truyền qua `subject`.
 */
export function StudentReviewList({
  studentId,
  subject = "Bạn",
}: {
  studentId: string;
  subject?: string;
}) {
  const reviews = useLoad(() => fetchStudentReviews(studentId, 6), [studentId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-4 w-4 text-brand-600" /> Nhận xét tổng kết theo kỳ
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {reviews.loading ? (
          <LoadingRows rows={2} className="p-0" />
        ) : (reviews.data?.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Chưa có bản tổng kết nào — giáo viên gửi vào cuối mỗi tháng hoặc cuối khóa.
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.data!.map((r) => {
              const s = (r.stats ?? {}) as Partial<ReviewStats>;
              return (
                <div key={r.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{r.title}</span>
                    {r.rating != null && (
                      <span className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={
                              n <= r.rating!
                                ? "h-4 w-4 fill-gold-500 text-gold-500"
                                : "h-4 w-4 text-muted-foreground/30"
                            }
                          />
                        ))}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {r.teacher?.name ?? "Giáo viên"} ·{" "}
                      {new Date(r.period_start + "T00:00:00").toLocaleDateString("vi-VN")} –{" "}
                      {new Date(r.period_end + "T00:00:00").toLocaleDateString("vi-VN")}
                    </span>
                  </div>

                  {(s.sessions ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Có mặt <b className="text-foreground">{s.present ?? 0}/{s.sessions}</b> buổi
                      </span>
                      {(s.stars ?? 0) > 0 && (
                        <span>
                          Tích lũy <b className="text-foreground">{s.stars}★</b>
                        </span>
                      )}
                      {s.avg_rating != null && (
                        <span>
                          Điểm buổi TB <b className="text-foreground">{s.avg_rating}/5</b>
                        </span>
                      )}
                    </div>
                  )}

                  {r.content && <p className="mt-3 text-sm leading-relaxed">{r.content}</p>}
                  {r.strengths && (
                    <p className="mt-2 text-sm leading-relaxed">
                      <b className="text-emerald-700">{subject} làm tốt:</b> {r.strengths}
                    </p>
                  )}
                  {r.improvements && (
                    <p className="mt-1 text-sm leading-relaxed">
                      <b className="text-gold-700">Cần cải thiện:</b> {r.improvements}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
