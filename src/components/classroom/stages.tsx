"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Dices,
  Eye,
  EyeOff,
  FolderOpen,
  Loader2,
  MonitorOff,
  Pause,
  Play,
  Presentation,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  speakZh,
  type ClassroomStudent,
} from "@/lib/db-classroom";
import { fetchVocabItems, type LessonDetail, type VocabRow } from "@/lib/db-content";
import { useAuth } from "@/components/auth/auth-provider";
import {
  deleteHtmlSlide,
  downloadHtmlSlide,
  fetchHtmlSlide,
  fetchLessonHtmlSlides,
  isHtmlFile,
  saveHtmlSlide,
  searchHtmlSlides,
  type HtmlSlide,
} from "@/lib/db-html-slides";
import { HtmlSlideStage, presentHtmlSlide, type HtmlSaveState } from "./html-slide-stage";

/* ===================== Trình chiếu slide ===================== */

/** Slide HTML đang chiếu: nội dung đã tải về + trạng thái lưu kho. */
interface OpenHtml {
  name: string;
  html: string;
  save: HtmlSaveState;
  id: string | null;
}

/**
 * Trình chiếu bằng slide HTML một file. Giáo viên chọn file .html trên máy →
 * chiếu ngay, đồng thời file tự lưu vào kho chung (gắn với bài của buổi) để
 * giáo viên khác mở lại mà không phải tải lên nữa.
 *
 * Slide là nhân vật chính: khung chiếu chiếm trọn vùng nội dung, còn nút chọn
 * slide được bắn lên topbar qua `controlsHost`. Ở chế độ trình chiếu, cha
 * truyền `controlsHost` null → không có nút nào được dựng, màn hình sạch.
 */
