"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  MonitorUp,
  Pause,
  Play,
  Presentation,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EMBED_MODE_LABELS,
  embedBlockReason,
  presentUrl,
  speakZh,
  toEmbedUrl,
  type ClassroomStudent,
  type EmbedMode,
} from "@/lib/db-classroom";
import type { LessonDetail, VocabRow } from "@/lib/db-content";

/* ===================== Trình chiếu slide ===================== */

/** File đang chiếu lấy thẳng từ máy giáo viên (không tải lên đâu cả). */
interface LocalDeck {
  name: string;
  kind: "pdf" | "images";
  urls: string[];
}

/**
 * Chiếu slide của bài học đã gán cho buổi (Canva/Google Slides nhúng iframe),
 * link dán tạm, HOẶC file PDF/ảnh mở thẳng từ máy giáo viên — đường lui khi
 * slide quá nặng, Google từ chối xem trước hoặc phòng học mất mạng.
 */
export function SlideStage({
  lessons,
  onOpen,
}: {
  lessons: LessonDetail[];
  onOpen: (lesson: LessonDetail) => void;
}) {
  const withSlide = lessons.filter((l) => l.slide_embed_url);
  const [current, setCurrent] = useState<string>(withSlide[0]?.id ?? "");
  const [adhoc, setAdhoc] = useState("");
  const [adhocUrl, setAdhocUrl] = useState("");
  const [mode, setMode] = useState<EmbedMode>("auto");
  const [reloadKey, setReloadKey] = useState(0);
  const [local, setLocal] = useState<LocalDeck | null>(null);
  const [page, setPage] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Thu hồi blob URL khi đổi/đóng file để không rò bộ nhớ trong buổi dài
  useEffect(() => {
    return () => {
      local?.urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [local]);

  // Ảnh: lật trang bằng phím mũi tên / Space
  useEffect(() => {
    if (local?.kind !== "images") return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (["ArrowRight", "ArrowDown", " "].includes(e.key)) {
        e.preventDefault();
        setPage((p) => Math.min(p + 1, (local?.urls.length ?? 1) - 1));
      } else if (["ArrowLeft", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setPage((p) => Math.max(p - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [local]);

  function openLocal(files: FileList | null) {
    if (!files?.length) return;
    local?.urls.forEach((u) => URL.revokeObjectURL(u));
    const list = Array.from(files);
    const pdf = list.find((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (pdf) {
      setLocal({ name: pdf.name, kind: "pdf", urls: [URL.createObjectURL(pdf)] });
    } else {
      const imgs = list
        .filter((f) => f.type.startsWith("image/"))
        .sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true }));
      if (!imgs.length) return;
      setLocal({
        name: imgs.length > 1 ? `${imgs.length} ảnh slide` : imgs[0].name,
        kind: "images",
        urls: imgs.map((f) => URL.createObjectURL(f)),
      });
    }
    setPage(0);
  }

  /**
   * Nhận hình từ chính máy giáo viên: PowerPoint chạy thật (đủ hiệu ứng, hoạt
   * ảnh), màn hình lớp học chỉ soi lại cửa sổ đó rồi phủ công cụ lên trên.
   * Nên chọn tab "Cửa sổ" → PowerPoint, tránh chọn "Toàn màn hình" vì sẽ soi
   * gương chính cửa sổ này.
   */
  async function startShare() {
    setShareError(null);
    try {
      const media = navigator.mediaDevices as MediaDevices & {
        getDisplayMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
      };
      if (!media?.getDisplayMedia) {
        setShareError("Trình duyệt này không hỗ trợ nhận chia sẻ màn hình. Dùng Chrome/Edge/Cốc Cốc bản mới.");
        return;
      }
      const stream = await media.getDisplayMedia({
        video: { frameRate: { ideal: 30 } } as MediaTrackConstraints,
        audio: false,
      });
      streamRef.current = stream;
      setSharing(true);
      closeLocal();
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        streamRef.current = null;
        setSharing(false);
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      // Người dùng bấm Huỷ trong hộp chọn màn hình → không coi là lỗi
      if ((e as DOMException)?.name !== "NotAllowedError") {
        setShareError("Không nhận được màn hình. Thử lại và chọn cửa sổ PowerPoint.");
      }
    }
  }

  function stopShare() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setSharing(false);
  }

  // Gắn lại luồng khi <video> vừa được render (lúc bật chia sẻ)
  useEffect(() => {
    if (sharing && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [sharing]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  function closeLocal() {
    local?.urls.forEach((u) => URL.revokeObjectURL(u));
    setLocal(null);
  }

  useEffect(() => {
    if (!current && withSlide[0]) {
      setCurrent(withSlide[0].id);
      onOpen(withSlide[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withSlide.length]);

  const lesson = withSlide.find((l) => l.id === current);
  const url = adhocUrl || lesson?.slide_embed_url || "";
  // Link chia sẻ thông thường (…/edit?slide=…) tự đổi sang dạng nhúng iframe
  const embed = toEmbedUrl(url, mode);
  const isGoogle = /docs\.google\.com|drive\.google\.com/.test(embed);
  // Nguồn biết chắc bị chặn nhúng (OneDrive/SharePoint) → chỉ dẫn thay vì iframe lỗi
  const blocked = embedBlockReason(url);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {withSlide.map((l) => (
          <button
            key={l.id}
            onClick={() => {
              setCurrent(l.id);
              setAdhocUrl("");
              onOpen(l);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold",
              l.id === current && !adhocUrl
                ? "bg-brand-600 text-white"
                : "bg-ink-800 text-ink-100 hover:bg-ink-700",
            )}
          >
            {l.unit ? `Bài ${l.unit}` : ""} {l.title}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input
            value={adhoc}
            onChange={(e) => setAdhoc(e.target.value)}
            placeholder="Dán link Google Slides / Drive / Canva / YouTube…"
            className="h-9 w-56 rounded-lg border border-ink-700 bg-ink-900 px-3 text-sm text-white placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          <Button size="sm" variant="secondary" onClick={() => setAdhocUrl(adhoc.trim())} disabled={!adhoc.trim()}>
            Chiếu
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              openLocal(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={sharing ? stopShare : startShare}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold",
              sharing ? "bg-gold-600 text-white hover:bg-gold-700" : "bg-ink-800 text-ink-100 hover:bg-ink-700",
            )}
            title="Chiếu bằng PowerPoint trên máy rồi soi cửa sổ đó vào đây — giữ nguyên hiệu ứng, công cụ lớp vẫn phủ lên trên"
          >
            <MonitorUp className="h-4 w-4" /> {sharing ? "Dừng nhận màn hình" : "Nhận màn hình"}
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink-800 px-3 text-sm font-semibold text-ink-100 hover:bg-ink-700"
            title="Chiếu file PDF hoặc ảnh slide ngay từ máy — không cần mạng, không giới hạn dung lượng"
          >
            <FolderOpen className="h-4 w-4" /> File từ máy
          </button>
          {url && (
            <button
              onClick={() =>
                window.open(
                  presentUrl(url),
                  "kat-present",
                  "noopener,noreferrer,width=1280,height=760",
                )
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink-800 px-3 text-sm font-semibold text-ink-100 hover:bg-ink-700"
              title="Mở cửa sổ trình chiếu riêng (kéo sang màn hình máy chiếu) — dùng khi slide không nhúng được"
            >
              <ExternalLink className="h-4 w-4" /> Cửa sổ trình chiếu
            </button>
          )}
        </div>
      </div>

      {shareError && <div className="-mb-1 text-[11px] font-semibold text-gold-300">{shareError}</div>}

      {isGoogle && !local && !sharing && (
        <div className="-mb-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
          <span className="font-semibold text-ink-300">Không hiện được slide?</span>
          {(["auto", "slides", "drive", "office"] as EmbedMode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setReloadKey((k) => k + 1);
              }}
              className={cn(
                "rounded-md px-2 py-1 font-semibold",
                mode === m ? "bg-brand-600 text-white" : "bg-ink-800 text-ink-200 hover:bg-ink-700",
              )}
              title={
                m === "drive"
                  ? "Dùng cho file PowerPoint gốc hoặc slide nặng mà Google Slides báo không xem trước được"
                  : m === "slides"
                    ? "Trình xem Google Slides"
                    : m === "office"
                      ? "Trình xem Office Online đọc thẳng file .pptx trên Drive — thử khi Google báo tệp quá lớn"
                      : "Tự chọn theo loại file"
              }
            >
              {EMBED_MODE_LABELS[m]}
            </button>
          ))}
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1 rounded-md bg-ink-800 px-2 py-1 font-semibold text-ink-200 hover:bg-ink-700"
          >
            <RotateCcw className="h-3 w-3" /> Tải lại
          </button>
          <span>
            · Slide phải chia sẻ “Bất kỳ ai có đường liên kết”. Google báo “tệp quá lớn không
            xem trước được” thì thử kiểu “Office (.pptx)”, hoặc chiếu thẳng bằng nút “File từ
            máy” (PDF/ảnh — không giới hạn dung lượng, không cần mạng).
          </span>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-ink-800 bg-black">
        {sharing ? (
          <>
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-ink-950/80 px-3 py-2 text-xs text-ink-200 backdrop-blur">
              <span className="font-semibold text-gold-300">● Đang soi màn hình máy tính</span>
              <span className="text-ink-400">
                Bấm chuyển slide ngay trên PowerPoint (hoặc bút trình chiếu) — hình ở đây tự cập nhật.
              </span>
              <button
                onClick={stopShare}
                className="ml-auto inline-flex items-center gap-1 rounded-md bg-ink-800 px-2 py-1 font-semibold hover:bg-ink-700"
              >
                <X className="h-3.5 w-3.5" /> Dừng
              </button>
            </div>
          </>
        ) : local ? (
          <>
            {local.kind === "pdf" ? (
              <iframe src={`${local.urls[0]}#toolbar=1&view=FitH`} className="h-full w-full" title={local.name} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={local.urls[page]} alt={`Slide ${page + 1}`} className="h-full w-full object-contain" />
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-ink-950/80 px-3 py-2 text-xs text-ink-200 backdrop-blur">
              <span className="truncate font-semibold text-white">{local.name}</span>
              {local.kind === "images" && (
                <span className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="grid h-7 w-7 place-items-center rounded-md bg-ink-800 hover:bg-ink-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="tabular-nums">
                    {page + 1}/{local.urls.length}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(local.urls.length - 1, p + 1))}
                    disabled={page >= local.urls.length - 1}
                    className="grid h-7 w-7 place-items-center rounded-md bg-ink-800 hover:bg-ink-700 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <span className="text-ink-400">· phím ← →</span>
                </span>
              )}
              <button
                onClick={closeLocal}
                className="ml-auto inline-flex items-center gap-1 rounded-md bg-ink-800 px-2 py-1 font-semibold hover:bg-ink-700"
              >
                <X className="h-3.5 w-3.5" /> Đóng file
              </button>
            </div>
          </>
        ) : url && blocked ? (
          <div className="grid h-full place-items-center p-8 text-center text-ink-300">
            <div className="max-w-lg">
              <div className="mb-2 text-lg font-bold text-white">Nguồn này chặn nhúng</div>
              <p className="text-sm leading-relaxed">{blocked}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button
                  onClick={() =>
                    window.open(url, "kat-present", "noopener,noreferrer,width=1280,height=760")
                  }
                >
                  <ExternalLink className="h-4 w-4" /> Mở cửa sổ trình chiếu
                </Button>
                <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                  <FolderOpen className="h-4 w-4" /> Chiếu file từ máy
                </Button>
              </div>
            </div>
          </div>
        ) : url ? (
          <iframe
            key={`${embed}-${reloadKey}`}
            src={embed}
            className="h-full w-full"
            allow="fullscreen; autoplay"
            allowFullScreen
            title="Slide bài học"
          />
        ) : (
          <div className="grid h-full place-items-center p-8 text-center text-ink-300">
            <div>
              <Presentation className="mx-auto mb-3 h-10 w-10 opacity-60" />
              <div className="font-semibold text-white">Buổi này chưa có slide</div>
              <p className="mx-auto mt-1 max-w-md text-sm">
                Gán bài học có link slide cho buổi ở trang chi tiết buổi, dán tạm link Google
                Slides / Drive / Canva / YouTube vào ô trên (hệ thống tự đổi sang dạng nhúng),
                bấm <b className="text-white">Nhận màn hình</b> để soi cửa sổ PowerPoint đang
                chạy trên máy (giữ nguyên hiệu ứng, công cụ lớp vẫn phủ lên trên), hoặc{" "}
                <b className="text-white">File từ máy</b> để chiếu thẳng PDF / ảnh slide.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== Lưới từ vựng ===================== */

/** Chiếu từ vựng của bài: ẩn/hiện nghĩa để kiểm tra miệng, bấm loa để đọc mẫu. */
export function VocabStage({ vocab }: { vocab: VocabRow[] }) {
  const [hidden, setHidden] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!vocab.length) {
    return (
      <div className="grid h-full place-items-center rounded-2xl border border-ink-800 bg-ink-900 text-center text-ink-300">
        <div className="max-w-md p-8">
          <div className="font-semibold text-white">Bài học chưa gắn từ vựng</div>
          <p className="mt-1 text-sm">Gán bài học (có từ vựng) cho buổi để chiếu bảng từ tại đây.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={hidden ? "gold" : "secondary"}
          onClick={() => {
            setHidden((h) => !h);
            setRevealed(new Set());
          }}
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {hidden ? "Đang ẩn nghĩa — bấm thẻ để lật" : "Ẩn nghĩa (kiểm tra miệng)"}
        </Button>
        <span className="text-sm text-ink-300">{vocab.length} từ</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-ink-800 bg-ink-900 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {vocab.map((v) => {
            const show = !hidden || revealed.has(v.id);
            return (
              <button
                key={v.id}
                onClick={() => hidden && toggle(v.id)}
                className="rounded-2xl border border-ink-700 bg-ink-800 p-4 text-left transition-colors hover:border-brand-500"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="zh text-4xl font-bold leading-tight text-white">{v.hanzi}</div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      speakZh(v.hanzi);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && speakZh(v.hanzi)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-700 text-ink-100 hover:bg-brand-600"
                  >
                    <Volume2 className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-brand-300">{v.pinyin}</div>
                <div className={cn("mt-1 text-sm", show ? "text-ink-100" : "select-none blur-sm")}>
                  {show ? v.meaning : "••••••"}
                </div>
                {show && v.example && (
                  <div className="zh mt-2 border-t border-ink-700 pt-2 text-xs text-ink-300">
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
}: {
  students: ClassroomStudent[];
  onPicked: (student: ClassroomStudent) => void;
}) {
  const [fair, setFair] = useState(true);
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
        setCalled((prev) => (prev.includes(picked.id) ? prev : [...prev, picked.id]));
        onPicked(picked);
      }, acc + delay),
    );
  }

  const shown = display ?? null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 rounded-2xl border border-ink-800 bg-ink-900 p-8">
      <div className="flex items-center gap-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-ink-200">
          <input type="checkbox" checked={fair} onChange={(e) => setFair(e.target.checked)} className="h-4 w-4" />
          Gọi công bằng (chưa ai bị gọi hai lần)
        </label>
        <span className="text-ink-400">
          Đã gọi {called.length}/{students.length}
        </span>
        {called.length > 0 && (
          <button onClick={() => setCalled([])} className="inline-flex items-center gap-1 text-ink-300 hover:text-white">
            <RotateCcw className="h-3.5 w-3.5" /> làm mới
          </button>
        )}
      </div>

      <div
        className={cn(
          "grid min-h-[220px] w-full max-w-2xl place-items-center rounded-3xl border-2 px-6 py-10 text-center transition-colors",
          winner ? "border-gold-500 bg-gold-600/10" : "border-ink-700 bg-ink-950",
        )}
      >
        {shown ? (
          <div>
            <div
              className={cn(
                "text-6xl font-extrabold tracking-tight",
                winner ? "text-gold-300" : "text-white opacity-70",
              )}
            >
              {shown.name}
            </div>
            {winner && <div className="mt-2 text-lg text-ink-200">mời em phát biểu 🎤</div>}
          </div>
        ) : (
          <div className="text-2xl font-semibold text-ink-400">Bấm quay để gọi tên</div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="lg" onClick={spin} disabled={spinning || !students.length}>
          <Dices className="h-5 w-5" /> {spinning ? "Đang quay…" : winner ? "Quay bạn khác" : "Quay chọn học viên"}
        </Button>
        {winner && (
          <span className="text-sm text-ink-300">Cho điểm ở thanh “đang trả lời” phía dưới màn hình →</span>
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
    <div className="flex h-full flex-col items-center justify-center gap-8 rounded-2xl border border-ink-800 bg-ink-900 p-8">
      <div
        className={cn(
          "font-display text-[8rem] font-extrabold leading-none tabular-nums transition-colors sm:text-[12rem]",
          left === 0 ? "text-gold-500" : danger ? "animate-pulse text-gold-400" : "text-white",
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
              total === p ? "bg-brand-600 text-white" : "bg-ink-800 text-ink-100 hover:bg-ink-700",
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
          className="h-10 w-24 rounded-lg border border-ink-700 bg-ink-950 px-3 text-sm text-white placeholder:text-ink-400"
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
