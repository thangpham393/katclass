/**
 * Bóc ruột file .pptx ngay trên trình duyệt (không cần server).
 *
 * File .pptx thực chất là một file zip. Thứ ta cần lấy ra:
 *   • Các file tiếng/phim trong `ppt/media/`.
 *   • Slide nào dùng file nào — ghi ở `ppt/slides/_rels/slideN.xml.rels`.
 *   • TOẠ ĐỘ của icon loa trên slide — ghi trong `<p:pic>` của slide XML.
 * Có toạ độ thì khi chiếu, nút bấm nằm đúng chỗ cái loa trên hình, giáo viên
 * bấm từ nào nghe từ đó thay vì đoán "Tiếng 1 / Tiếng 2".
 *
 * Thứ tự slide lấy theo `presentation.xml` (thứ tự trình chiếu thật), KHÔNG
 * theo số trong tên file — hai thứ này khớp nhau ở phần lớn giáo trình nhưng
 * lệch hẳn khi slide bị chèn/xoá nhiều lần.
 */
import JSZip from "jszip";

export type PptxMediaKind = "audio" | "video";

/** Vị trí trên slide theo tỉ lệ cạnh (0..1) — phóng to thu nhỏ vẫn đúng chỗ. */
export interface SpotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Đoạn cần phát trong file, tính bằng giây.
 *
 * Giáo trình hay gán CẢ file nghe của bài vào từng nút rồi cắt đoạn cho từng
 * từ — PowerPoint ghi `<p14:trim st="14820" end="7362.45"/>`, trong đó `st` là
 * số mili giây cắt từ ĐẦU và `end` là số mili giây cắt từ CUỐI (không phải mốc
 * kết thúc — đã đối chiếu với độ dài file thật để chắc). Bỏ qua thẻ này thì
 * bấm nút nào cũng phát cả bài.
 */
export interface MediaClip {
  /** Giây bắt đầu. */
  start: number;
  /** Số giây bị cắt ở cuối file — mốc dừng = độ dài file trừ đi số này. */
  trimEnd: number;
}

export interface PptxSpot {
  /** Đường dẫn trong file zip, dùng làm khoá. */
  path: string;
  /** Tên file gốc, thường vô nghĩa kiểu "media7.mp3". */
  name: string;
  kind: PptxMediaKind;
  /** null khi không đọc được icon (vd nhạc nền cả slide). */
  rect: SpotRect | null;
  /** null khi nút phát trọn file. */
  clip: MediaClip | null;
}

export interface PptxDeck {
  slideCount: number;
  /** Tỉ lệ khung slide (16/9 = 1.777…), để đối chiếu với bản PDF. */
  aspect: number;
  /** bySlide[0] = các nút tiếng của slide 1. */
  bySlide: PptxSpot[][];
  /** Tổng số file tiếng/phim khác nhau. */
  total: number;
  /** Lấy nội dung file media (giải nén đúng lúc cần). */
  blob: (spot: PptxSpot) => Promise<Blob>;
}

const AUDIO_EXT = /\.(mp3|m4a|wav|wma|aac|ogg|oga|mpga|mid|midi)$/i;
const VIDEO_EXT = /\.(mp4|m4v|mov|avi|wmv|mkv|webm|mpg|mpeg)$/i;

export const MEDIA_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  mpga: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wma: "audio/x-ms-wma",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
};

export function mediaMime(path: string): string {
  return MEDIA_MIME[(path.split(".").pop() ?? "").toLowerCase()] ?? "application/octet-stream";
}

/** Đường dẫn trong .rels ghi tương đối ("../media/x.mp3") → đường dẫn trong zip. */
function resolveTarget(target: string): string | null {
  if (/^https?:/i.test(target)) return null; // media để ngoài file, không bóc được
  let t = target.replace(/\\/g, "/");
  if (t.startsWith("/")) return t.slice(1);
  while (t.startsWith("../")) t = t.slice(3);
  return t.startsWith("ppt/") ? t : `ppt/${t}`;
}

/** Bảng Id → đường dẫn của một file .rels. */
function parseRels(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of Array.from(xml.matchAll(/Id="([^"]+)"[^>]*?Target="([^"]+)"/g))) {
    const path = resolveTarget(m[2]);
    if (path) map.set(m[1], path);
  }
  return map;
}

function kindOf(path: string): PptxMediaKind | null {
  if (AUDIO_EXT.test(path)) return "audio";
  if (VIDEO_EXT.test(path)) return "video";
  return null;
}

/**
 * Đọc các <p:pic> có gắn tiếng trong một slide.
 *
 * Cấu trúc thật của một icon loa:
 *   <p:pic>
 *     <p:nvPicPr><p:nvPr>
 *        <a:audioFile r:link="rId1"/>            ← có thể là link…
 *        <p14:media r:embed="rId2"/>             ← …hoặc file nhúng thật
 *     </p:nvPr></p:nvPicPr>
 *     <p:blipFill><a:blip r:embed="rId7"/>…      ← ảnh cái loa, KHÔNG phải tiếng
 *     <p:spPr><a:xfrm><a:off x y/><a:ext cx cy/> ← toạ độ cần lấy
 *   </p:pic>
 * Vì blipFill cũng có r:embed nên chỉ dò rId trong khoảng <p:nvPr>…</p:nvPr>.
 */