export function SlideStage({
  sessionSlideId,
  lessons,
  onOpen,
  controlsHost,
}: {
  /** Slide chọn sẵn ở trang Chuẩn bị buổi — mở trước slide của bài. */
  sessionSlideId?: string | null;
  lessons: LessonDetail[];
  /** Ghi nhật ký buổi khi mở một slide. */
  onOpen: (title: string, lessonId: string | null) => void;
  /** Ô trên topbar để cắm thanh điều khiển vào; null = ẩn (chế độ trình chiếu). */
  controlsHost?: HTMLElement | null;
}) {
  const { user, can } = useAuth();
  const [open, setOpen] = useState<OpenHtml | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  /** Slide gắn với các bài của buổi — hiện lên đầu. */
  const [mine, setMine] = useState<HtmlSlide[]>([]);
  /** Kết quả tìm trong kho chung. */
  const [store, setStore] = useState<HtmlSlide[]>([]);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lessonKey = lessons.map((l) => l.id).join(",");

  // Slide của buổi + của các bài đã gán; chưa chiếu gì thì mở luôn: slide
  // chọn sẵn cho buổi trước, không có thì slide đầu tiên của bài
  useEffect(() => {
    const ids = lessons.map((l) => l.id);
    if (!ids.length && !sessionSlideId) return;
    let dead = false;
    Promise.all([
      fetchLessonHtmlSlides(ids),
      sessionSlideId ? fetchHtmlSlide(sessionSlideId).catch(() => null) : Promise.resolve(null),
    ])
      .then(([rows, picked]) => {
        if (dead) return;
        const list = picked && !rows.some((r) => r.id === picked.id) ? [picked, ...rows] : rows;
        setMine(list);
        const first = (picked && list.find((r) => r.id === picked.id)) ?? list[0];
        if (first && !openRef.current) openStored(first);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonKey, sessionSlideId]);

  // Tìm trong kho khi menu đang mở (chờ gõ xong mới hỏi)
  useEffect(() => {
    if (!menu) return;
    let dead = false;
    const t = window.setTimeout(() => {
      searchHtmlSlides(query)
        .then((rows) => !dead && setStore(rows))
        .catch(() => {});
    }, 250);
    return () => {
      dead = true;
      window.clearTimeout(t);
    };
  }, [menu, query]);

  async function openFile(files: FileList | null) {
    const file = files ? Array.from(files).find(isHtmlFile) : undefined;
    if (!file) {
      if (files?.length) setError("Chỉ nhận file slide .html");
      return;
    }
    setError(null);
    setMenu(false);
    const html = await file.text();
    setOpen({ name: file.name.replace(/\.html?$/i, ""), html, save: "saving", id: null });
    const lessonId = lessons[0]?.id ?? null;
    onOpen(file.name, lessonId);
    try {
      const { slide, existed } = await saveHtmlSlide({ file, html, lessonId });
      setOpen((cur) => (cur?.html === html ? { ...cur, id: slide.id, save: existed ? "reused" : "saved" } : cur));
      if (!existed && slide.lesson_id) setMine((rows) => [...rows, slide]);
    } catch {
      setOpen((cur) => (cur?.html === html ? { ...cur, save: "error" } : cur));
    }
  }

  async function openStored(s: HtmlSlide) {
    setMenu(false);
    setError(null);
    setBusy(true);
    try {
      const html = await downloadHtmlSlide(s);
      setOpen({ name: s.name, html, save: "stored", id: s.id });
      onOpen(s.name, s.lesson_id);
    } catch {
      setError("Không tải được slide từ kho. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: HtmlSlide) {
    if (!window.confirm(`Xoá slide “${s.name}” khỏi kho? Giáo viên khác cũng sẽ không thấy nữa.`)) return;
    try {
      await deleteHtmlSlide(s);
      setMine((rows) => rows.filter((r) => r.id !== s.id));
      setStore((rows) => rows.filter((r) => r.id !== s.id));
      setOpen((cur) => (cur?.id === s.id ? { ...cur, id: null, save: "error" } : cur));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xoá được slide");
    }
  }

  const canDelete = (s: HtmlSlide) => s.created_by === user?.id || can("library.manage");
  const lessonName = (id: string | null) => {
    const l = lessons.find((x) => x.id === id);
    return l ? `${l.unit ? `Bài ${l.unit}: ` : ""}${l.title}` : null;
  };

  const btn =
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-classroom-border bg-classroom-surface px-2.5 text-[13px] font-semibold text-classroom-secondary transition-colors hover:bg-classroom-muted";

  const controls = (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          onClick={() => setMenu((m) => !m)}
          className={cn(btn, "max-w-[18rem]", menu && "bg-classroom-muted")}
          title="Chọn slide HTML trong kho hoặc tải file mới lên"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-classroom-accent" />
          ) : (
            <Presentation className="h-4 w-4 shrink-0 text-classroom-accent" />
          )}
          <span className="truncate">{open?.name ?? "Chọn slide"}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </button>
        {menu && (
          <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-classroom-border bg-classroom-surface p-2 shadow-soft">
            <Button size="sm" className="w-full" onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4" /> Tải file slide
            </Button>
            <p className="px-1 pt-1.5 text-[11px] leading-snug text-classroom-muted-foreground">
              File tự lưu vào kho
              {lessons[0] ? ` (gắn với ${lessonName(lessons[0].id)})` : ""} — giáo viên khác chọn lại ở
              đây, không phải tải lên nữa.
            </p>

            {mine.length > 0 && (
              <>
                <div className="mt-3 px-1 text-[11px] font-bold uppercase tracking-wide text-classroom-muted-foreground">
                  Slide của buổi này
                </div>
                {mine.map((s) => (
                  <SlideItem
                    key={s.id}
                    label={s.name}
                    hint={s.id === sessionSlideId ? "Chọn sẵn cho buổi" : lessonName(s.lesson_id)}
                    active={open?.id === s.id}
                    onClick={() => openStored(s)}
                    onDelete={canDelete(s) ? () => remove(s) : undefined}
                  />
                ))}
              </>
            )}

            <div className="mt-3 px-1 text-[11px] font-bold uppercase tracking-wide text-classroom-muted-foreground">
              Kho slide HTML
            </div>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-classroom-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo tên slide…"
                className="h-8 w-full rounded-lg border border-classroom-border bg-classroom-background pl-8 pr-3 text-sm text-classroom-foreground placeholder:text-classroom-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </div>
            <div className="mt-1 max-h-64 overflow-y-auto">
              {store.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-classroom-muted-foreground">
                  {query.trim() ? "Không tìm thấy slide nào" : "Kho chưa có slide nào"}
                </p>
              ) : (
                store.map((s) => (
                  <SlideItem
                    key={s.id}
                    label={s.name}
                    hint={new Date(s.created_at).toLocaleDateString("vi-VN")}
                    active={open?.id === s.id}
                    onClick={() => openStored(s)}
                    onDelete={canDelete(s) ? () => remove(s) : undefined}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => open && presentHtmlSlide(open.name, open.html)}
        disabled={!open}
        className={cn(btn, "disabled:opacity-40")}
        title="Mở cửa sổ trình chiếu riêng để kéo sang màn hình máy chiếu"
      >
        <MonitorOff className="h-4 w-4" />
        <span className="hidden lg:inline">Chiếu ra màn hình</span>
      </button>
    </div>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-classroom-canvas">
      <input
        ref={fileInput}
        type="file"
        accept=".html,.htm,text/html"
        className="hidden"
        onChange={(e) => {
          openFile(e.target.files);
          e.target.value = "";
        }}
      />
      {controlsHost ? createPortal(controls, controlsHost) : null}

      {open ? (
        <HtmlSlideStage
          name={open.name}
          html={open.html}
          save={open.save}
          showChrome={Boolean(controlsHost)}
          onClose={() => setOpen(null)}
        />
      ) : (
        <div className="grid h-full place-items-center p-8 text-center text-classroom-muted-foreground">
          <div>
            <Presentation className="mx-auto mb-3 h-10 w-10 opacity-60" />
            <div className="font-semibold text-classroom-foreground">Chưa chọn slide</div>
            <p className="mx-auto mt-1 max-w-md text-sm">
              Tải file slide <b className="text-classroom-foreground">.html</b> lên để chiếu — file tự lưu
              vào kho, lần sau bạn hoặc giáo viên khác chỉ cần chọn lại trên thanh trên.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button onClick={() => fileInput.current?.click()}>
                <Upload className="h-4 w-4" /> Tải file slide
              </Button>
              <Button variant="secondary" onClick={() => setMenu(true)} disabled={!controlsHost}>
                <FolderOpen className="h-4 w-4" /> Chọn trong kho
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-gold-600/90 px-3 py-1.5 text-xs font-semibold text-white">
          {error}
          <button onClick={() => setError(null)} className="rounded p-0.5 hover:bg-white/20">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Một dòng trong menu chọn slide trên topbar. */
function SlideItem({
  label,
  hint,
  active,
  onClick,
  onDelete,
}: {
  label: string;
  hint?: string | null;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center rounded-lg",
        active ? "bg-brand-600 text-white" : "text-classroom-secondary hover:bg-classroom-muted",
      )}
    >
      <button onClick={onClick} className="min-w-0 flex-1 px-3 py-2 text-left">
        <div className="truncate text-sm font-semibold">{label}</div>
        {hint && <div className={cn("truncate text-[11px]", active ? "text-white/80" : "text-classroom-muted-foreground")}>{hint}</div>}
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md opacity-0 hover:bg-classroom-hover group-hover:opacity-100"
          title="Xoá khỏi kho"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ===================== Lưới từ vựng ===================== */

/**
 * Chiếu từ vựng của bài: ẩn/hiện nghĩa để kiểm tra miệng, ẩn/hiện pinyin để
 * học viên luyện nhận mặt chữ mà đọc; đang ẩn thì bấm thẻ để lật từng từ.
 * Bấm loa để đọc mẫu.
 * Có ô tra nhanh cả kho từ vựng cho lúc học viên hỏi một từ ngoài bài.
 */
export function VocabStage({ vocab }: { vocab: VocabRow[] }) {
  const [hidden, setHidden] = useState(false);
  const [hidePinyin, setHidePinyin] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<VocabRow[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Tra từ: gõ xong 400ms mới gọi server, xoá ô thì về lại từ của bài
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setFound(null);
      return;
    }
    setSearching(true);
    const id = window.setTimeout(() => {
      fetchVocabItems(q)
        .then((rows) => setFound(rows.slice(0, 60)))
        .catch(() => setFound([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => window.clearTimeout(id);
  }, [query]);

  const list = found ?? vocab;

  function toggle(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={hidePinyin ? "gold" : "secondary"}
          onClick={() => {
            setHidePinyin((h) => !h);
            setRevealed(new Set());
          }}
        >
          {hidePinyin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {hidePinyin ? "Đang ẩn pinyin" : "Ẩn pinyin (luyện đọc mặt chữ)"}
        </Button>
        <Button
          size="sm"
          variant={hidden ? "gold" : "secondary"}
          onClick={() => {
            setHidden((h) => !h);
            setRevealed(new Set());
          }}
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {hidden ? "Đang ẩn nghĩa" : "Ẩn nghĩa (kiểm tra miệng)"}
        </Button>
        {(hidden || hidePinyin) && (
          <>
            <span className="text-sm text-classroom-muted-foreground">Bấm thẻ để lật</span>
            {revealed.size > 0 && (
              <button
                onClick={() => setRevealed(new Set())}
                className="text-xs font-semibold text-classroom-muted-foreground hover:text-classroom-foreground"
              >
                Úp lại hết
              </button>
            )}
          </>
        )}
        <span className="text-sm text-classroom-muted-foreground">{list.length} từ</span>
        <div className="ml-auto flex items-center gap-2">
          <Search className="h-4 w-4 text-classroom-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tra nhanh cả kho từ (hán tự / pinyin / nghĩa)…"
            className="h-9 w-72 rounded-lg border border-classroom-border bg-classroom-surface px-3 text-sm text-classroom-foreground placeholder:text-classroom-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-xs font-semibold text-classroom-muted-foreground hover:text-classroom-foreground">
              Về từ của bài
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-classroom-border-muted bg-classroom-surface p-4">
        {list.length === 0 && (
          <div className="grid h-full place-items-center text-center text-sm text-classroom-muted-foreground">
            {searching
              ? "Đang tra…"
              : query
                ? "Không tìm thấy từ nào."
                : "Buổi chưa gán bài có từ vựng — dùng ô tra nhanh phía trên."}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.map((v) => {
            const flipped = revealed.has(v.id);
            const show = !hidden || flipped;
            const showPinyin = !hidePinyin || flipped;
            return (
              <button
                key={v.id}
                onClick={() => (hidden || hidePinyin) && toggle(v.id)}
                className="rounded-2xl border border-classroom-border bg-classroom-muted p-4 text-left transition-colors hover:border-brand-500"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="zh text-4xl font-bold leading-tight text-classroom-foreground">{v.hanzi}</div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      speakZh(v.hanzi);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && speakZh(v.hanzi)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-classroom-hover text-classroom-secondary hover:bg-brand-600 hover:text-white"
                  >
                    <Volume2 className="h-4 w-4" />
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-1 text-sm font-semibold",
                    showPinyin ? "text-classroom-accent" : "select-none text-classroom-faint blur-sm",
                  )}
                >
                  {showPinyin ? v.pinyin : "••••••"}
                </div>
                <div className={cn("mt-1 text-sm", show ? "text-classroom-secondary" : "select-none blur-sm")}>
                  {show ? v.meaning : "••••••"}
                </div>
                {show && v.example && (
                  <div className="zh mt-2 border-t border-classroom-border pt-2 text-xs text-classroom-muted-foreground">
                    {v.example.zh}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===================== Random gọi tên ===================== */

/**
 * Quay chọn học viên phát biểu. Chế độ "công bằng" loại dần những bạn đã
 * được gọi trong buổi, hết lượt thì tự làm mới — tránh gọi trùng một bạn.
 *
 * Quay xong thì báo ra ngoài qua `onPicked`: lớp phủ tự ẩn sau 3 giây để trả
 * màn hình về slide, việc cho điểm diễn ra ở thanh "đang trả lời".
 */
export function RandomStage({
  students,
  onPicked,
  managed = false,
  onRunningChange,
}: {
  students: ClassroomStudent[];
  onPicked: (student: ClassroomStudent) => void;
  managed?: boolean;
  onRunningChange?: (running: boolean) => void;
}) {
  const [fair, setFair] = useState(!managed);
  const [called, setCalled] = useState<string[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [display, setDisplay] = useState<ClassroomStudent | null>(null);
  const [winner, setWinner] = useState<ClassroomStudent | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const pool = useMemo(() => {
    if (!fair) return students;
    const rest = students.filter((s) => !called.includes(s.id));
    return rest.length ? rest : students;
  }, [students, called, fair]);

  function spin() {
    if (spinning || !students.length) return;
    setSpinning(true);
    onRunningChange?.(true);
    setWinner(null);
    const picked = pool[Math.floor(Math.random() * pool.length)];
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    // Giảm tốc dần: 18 bước, mỗi bước chậm hơn bước trước
    let delay = 60;
    let acc = 0;
    for (let i = 0; i < 18; i++) {
      const face = students[Math.floor(Math.random() * students.length)];
      acc += delay;
      delay = Math.round(delay * 1.16);
      timers.current.push(window.setTimeout(() => setDisplay(face), acc));
    }
    timers.current.push(
      window.setTimeout(() => {
        setDisplay(picked);
        setWinner(picked);
        setSpinning(false);
        onRunningChange?.(false);
        setCalled((prev) => (prev.includes(picked.id) ? prev : [...prev, picked.id]));
        onPicked(picked);
      }, acc + delay),
    );
  }

  const shown = display ?? null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 rounded-2xl border border-classroom-border-muted bg-classroom-surface p-8">
      {!managed && <div className="flex items-center gap-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-classroom-secondary">
          <input type="checkbox" checked={fair} onChange={(e) => setFair(e.target.checked)} className="h-4 w-4" />
          Gọi công bằng (chưa ai bị gọi hai lần)
        </label>
        <span className="text-classroom-muted-foreground">
          Đã gọi {called.length}/{students.length}
        </span>
        {called.length > 0 && (
          <button onClick={() => setCalled([])} className="inline-flex items-center gap-1 text-classroom-muted-foreground hover:text-classroom-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> làm mới
          </button>
        )}
      </div>}

      <div
        className={cn(
          "grid min-h-[220px] w-full max-w-2xl place-items-center rounded-3xl border-2 px-6 py-10 text-center transition-colors",
          winner ? "border-gold-500 bg-gold-600/10" : "border-classroom-border bg-classroom-background",
        )}
      >
        {shown ? (
          <div>
            <div
              className={cn(
                "text-6xl font-extrabold tracking-tight",
                winner ? "text-classroom-warning" : "text-classroom-foreground opacity-70",
              )}
            >
              {shown.name}
            </div>
            {winner && <div className="mt-2 text-lg text-classroom-secondary">mời em phát biểu 🎤</div>}
          </div>
        ) : (
          <div className="text-2xl font-semibold text-classroom-muted-foreground">Bấm quay để gọi tên</div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="lg" onClick={spin} disabled={spinning || !students.length}>
          <Dices className="h-5 w-5" /> {spinning ? "Đang quay…" : winner ? "Quay bạn khác" : "Quay chọn học viên"}
        </Button>
        {winner && (
          <span className="text-sm text-classroom-muted-foreground">Cho điểm ở thanh “đang trả lời” phía dưới màn hình →</span>
        )}
      </div>
    </div>
  );
}

/* ===================== Bấm giờ ===================== */

const PRESETS = [30, 60, 180, 300, 600];

/**
 * Đồng hồ đếm ngược cỡ lớn cho hoạt động nhóm; hết giờ có chuông báo.
 * `onTick` báo thời gian còn lại ra ngoài để header vẫn thấy đồng hồ khi giáo
 * viên chuyển sang chiếu slide giữa lúc học viên đang làm bài.
 */
export function TimerStage({
  onFinish,
  onTick,
}: {
  onFinish?: (seconds: number) => void;
  onTick?: (left: number, running: boolean) => void;
}) {
  const [total, setTotal] = useState(60);
  const [left, setLeft] = useState(60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          window.clearInterval(id);
          setRunning(false);
          beep();
          onFinish?.(total);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, total]);

  useEffect(() => {
    onTick?.(left, running);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running]);

  function pick(sec: number) {
    setTotal(sec);
    setLeft(sec);
    setRunning(false);
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const danger = left <= 10 && left > 0;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 rounded-2xl border border-classroom-border-muted bg-classroom-surface p-8">
      <div
        className={cn(
          "font-display text-[8rem] font-extrabold leading-none tabular-nums transition-colors sm:text-[12rem]",
          left === 0 ? "text-gold-500" : danger ? "animate-pulse text-classroom-warning" : "text-classroom-foreground",
        )}
      >
        {mm}:{ss}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => pick(p)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold",
              total === p ? "bg-brand-600 text-white" : "bg-classroom-muted text-classroom-secondary hover:bg-classroom-hover",
            )}
          >
            {p < 60 ? `${p}s` : `${p / 60}′`}
          </button>
        ))}
        <input
          type="number"
          min={1}
          placeholder="phút"
          onChange={(e) => {
            const m = Number(e.target.value);
            if (m > 0) pick(m * 60);
          }}
          className="h-10 w-24 rounded-lg border border-classroom-border bg-classroom-background px-3 text-sm text-classroom-foreground placeholder:text-classroom-muted-foreground"
        />
      </div>
      <div className="flex gap-2">
        <Button size="lg" onClick={() => setRunning((r) => !r)} disabled={left === 0}>
          {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {running ? "Tạm dừng" : "Bắt đầu"}
        </Button>
        <Button size="lg" variant="outline" onClick={() => pick(total)}>
          <RotateCcw className="h-5 w-5" /> Đặt lại
        </Button>
      </div>
    </div>
  );
}

/** Chuông báo hết giờ (WebAudio — không cần file âm thanh). */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    });
    window.setTimeout(() => ctx.close(), 1200);
  } catch {
    /* trình duyệt chặn audio — bỏ qua, đồng hồ vẫn đổi màu */
  }
}
