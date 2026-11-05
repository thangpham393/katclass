"use client";

import { useEffect, useRef, useState } from "react";
import {
  Eye,
  FileCode,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Inbox,
  Layers,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select, Field } from "@/components/ui/select";
import { Empty } from "@/components/ui/empty";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { useAuth } from "@/components/auth/auth-provider";
import { presentHtmlSlide } from "@/components/classroom/html-slide-stage";
import { useLoad } from "@/lib/use-load";
import { dbErrorMessage } from "@/lib/db";
import { fetchTextbookLessons, fetchTextbooks, type TextbookLessonRow } from "@/lib/db-library";
import {
  deleteHtmlSlide,
  deleteSlideFolder,
  downloadHtmlSlide,
  fetchFolderSlides,
  fetchSlideFolders,
  isHtmlFile,
  saveHtmlSlide,
  saveSlideFolder,
  updateHtmlSlide,
  type LibrarySlide,
  type SlideFolder,
} from "@/lib/db-html-slides";
import { cn } from "@/lib/utils";

/** "all" = tất cả, "none" = chưa xếp thư mục, còn lại là id thư mục. */
type FolderKey = "all" | "none" | string;

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function lessonLabel(l: { unit: number | null; title: string }) {
  return `${l.unit != null ? `Bài ${l.unit}: ` : ""}${l.title}`;
}

/**
 * KHO PPT BÀI GIẢNG — nơi xếp gọn slide HTML theo thư mục (thường mỗi giáo
 * trình một thư mục). Slide giáo viên tải lên trong lớp / trang chuẩn bị cũng
 * nằm ở đây: có bài thuộc giáo trình đã có thư mục thì tự vào đúng thư mục,
 * không thì nằm ở "Chưa xếp thư mục" chờ sắp xếp.
 */