function readSlideSpots(xml: string, rels: Map<string, string>, sldW: number, sldH: number) {
  const spots: PptxSpot[] = [];
  const used = new Set<string>();

  // Tiếng của HIỆU ỨNG hoạt hình (laser.wav, drumroll.wav…) khai qua <p:sndTgt>
  // trong khối <p:timing> — không phải tiếng bài học, gom vào thì thanh điều
  // khiển đầy nút vô nghĩa. Loại thẳng.
  const effects = new Set<string>();
  for (const m of Array.from(xml.matchAll(/<p:sndTgt[^>]*r:embed="([^"]+)"/g))) {
    const path = rels.get(m[1]);
    if (path) effects.add(path);
  }

  for (const pic of Array.from(xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g))) {
    const block = pic[0];
    if (!/audioFile|videoFile|p14:media/.test(block)) continue;

    const nvPr = /<p:nvPr>[\s\S]*?<\/p:nvPr>/.exec(block)?.[0] ?? "";
    let path: string | null = null;
    for (const r of Array.from(nvPr.matchAll(/r:(?:embed|link)="([^"]+)"/g))) {
      const candidate = rels.get(r[1]);
      if (candidate && kindOf(candidate)) {
        path = candidate;
        break;
      }
    }
    if (!path) continue;

    const trim = /<p14:trim\b([^>]*)>/.exec(block)?.[1] ?? "";
    const st = Number(/\bst="([\d.]+)"/.exec(trim)?.[1] ?? 0);
    const endTrim = Number(/\bend="([\d.]+)"/.exec(trim)?.[1] ?? 0);
    const clip: MediaClip | null =
      st > 0 || endTrim > 0 ? { start: st / 1000, trimEnd: endTrim / 1000 } : null;

    const off = /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(block);
    const ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(block);
    let rect: SpotRect | null =
      off && ext && sldW > 0 && sldH > 0
        ? {
            x: Number(off[1]) / sldW,
            y: Number(off[2]) / sldH,
            w: Number(ext[1]) / sldW,
            h: Number(ext[2]) / sldH,
          }
        : null;
    // Icon bị kéo ra ngoài khung (thủ thuật giấu nút để tiếng tự chạy) thì coi
    // như không có chỗ đặt — đưa lên thanh điều khiển thay vì vẽ ngoài slide.
    if (rect && (rect.x < 0 || rect.y < 0 || rect.x > 1 || rect.y > 1)) rect = null;

    used.add(path);
    spots.push({ path, name: path.split("/").pop() ?? path, kind: kindOf(path)!, rect, clip });
  }

  // Tiếng có trong slide nhưng không gắn icon nào (lời dẫn tự chạy) — vẫn cho
  // ra nút, chỉ là không biết đặt ở đâu nên để trên thanh điều khiển.
  for (const path of Array.from(new Set(rels.values()))) {
    if (used.has(path) || effects.has(path) || !kindOf(path)) continue;
    spots.push({ path, name: path.split("/").pop() ?? path, kind: kindOf(path)!, rect: null, clip: null });
  }

  return spots;
}

export async function readPptxDeck(file: File | Blob): Promise<PptxDeck> {
  const zip = await JSZip.loadAsync(file);

  // Khung slide + thứ tự trình chiếu
  const presXml = (await zip.file("ppt/presentation.xml")?.async("string")) ?? "";
  const sz = /<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/.exec(presXml);
  const sldW = Number(sz?.[1] ?? 12192000);
  const sldH = Number(sz?.[2] ?? 6858000);

  const presRels = parseRels((await zip.file("ppt/_rels/presentation.xml.rels")?.async("string")) ?? "");
  let slides = Array.from(presXml.matchAll(/<p:sldId[^>]*r:id="([^"]+)"/g))
    .map((m) => presRels.get(m[1]))
    .filter((p): p is string => Boolean(p) && /^ppt\/slides\/slide\d+\.xml$/i.test(p!));

  // File hỏng phần presentation.xml thì lui về xếp theo số trong tên file
  if (!slides.length) {
    slides = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => Number(/(\d+)\.xml/.exec(a)![1]) - Number(/(\d+)\.xml/.exec(b)![1]));
  }

  const bySlide: PptxSpot[][] = [];
  const all = new Set<string>();

  for (const slide of slides) {
    const xml = (await zip.file(slide)?.async("string")) ?? "";
    const relsXml =
      (await zip.file(slide.replace(/slides\/(slide\d+\.xml)$/i, "slides/_rels/$1.rels"))?.async("string")) ?? "";
    const rels = parseRels(relsXml);
    // Chỉ giữ media thật sự nằm trong file
    for (const [id, path] of Array.from(rels)) if (!zip.file(path)) rels.delete(id);

    const spots = readSlideSpots(xml, rels, sldW, sldH);
    spots.forEach((s) => all.add(s.path));
    bySlide.push(spots);
  }

  return {
    slideCount: slides.length,
    aspect: sldH > 0 ? sldW / sldH : 16 / 9,
    bySlide,
    total: all.size,
    blob: async (spot) => {
      const entry = zip.file(spot.path);
      if (!entry) throw new Error(`Không thấy ${spot.name} trong file`);
      const raw = await entry.async("blob");
      return raw.slice(0, raw.size, mediaMime(spot.path));
    },
  };
}
