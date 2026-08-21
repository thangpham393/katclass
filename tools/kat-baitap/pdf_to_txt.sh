#!/usr/bin/env bash
# Trích text từ bộ phiếu ôn tập KAT (PDF) ra thư mục txt/ cạnh script này.
# Cần poppler: brew install poppler
set -euo pipefail
SRC="${1:-$HOME/Peking/TÀI LIỆU GIẢNG DẠY KAT}"
OUT="$(cd "$(dirname "$0")" && pwd)/txt"
mkdir -p "$OUT"
cd "$SRC"
for f in */*.pdf; do
  pdftotext -layout "$f" "$OUT/$(echo "$f" | tr '/' '_' | sed 's/\.pdf$/.txt/')"
done
echo "Đã trích $(ls "$OUT" | wc -l) file vào $OUT"