export default function SlideLibraryPage() {
  const { user, can } = useAuth();
  const canManage = can("library.manage");
  const folders = useLoad(fetchSlideFolders, []);
  const textbooks = useLoad(fetchTextbooks, []);
  const [current, setCurrent] = useState<FolderKey>("all");
  const [query, setQuery] = useState("");
  const [slides, setSlides] = useState<LibrarySlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<SlideFolder | "new" | null>(null);
  const [editingSlide, setEditingSlide] = useState<LibrarySlide | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const folderList = folders.data ?? [];
  const folder = folderList.find((f) => f.id === current) ?? null;

  const reload = () => {
    setLoading(true);
    fetchFolderSlides(current === "all" ? null : current, query)
      .then(setSlides)
      .catch((e) => setError(dbErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = window.setTimeout(reload, query ? 250 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, query]);

  // Thư mục vừa bị xoá → quay về "Tất cả"
  useEffect(() => {
    if (current !== "all" && current !== "none" && folders.data && !folder) setCurrent("all");
  }, [current, folders.data, folder]);

  async function upload(files: FileList | null) {
    const list = Array.from(files ?? []).filter(isHtmlFile);
    if (!list.length) {
      if (files?.length) setError("Chỉ nhận file slide .html");
      return;
    }
    setError(null);
    const skipped: string[] = [];
    try {
      for (const [i, file] of list.entries()) {
        setStep(`Đang tải lên ${file.name} (${i + 1}/${list.length})…`);
        const { slide, existed } = await saveHtmlSlide({
          file,
          html: await file.text(),
          lessonId: null,
          folderId: folder?.id ?? null,
        });
        if (existed) {
          // Bản cùng nội dung chưa xếp thư mục → kéo vào thư mục đang mở
          if (folder && !slide.folder_id) await updateHtmlSlide(slide.id, { folder_id: folder.id });
          else skipped.push(`${file.name} (đã có trong kho: “${slide.name}”)`);
        }
      }
      if (skipped.length) setError(`Bỏ qua file trùng nội dung: ${skipped.join(", ")}`);
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setStep(null);
      reload();
      folders.reload();
    }
  }

  async function preview(s: LibrarySlide) {
    try {
      presentHtmlSlide(s.name, await downloadHtmlSlide(s));
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  async function removeSlide(s: LibrarySlide) {
    if (!window.confirm(`Xoá slide “${s.name}” khỏi kho? Giáo viên khác cũng sẽ không dùng được nữa.`)) return;
    try {
      await deleteHtmlSlide(s);
      reload();
      folders.reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  async function removeFolder(f: SlideFolder) {
    if (!window.confirm(`Xoá thư mục “${f.name}”? Slide bên trong KHÔNG bị xoá, chỉ chuyển về “Chưa xếp thư mục”.`)) return;
    try {
      await deleteSlideFolder(f.id);
      folders.reload();
      reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    }
  }

  const canEditSlide = (s: LibrarySlide) => canManage || s.created_by === user?.id;
  const busy = Boolean(step);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Kho PPT bài giảng</h1>
          <p className="mt-1 text-muted-foreground">
            Slide bài giảng dạng file .html, xếp theo thư mục giáo trình. Gắn slide vào bài học là vào lớp
            dạy bài đó slide tự mở.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button variant="outline" onClick={() => setEditingFolder("new")}>
              <FolderPlus className="h-4 w-4" /> Thư mục mới
            </Button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".html,.htm,text/html"
            multiple
            className="hidden"
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Tải file slide{folder ? ` vào “${folder.name}”` : ""}
          </Button>
        </div>
      </div>

      {error && <ErrorNote message={error} />}
      {folders.error && <ErrorNote message={folders.error} />}
      {step && (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {step}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        {/* Cột thư mục */}
        <Card className="h-fit">
          <CardContent className="space-y-1 p-2">
            <FolderRow icon={Layers} label="Tất cả slide" active={current === "all"} onClick={() => setCurrent("all")} />
            <FolderRow icon={Inbox} label="Chưa xếp thư mục" active={current === "none"} onClick={() => setCurrent("none")} />
            <div className="my-1 border-t" />
            {folders.loading ? (
              <LoadingRows rows={3} className="p-0" />
            ) : folderList.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Chưa có thư mục. {canManage ? "Bấm “Thư mục mới” và chọn giáo trình." : ""}
              </p>
            ) : (
              folderList.map((f) => (
                <FolderRow
                  key={f.id}
                  icon={current === f.id ? FolderOpen : Folder}
                  label={f.name}
                  count={f.html_slides[0]?.count ?? 0}
                  active={current === f.id}
                  onClick={() => setCurrent(f.id)}
                  onEdit={canManage ? () => setEditingFolder(f) : undefined}
                  onDelete={canManage ? () => removeFolder(f) : undefined}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Danh sách slide */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Tìm slide${folder ? ` trong “${folder.name}”` : ""}…`}
              className="pl-9"
            />
          </div>

          {folder?.textbook && (
            <p className="text-xs text-muted-foreground">
              Thư mục của giáo trình <Badge variant="gold">{folder.textbook.name}</Badge> — slide tải lên trong lớp
              cho bài thuộc giáo trình này tự vào đây.
            </p>
          )}

          {loading ? (
            <Card><LoadingRows rows={4} /></Card>
          ) : slides.length === 0 ? (
            <Empty
              icon={FileCode}
              title={query ? "Không tìm thấy slide nào" : "Chưa có slide nào ở đây"}
              description="Bấm “Tải file slide” để tải lên file .html — chọn được nhiều file một lúc."
            />
          ) : (
            <Card>
              <CardContent className="divide-y p-0">
                {slides.map((s) => {
                  const inFolder = folderList.find((f) => f.id === s.folder_id);
                  return (
                    <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <FileCode className="h-5 w-5 shrink-0 text-brand-600" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{s.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          {s.lesson ? (
                            <Badge variant="outline">{lessonLabel(s.lesson)}</Badge>
                          ) : (
                            <span>Chưa gắn bài</span>
                          )}
                          {current === "all" && <span>· {inFolder ? inFolder.name : "Chưa xếp thư mục"}</span>}
                          <span>· {sizeLabel(s.size_bytes)}</span>
                          <span>
                            · {s.creator?.name ?? "—"}, {new Date(s.created_at).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" title="Xem thử" onClick={() => preview(s)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {canEditSlide(s) && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              title="Đổi tên, chuyển thư mục, gắn bài học"
                              onClick={() => setEditingSlide(s)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-rose-600 hover:bg-rose-50"
                              title="Xoá khỏi kho"
                              onClick={() => removeSlide(s)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {editingFolder && (
        <FolderModal
          folder={editingFolder === "new" ? null : editingFolder}
          textbooks={textbooks.data ?? []}
          onClose={() => setEditingFolder(null)}
          onSaved={() => {
            setEditingFolder(null);
            folders.reload();
            reload();
          }}
        />
      )}

      {editingSlide && (
        <SlideModal
          slide={editingSlide}
          folders={folderList}
          textbooks={textbooks.data ?? []}
          onClose={() => setEditingSlide(null)}
          onSaved={() => {
            setEditingSlide(null);
            folders.reload();
            reload();
          }}
        />
      )}
    </div>
  );
}

function FolderRow({
  icon: Icon,
  label,
  count,
  active,
  onClick,
  onEdit,
  onDelete,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center rounded-lg",
        active ? "bg-brand-50 text-brand-700" : "hover:bg-muted",
      )}
    >
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm font-medium">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
        {count != null && <span className="ml-auto text-xs text-muted-foreground">{count}</span>}
      </button>
      {onEdit && (
        <button
          onClick={onEdit}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md opacity-0 hover:bg-background group-hover:opacity-100"
          title="Sửa thư mục"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-rose-600 opacity-0 hover:bg-background group-hover:opacity-100"
          title="Xoá thư mục"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Tạo / sửa thư mục: chọn giáo trình là tên tự điền theo giáo trình. */
function FolderModal({
  folder,
  textbooks,
  onClose,
  onSaved,
}: {
  folder: SlideFolder | null;
  textbooks: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [textbookId, setTextbookId] = useState(folder?.textbook_id ?? "");
  const [name, setName] = useState(folder?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveSlideFolder({ name, textbook_id: textbookId || null }, folder?.id);
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={folder ? "Sửa thư mục" : "Thư mục mới"}>
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        <Field label="Giáo trình" hint="Slide tải lên trong lớp cho bài thuộc giáo trình này tự vào thư mục.">
          <Select
            value={textbookId}
            onChange={(e) => {
              const id = e.target.value;
              const prev = textbooks.find((t) => t.id === textbookId)?.name ?? "";
              // Tên đang trống hoặc vẫn là tên giáo trình cũ → đổi theo giáo trình mới
              if (!name.trim() || name === prev) setName(textbooks.find((t) => t.id === id)?.name ?? "");
              setTextbookId(id);
            }}
          >
            <option value="">— Không theo giáo trình —</option>
            {textbooks.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tên thư mục">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="HSK 1 — Chuẩn" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Đang lưu…" : folder ? "Lưu" : "Tạo thư mục"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Đổi tên, chuyển thư mục, gắn bài học cho một slide. */
function SlideModal({
  slide,
  folders,
  textbooks,
  onClose,
  onSaved,
}: {
  slide: LibrarySlide;
  folders: SlideFolder[];
  textbooks: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(slide.name);
  const [folderId, setFolderId] = useState(slide.folder_id ?? "");
  const [textbookId, setTextbookId] = useState(
    folders.find((f) => f.id === slide.folder_id)?.textbook_id ?? "",
  );
  const [lessonId, setLessonId] = useState(slide.lesson_id ?? "");
  const [lessons, setLessons] = useState<TextbookLessonRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!textbookId) return setLessons([]);
    let dead = false;
    fetchTextbookLessons(textbookId)
      .then((rows) => !dead && setLessons(rows))
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [textbookId]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateHtmlSlide(slide.id, {
        name: name.trim(),
        folder_id: folderId || null,
        lesson_id: lessonId || null,
      });
      onSaved();
    } catch (e) {
      setError(dbErrorMessage(e));
      setSaving(false);
    }
  }

  // Bài đang gắn không thuộc giáo trình đang chọn → vẫn giữ một dòng cho nó
  const keepCurrent = slide.lesson && lessonId === slide.lesson.id && !lessons.some((l) => l.id === lessonId);

  return (
    <Modal open onClose={onClose} title="Sửa slide">
      <div className="space-y-4">
        {error && <ErrorNote message={error} />}
        <Field label="Tên slide">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Thư mục">
          <Select
            value={folderId}
            onChange={(e) => {
              setFolderId(e.target.value);
              const tb = folders.find((f) => f.id === e.target.value)?.textbook_id;
              if (tb) setTextbookId(tb);
            }}
          >
            <option value="">— Chưa xếp thư mục —</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Giáo trình">
            <Select value={textbookId} onChange={(e) => setTextbookId(e.target.value)}>
              <option value="">— Chọn giáo trình —</option>
              {textbooks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Gắn vào bài" hint="Vào lớp dạy bài này là slide tự mở.">
            <Select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              <option value="">— Không gắn bài —</option>
              {keepCurrent && slide.lesson && <option value={slide.lesson.id}>{lessonLabel(slide.lesson)}</option>}
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>{lessonLabel(l)}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            <FolderInput className="h-4 w-4" /> {saving ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
