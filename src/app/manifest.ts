import type { MetadataRoute } from "next";

/**
 * Cho phép "Thêm vào màn hình chính": mở từ biểu tượng sẽ chạy toàn màn hình
 * (không thanh địa chỉ) như một ứng dụng.
 *
 * Hai bộ icon cố ý khác nhau: bản thường đã bo góc sẵn, bản "maskable" tràn
 * viền và để chữ nhỏ hơn vì Android tự cắt theo mặt nạ của máy (tròn, vuông
 * tròn, giọt nước) — dùng bản bo góc cho maskable sẽ bị bo hai lần.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KAT CLASS · Học tiếng Trung thông minh",
    short_name: "KAT CLASS",
    description:
      "Lớp học, điểm danh, từ vựng, flashcard và bài tập của trung tâm tiếng Trung KAT Education.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#101527",
    theme_color: "#2549ec",
    lang: "vi",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
