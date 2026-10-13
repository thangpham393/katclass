"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Crop, ImagePlus, Loader2, Maximize2, RotateCcw, Save, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { dbErrorMessage, type ClassStudentRow } from "@/lib/db";
import { fetchClassPhotos, saveClassPhotos, type ClassPhoto } from "@/lib/db-class-photos";
import { cropRegion } from "@/lib/classroom-picker";
import { useLoad } from "@/lib/use-load";
import "./class-photo-manager.css";

type Source = { image: HTMLImageElement; url: string };
type Draft = { blob: Blob; url: string } | null;
const ACCEPT = "image/jpeg,image/png,image/webp";

async function openImage(file: File): Promise<Source> {
  if (!ACCEPT.split(",").includes(file.type)) throw new Error("Chọn ảnh JPG, PNG hoặc WebP.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Ảnh tối đa 15 MB. Hãy chọn ảnh có dung lượng nhỏ hơn.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try { await image.decode(); } catch { URL.revokeObjectURL(url); throw new Error("Không đọc được ảnh này."); }
  return { image, url };
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Không cắt được ảnh.")), "image/jpeg", .92));
}

export function ClassPhotoManager({ classId, students }: { classId: string; students: ClassStudentRow[] }) {
  const photos = useLoad(() => fetchClassPhotos(classId), [classId]);
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const count = (photos.data ?? []).filter(p => p.key !== "group" && students.some(s => s.student_id === p.key)).length;
  return <section className="rounded-2xl border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><Camera className="h-5 w-5" /></div>
        <div><h2 className="font-bold">Ảnh lớp & học viên</h2><p className="mt-0.5 text-sm text-muted-foreground">Cắt từ ảnh tập thể hoặc thêm ảnh riêng để gọi tên trong classroom.</p></div>
      </div>
      <Button variant="outline" onClick={() => { setSuccess(false); setOpen(true); }} disabled={photos.loading || !!photos.error || !students.length}><Crop className="h-4 w-4" /> Quản lý ảnh</Button>
    </div>
    <div className="mt-4 flex items-center gap-3">
      {(photos.data ?? []).find(p => p.key === "group") && <img src={photos.data!.find(p => p.key === "group")!.url} alt="Ảnh tập thể lớp" className="h-14 w-20 rounded-lg object-cover" />}
      <div className="flex -space-x-2">{(photos.data ?? []).filter(p => p.key !== "group").slice(0, 6).map(p => <Avatar key={p.key} name={students.find(s => s.student_id === p.key)?.student.name ?? "Học viên"} src={p.url} size={36} />)}</div>
      <span className="text-sm text-muted-foreground">{photos.loading ? "Đang tải ảnh…" : `${count}/${students.length} học viên có ảnh lớp`}</span>
      {success && <span role="status" className="flex items-center gap-1 text-sm font-semibold text-emerald-600"><Check className="h-4 w-4" /> Đã lưu ảnh</span>}
    </div>
    {photos.error && <div role="alert" className="mt-3 text-sm text-red-600">{photos.error} <button className="underline" onClick={photos.reload}>Thử lại</button></div>}
    {open && <PhotoEditor classId={classId} students={students} photos={photos.data ?? []} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setSuccess(true); photos.reload(); }} />}
  </section>;
}

