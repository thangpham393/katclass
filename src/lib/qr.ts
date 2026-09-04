/**
 * SINH MÃ QR TẠI CHỖ (QR model 2, byte mode, mức sửa lỗi M).
 *
 * Cổng phụ huynh cần một mã QR để dán/gửi. Không dùng dịch vụ sinh QR
 * bên ngoài vì đường dẫn là bí mật của học viên — gửi nó sang máy chủ
 * người khác chỉ để lấy tấm ảnh là tự làm lộ. Cũng không thêm thư viện
 * npm cho một việc gọn thế này.
 *
 * Phạm vi vừa đủ: chuỗi ASCII tới ~200 ký tự (phiên bản 1–10, mức M) —
 * dư cho URL dạng https://.../parent/s/<uuid>.
 * Thuật toán bám chuẩn ISO/IEC 18004 (cách trình bày quen thuộc của
 * Project Nayuki).
 */

/* ================= GF(256) cho Reed–Solomon ================= */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // đa thức nguyên thủy chuẩn QR
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

/** Đa thức chia (monic, bỏ hệ số bậc cao nhất) cho `degree` từ mã sửa lỗi. */
function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 2);
  }
  return result;
}

function rsRemainder(data: number[], degree: number): number[] {
  const divisor = rsDivisor(degree);
  const result = new Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < degree; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

/* ================= Bảng tra (phiên bản 1–10, mức M) ================= */

const TOTAL_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const EC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

/** Tâm các ô định vị phụ theo phiên bản (v1 không có). */
const ALIGN_POS: number[][] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30],
  [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

const MAX_VERSION = 10;

function getBit(x: number, i: number): boolean {
  return ((x >>> i) & 1) !== 0;
}

/* ================= Dữ liệu → chuỗi codeword ================= */

function encodeData(text: string, version: number): number[] {
  const bytes = new TextEncoder().encode(text);
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  const idx = version - 1;
  const dataCount = TOTAL_CODEWORDS[idx] - EC_PER_BLOCK[idx] * NUM_BLOCKS[idx];
  const capacity = dataCount * 8;

  for (let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0); // kết thúc
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    data.push(v);
  }
  for (let pad = 0xec; data.length < dataCount; pad ^= 0xec ^ 0x11) data.push(pad);
  return data;
}

