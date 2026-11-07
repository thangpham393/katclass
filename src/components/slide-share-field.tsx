"use client";

import { useEffect, useMemo, useState } from "react";
import { FileCode, Loader2, Plus, Presentation, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fetchHtmlSlide,
  fetchSessionSlideContext,
  saveSessionSlideShares,
  searchHtmlSlides,
  type HtmlSlide,
} from "@/lib/db-html-slides";

export interface SlideShareValue {
  /** Đã nạp xong slide đã gửi trước đó — chưa nạp thì không được lưu đè. */
  ready: boolean;
  on: boolean;
  ids: string[];
  /** Slide đã gửi lúc mở form (để biết thêm / thu hồi cái nào). */
  previous: string[];
}

export const EMPTY_SLIDE_SHARE: SlideShareValue = { ready: false, on: false, ids: [], previous: [] };

/** Lỗi cần báo trước khi lưu (tích gửi mà chưa chọn slide nào). */
export function slideShareError(v: SlideShareValue): string | null {
  return v.ready && v.on && !v.ids.length ? "Chọn ít nhất một slide để gửi cho học viên, hoặc bỏ tích “Gửi Slide PPT”." : null;
}

/** Lưu lựa chọn gửi slide — gọi SAU khi chấm công thành công. */
export async function commitSlideShares(sessionId: string, v: SlideShareValue): Promise<void> {
  if (!v.ready) return;
  const ids = v.on ? v.ids : [];
  const same = ids.length === v.previous.length && ids.every((id) => v.previous.includes(id));
  if (same) return;
  await saveSessionSlideShares(sessionId, ids, v.previous);
}

/**
 * Ô “Gửi Slide PPT cho học viên” ở modal chấm công và bước Chốt buổi.
 * Giáo viên tự tích — không gửi tự động. Tích vào thì tích sẵn slide của buổi,
 * chọn thêm slide khác của bài hoặc tìm trong Kho PPT bài giảng.
 */
export function SlideShareField({
  sessionId,
  value,
  onChange,
}: {
  sessionId: string;
  value: SlideShareValue;
  onChange: (v: SlideShareValue) => void;
}) {
  const [defaultSlide, setDefaultSlide] = useState<HtmlSlide | null>(null);
  const [known, setKnown] = useState<HtmlSlide[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [query, setQuery] = useState("");
  const [store, setStore] = useState<HtmlSlide[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let dead = false;
    setLoadError(false);
    fetchSessionSlideContext(sessionId)
      .then((ctx) => {
        if (dead) return;
        setDefaultSlide(ctx.defaultSlide);
        const list: HtmlSlide[] = [];
        for (const s of [...(ctx.defaultSlide ? [ctx.defaultSlide] : []), ...ctx.shared, ...ctx.lessonSlides]) {
          if (!list.some((x) => x.id === s.id)) list.push(s);
        }
        setKnown(list);
        // Quay lại bước trước rồi tới lại (Chốt buổi) thì giữ lựa chọn đang dở
        if (value.ready) {
          for (const id of value.ids) {
            if (!list.some((x) => x.id === id)) fetchHtmlSlide(id).then((s) => !dead && s && setKnown((r) => [...r, s]));
          }
          return;
        }
        const prev = ctx.shared.map((s) => s.id);
        onChange({ ready: true, on: prev.length > 0, ids: prev, previous: prev });
      })
      .catch(() => !dead && setLoadError(true));
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!browsing) return;
    let dead = false;
    setSearching(true);
    const t = window.setTimeout(() => {
      searchHtmlSlides(query, 20)
        .then((rows) => !dead && setStore(rows))
        .catch(() => {})
        .finally(() => !dead && setSearching(false));
    }, 250);
    return () => {
      dead = true;
      window.clearTimeout(t);
    };
  }, [browsing, query]);

  const storeRows = useMemo(() => store.filter((s) => !known.some((k) => k.id === s.id)), [store, known]);

  function toggleOn(on: boolean) {
    // Tích lần đầu → chọn sẵn slide của buổi
    const ids = on && !value.ids.length && defaultSlide ? [defaultSlide.id] : value.ids;
    onChange({ ...value, on, ids });
  }

  function toggleSlide(id: string, checked: boolean) {
    onChange({ ...value, ids: checked ? [...value.ids, id] : value.ids.filter((x) => x !== id) });
  }

  function addFromStore(s: HtmlSlide) {
    setKnown((rows) => (rows.some((r) => r.id === s.id) ? rows : [...rows, s]));
    if (!value.ids.includes(s.id)) onChange({ ...value, ids: [...value.ids, s.id] });
  }

  if (loadError) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Không tải được danh sách slide để gửi cho học viên — có thể gửi lại sau ở lần sửa chấm công.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={value.on}
          disabled={!value.ready}
          onChange={(e) => toggleOn(e.target.checked)}
          className="h-4 w-4 accent-brand-600"
        />
        <Presentation className="h-4 w-4 text-brand-600" />
        Gửi Slide PPT cho học viên
        {!value.ready && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {value.ready && value.previous.length > 0 && (
          <span className="text-xs font-normal text-emerald-700">· đã gửi {value.previous.length} slide</span>
        )}
      </label>

      {value.on && (
        <div className="space-y-2 pl-6">
          <p className="text-xs text-muted-foreground">
            Học viên xem lại ở mục ôn tập bài đã học, cạnh flashcard từ vựng và ngữ pháp của bài.
          </p>
          {known.length === 0 ? (
            <p className="text-xs text-muted-foreground">Buổi này chưa có slide — tìm trong kho bên dưới.</p>
          ) : (
            <div className="space-y-1">
              {known.map((s) => (
                <label
                  key={s.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm",
                    value.ids.includes(s.id) && "border-brand-300 bg-brand-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={value.ids.includes(s.id)}
                    onChange={(e) => toggleSlide(s.id, e.target.checked)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <FileCode className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {defaultSlide?.id === s.id && (
                    <span className="shrink-0 text-xs text-muted-foreground">slide của buổi</span>
                  )}
                </label>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setBrowsing((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            <Plus className="h-3.5 w-3.5" /> Chọn thêm slide khác trong kho
          </button>

          {browsing && (
            <div className="space-y-2 rounded-lg border p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm theo tên slide…"
                  className="h-8 pl-8 text-sm"
                />
              </div>
              <div className="max-h-48 space-y-0.5 overflow-y-auto">
                {searching && !storeRows.length ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">Đang tìm…</p>
                ) : storeRows.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    {query.trim() ? "Không tìm thấy slide nào" : "Không còn slide nào khác"}
                  </p>
                ) : (
                  storeRows.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => addFromStore(s)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString("vi-VN")}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {value.ready && !value.on && value.previous.length > 0 && (
        <p className="pl-6 text-xs text-amber-700">Bỏ tích và lưu sẽ thu hồi slide đã gửi cho học viên.</p>
      )}
    </div>
  );
}