function PhotoEditor({ classId, students, photos, onClose, onSaved }: { classId: string; students: ClassStudentRow[]; photos: ClassPhoto[]; onClose: () => void; onSaved: () => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const groupInput = useRef<HTMLInputElement>(null);
  const portraitInput = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);
  const urls = useRef<string[]>([]);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [size, setSize] = useState(160);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [region, setRegion] = useState<ReturnType<typeof cropRegion> | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wide, setWide] = useState(false);
  const scale = fit * zoom;
  const dirty = Object.keys(drafts).length > 0;
  const savedGroup = photos.find(p => p.key === "group");

  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    if (!savedGroup) return;
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = savedGroup.url;
    image.decode().then(() => { if (!cancelled) { setSource({ image, url: savedGroup.url }); setSize(Math.max(40, Math.round(Math.min(image.naturalWidth, image.naturalHeight) / 8))); } }).catch(() => { if (!cancelled) setError("Không tải được ảnh tập thể. Bạn có thể chọn lại ảnh gốc."); });
    return () => { cancelled = true; };
  }, [savedGroup]);

  useEffect(() => {
    const el = viewport.current;
    if (!el || !source) return;
    function measure() {
      const f = Math.min((el!.clientWidth - 32) / source!.image.naturalWidth, (el!.clientHeight - 32) / source!.image.naturalHeight, 1);
      setFit(f); setZoom(1); setPan({ x: (el!.clientWidth - source!.image.naturalWidth * f) / 2, y: (el!.clientHeight - source!.image.naturalHeight * f) / 2 }); setRegion(null);
    }
    const observer = new ResizeObserver(measure); observer.observe(el); measure();
    return () => observer.disconnect();
  }, [source, wide]);

  function close() { if (!busy && !saving && (!dirty || confirm("Bạn có ảnh chưa lưu. Đóng và bỏ các thay đổi?"))) onClose(); }
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);

  function setDraft(key: string, blob: Blob) {
    const url = URL.createObjectURL(blob); urls.current.push(url);
    setDrafts(prev => ({ ...prev, [key]: { blob, url } }));
  }

  async function upload(file: File | undefined, key: string) {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const s = await openImage(file); urls.current.push(s.url);
      if (key === "group") {
        setSource(s); setSize(Math.max(40, Math.round(Math.min(s.image.naturalWidth, s.image.naturalHeight) / 8)));
        const canvas = document.createElement("canvas");
        const ratio = Math.min(1, 2400 / Math.max(s.image.naturalWidth, s.image.naturalHeight));
        canvas.width = Math.round(s.image.naturalWidth * ratio); canvas.height = Math.round(s.image.naturalHeight * ratio);
        canvas.getContext("2d")!.drawImage(s.image, 0, 0, canvas.width, canvas.height);
        setDraft(key, await canvasBlob(canvas));
      } else {
        const side = Math.min(s.image.naturalWidth, s.image.naturalHeight);
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
        canvas.getContext("2d")!.drawImage(s.image, (s.image.naturalWidth - side) / 2, (s.image.naturalHeight - side) / 2, side, side, 0, 0, 512, 512);
        setDraft(key, await canvasBlob(canvas));
      }
    } catch (e) { setError(dbErrorMessage(e)); } finally { setBusy(false); }
  }

  async function assign(id: string) {
    if (!source || !region || busy || saving) return;
    setBusy(true); setError(null);
    try {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
      canvas.getContext("2d")!.drawImage(source.image, region.x, region.y, region.size, region.size, 0, 0, 512, 512);
      setDraft(id, await canvasBlob(canvas)); setRegion(null);
    } catch (e) { setError(dbErrorMessage(e)); } finally { setBusy(false); }
  }

  function changeZoom(next: number, cx?: number, cy?: number) {
    const z = Math.max(.5, Math.min(6, next));
    const x = cx ?? (viewport.current?.clientWidth ?? 0) / 2, y = cy ?? (viewport.current?.clientHeight ?? 0) / 2;
    setPan(p => ({ x: x - (x - p.x) * z / zoom, y: y - (y - p.y) * z / zoom })); setZoom(z);
  }
  function resetView() {
    if (!source || !viewport.current) return;
    setZoom(1);
    setPan({ x: (viewport.current.clientWidth - source.image.naturalWidth * fit) / 2, y: (viewport.current.clientHeight - source.image.naturalHeight * fit) / 2 });
  }
  const wheelHandler = useRef<(e: WheelEvent) => void>(() => {});
  wheelHandler.current = e => { if (!source) return; e.preventDefault(); const rect = viewport.current!.getBoundingClientRect(); changeZoom(zoom * Math.exp(-e.deltaY * .0015), e.clientX - rect.left, e.clientY - rect.top); };
  useEffect(() => { const el = viewport.current; const handler = (e: WheelEvent) => wheelHandler.current(e); el?.addEventListener("wheel", handler, { passive: false }); return () => el?.removeEventListener("wheel", handler); }, []);

  function portrait(id: string) { return id in drafts ? drafts[id]?.url : photos.find(p => p.key === id)?.url; }
  const count = students.filter(s => portrait(s.student_id)).length;
  return <Modal open onClose={close} title="Lấy ảnh học viên từ ảnh tập thể" className={wide ? "photo-editor photo-editor-wide" : "photo-editor"}>
    <input ref={groupInput} type="file" accept={ACCEPT} hidden onChange={e => { upload(e.target.files?.[0], "group"); e.target.value = ""; }} />
    <input ref={portraitInput} type="file" accept={ACCEPT} hidden onChange={e => { if (uploadFor.current) upload(e.target.files?.[0], uploadFor.current); e.target.value = ""; }} />
    <div className="photo-editor-hint"><Crop size={19} /><span>Bấm vào khuôn mặt, rồi chọn tên học viên để gán ảnh. Lăn chuột để phóng to; kéo ảnh để di chuyển.</span></div>
    <div className="photo-editor-tools">
      <Button size="sm" variant="outline" disabled={busy || saving} onClick={() => groupInput.current?.click()}><ImagePlus size={16} /> {source ? "Đổi ảnh tập thể" : "Thêm ảnh tập thể"}</Button>
      <label className="flex items-center gap-2 text-sm">Vùng cắt <input aria-label="Kích thước vùng cắt" type="range" min={Math.min(40, source ? Math.min(source.image.naturalWidth, source.image.naturalHeight) : 40)} max={source ? Math.min(source.image.naturalWidth, source.image.naturalHeight) : 600} value={size} onChange={e => { const v = Number(e.target.value); setSize(v); if (region && source) setRegion(cropRegion(source.image.naturalWidth, source.image.naturalHeight, region.x + region.size / 2, region.y + region.size / 2, v)); }} /><span className="w-14 tabular-nums">{size}px</span></label>
      <div className="flex items-center gap-1"><button aria-label="Thu nhỏ" onClick={() => changeZoom(zoom / 1.25)}><ZoomOut size={18} /></button><span className="w-12 text-center text-xs">{Math.round(zoom * 100)}%</span><button aria-label="Phóng to" onClick={() => changeZoom(zoom * 1.25)}><ZoomIn size={18} /></button><button aria-label="Vừa khung" onClick={resetView}><RotateCcw size={17} /></button><button aria-label="Mở rộng khung cắt" onClick={() => setWide(v => !v)}><Maximize2 size={17} /></button></div>
    </div>
    {error && <div role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="photo-editor-workspace">
      <div ref={viewport} className="photo-editor-canvas" tabIndex={0} aria-label="Ảnh tập thể: bấm khuôn mặt để chọn vùng cắt" style={{ touchAction: "none" }}
        onPointerDown={e => { if (!source || busy || saving) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false }; }}
        onPointerMove={e => { if (!drag.current) return; const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y; if (Math.hypot(dx, dy) > 4) drag.current.moved = true; if (drag.current.moved) setPan({ x: drag.current.px + dx, y: drag.current.py + dy }); }}
        onPointerCancel={() => { drag.current = null; }}
        onPointerUp={e => { const d = drag.current; drag.current = null; if (!d || d.moved || !source) return; const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left - pan.x) / scale, y = (e.clientY - r.top - pan.y) / scale; if (x >= 0 && y >= 0 && x <= source.image.naturalWidth && y <= source.image.naturalHeight) setRegion(cropRegion(source.image.naturalWidth, source.image.naturalHeight, x, y, size)); }}>
        {source ? <div className="photo-editor-image" style={{ width: source.image.naturalWidth, height: source.image.naturalHeight, transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
          <img draggable={false} src={source.url} alt="Ảnh tập thể để cắt khuôn mặt" width={source.image.naturalWidth} height={source.image.naturalHeight} />
          {region && <div className="photo-editor-ring" style={{ left: region.x, top: region.y, width: region.size, height: region.size, borderWidth: 3 / scale }} />}
        </div> : <div className="photo-editor-empty"><ImagePlus size={44} /><h3>Những gương mặt của lớp</h3><p>Chọn ảnh tập thể rõ nét để bắt đầu cắt ảnh.</p><Button onClick={() => groupInput.current?.click()} disabled={busy}><ImagePlus size={17} /> Chọn ảnh từ máy</Button></div>}
        {region && <div className="photo-editor-caption">Đã chọn khuôn mặt · Chọn tên ở danh sách →</div>}
      </div>
      <aside className="photo-editor-roster">
        <div className="flex items-center justify-between"><h4 className="font-bold">Gán cho học viên</h4><span className="text-xs text-muted-foreground">{count}/{students.length} có ảnh</span></div>
        {region && region.size < 200 && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Vùng cắt nhỏ, ảnh có thể hơi mờ. Dùng ảnh gốc rõ nét để có kết quả tốt hơn.</p>}
        <input aria-label="Tìm học viên để gán ảnh" className="rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Tìm tên học viên…" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="photo-editor-members">{students.filter(s => s.student.name.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))).map(s => <div className="photo-editor-member" key={s.student_id}>
          <button disabled={!region || busy || saving} onClick={() => assign(s.student_id)} className="photo-editor-assign" title={region ? `Gán vùng cắt cho ${s.student.name}` : "Chọn một khuôn mặt trên ảnh trước"}>
            <Avatar size={38} name={s.student.name} src={portrait(s.student_id) ?? s.student.avatar ?? undefined} /><span><strong>{s.student.name}</strong><small>{s.student_id in drafts ? "Chưa lưu" : portrait(s.student_id) ? "Đã có ảnh" : "Chưa có ảnh lớp"}</small></span>{region && <Crop size={15} />}
          </button>
          <button disabled={busy || saving} title={`Tải ảnh riêng cho ${s.student.name}`} aria-label={`Tải ảnh riêng cho ${s.student.name}`} onClick={() => { uploadFor.current = s.student_id; portraitInput.current?.click(); }}><ImagePlus size={16} /></button>
          {portrait(s.student_id) && <button disabled={busy || saving} title={`Xóa ảnh lớp của ${s.student.name}`} aria-label={`Xóa ảnh lớp của ${s.student.name}`} onClick={() => setDrafts(p => ({ ...p, [s.student_id]: null }))}><Trash2 size={15} /></button>}
        </div>)}</div>
        {source && <button className="text-left text-xs text-muted-foreground hover:text-red-600" disabled={busy || saving} onClick={() => { setDrafts(p => ({ ...p, group: null })); setSource(null); setRegion(null); }}>Gỡ ảnh tập thể khỏi lớp</button>}
      </aside>
    </div>
    <div className="photo-editor-footer"><span role="status">{dirty ? `${Object.keys(drafts).length} ảnh thay đổi · Bấm Lưu ảnh để giữ lại` : "Ảnh chỉ dùng trong lớp này"}</span><div className="flex gap-2"><Button variant="ghost" onClick={close} disabled={busy || saving}>Đóng</Button><Button disabled={!dirty || busy || saving} onClick={async () => { setSaving(true); setError(null); try { await saveClassPhotos(classId, Object.fromEntries(Object.entries(drafts).map(([key, d]) => [key, d?.blob ?? null]))); onSaved(); } catch (e) { setError(dbErrorMessage(e)); } finally { setSaving(false); } }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={17} />}{saving ? "Đang lưu…" : "Lưu ảnh"}</Button></div></div>
  </Modal>;
}