/** Chia khối, tính mã sửa lỗi, rồi đan xen theo đúng thứ tự chuẩn. */
function addEcAndInterleave(data: number[], version: number): number[] {
  const idx = version - 1;
  const blocks = NUM_BLOCKS[idx];
  const ecLen = EC_PER_BLOCK[idx];
  const shortLen = Math.floor(data.length / blocks);
  const numLong = data.length % blocks;

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let k = 0;
  for (let i = 0; i < blocks; i++) {
    const len = shortLen + (i >= blocks - numLong ? 1 : 0);
    const block = data.slice(k, k + len);
    k += len;
    dataBlocks.push(block);
    ecBlocks.push(rsRemainder(block, ecLen));
  }

  const out: number[] = [];
  for (let i = 0; i < shortLen + 1; i++) {
    for (let b = 0; b < blocks; b++) {
      if (i < dataBlocks[b].length) out.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < ecLen; i++) {
    for (let b = 0; b < blocks; b++) out.push(ecBlocks[b][i]);
  }
  return out;
}

/* ================= Dựng ma trận ================= */

class Builder {
  size: number;
  modules: boolean[][];
  isFunction: boolean[][];

  constructor(public version: number) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    );
    this.isFunction = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    );
  }

  set(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }

  drawFunctionPatterns() {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < n && y >= 0 && y < n) {
            this.set(x, y, dist !== 2 && dist !== 4);
          }
        }
      }
    }

    const pos = ALIGN_POS[this.version - 1];
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        // Ba góc đã có ô định vị chính
        const corner =
          (i === 0 && j === 0) ||
          (i === 0 && j === pos.length - 1) ||
          (i === pos.length - 1 && j === 0);
        if (corner) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            this.set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }

    this.drawFormatBits(0);
    this.drawVersionBits();
  }

  drawFormatBits(mask: number) {
    const n = this.size;
    const data = (0b00 << 3) | mask; // 00 = mức sửa lỗi M
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;

    for (let i = 0; i <= 5; i++) this.set(8, i, getBit(bits, i));
    this.set(8, 7, getBit(bits, 6));
    this.set(8, 8, getBit(bits, 7));
    this.set(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, getBit(bits, i));

    for (let i = 0; i < 8; i++) this.set(n - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, n - 15 + i, getBit(bits, i));
    this.set(8, n - 8, true); // ô tối cố định
  }

  drawVersionBits() {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, bit);
      this.set(b, a, bit);
    }
  }

  drawCodewords(cw: number[]) {
    const n = this.size;
    let i = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // cột 6 là cột định thì, bỏ qua
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? n - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < cw.length * 8) {
            this.modules[y][x] = getBit(cw[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.isFunction[y][x]) continue;
        let invert = false;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  /**
   * Điểm phạt để chọn mặt nạ: đủ ba luật dễ hỏng nhất (dải 5 ô cùng màu,
   * mảng 2×2, tỉ lệ đen/trắng lệch). Bỏ luật "giống ô định vị" — mã vẫn
   * đúng chuẩn, chỉ là chọn mặt nạ không tối ưu tuyệt đối.
   */
  penalty(): number {
    const n = this.size;
    let score = 0;
    const runScore = (run: number) => (run >= 5 ? run - 2 : 0);

    for (let y = 0; y < n; y++) {
      let run = 1;
      for (let x = 1; x < n; x++) {
        if (this.modules[y][x] === this.modules[y][x - 1]) run++;
        else { score += runScore(run); run = 1; }
      }
      score += runScore(run);
    }
    for (let x = 0; x < n; x++) {
      let run = 1;
      for (let y = 1; y < n; y++) {
        if (this.modules[y][x] === this.modules[y - 1][x]) run++;
        else { score += runScore(run); run = 1; }
      }
      score += runScore(run);
    }
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const c = this.modules[y][x];
        if (c === this.modules[y][x + 1] && c === this.modules[y + 1][x] && c === this.modules[y + 1][x + 1]) {
          score += 3;
        }
      }
    }
    let dark = 0;
    for (const row of this.modules) for (const c of row) if (c) dark++;
    const ratio = (dark * 100) / (n * n);
    score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
    return score;
  }
}

/** Ma trận QR: `matrix[y][x] === true` là ô tối. */
export function qrMatrix(text: string): boolean[][] {
  const len = new TextEncoder().encode(text).length;
  let version = 0;
  for (let v = 1; v <= MAX_VERSION; v++) {
    const idx = v - 1;
    const dataCount = TOTAL_CODEWORDS[idx] - EC_PER_BLOCK[idx] * NUM_BLOCKS[idx];
    const need = 4 + (v < 10 ? 8 : 16) + len * 8;
    if (need <= dataCount * 8) { version = v; break; }
  }
  if (!version) throw new Error("Chuỗi quá dài để sinh QR (tối đa ~200 ký tự).");

  const codewords = addEcAndInterleave(encodeData(text, version), version);

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const b = new Builder(version);
    b.drawFunctionPatterns();
    b.drawCodewords(codewords);
    b.drawFormatBits(mask);
    b.applyMask(mask);
    const s = b.penalty();
    if (s < bestScore) { bestScore = s; best = b.modules; }
  }
  return best!;
}

/** QR dạng SVG (chuỗi), viền trắng 4 ô theo chuẩn để máy quét bắt được. */
export function qrSvg(text: string, size = 220): string {
  const m = qrMatrix(text);
  const n = m.length;
  const quiet = 4;
  const dim = n + quiet * 2;
  let path = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (m[y][x]) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${dim}" fill="#fff"/>` +
    `<path d="${path}" fill="#000"/></svg>`
  );
}
