"use client";

/**
 * HỘP THOẠI "CỔNG PHỤ HUYNH" (migration 0041).
 *
 * Việc của trung tâm gọn lại còn một thao tác: mở ra, copy đường dẫn
 * (hoặc đưa QR cho phụ huynh quét) là xong — không tạo tài khoản, không
 * mật khẩu. Ba nút còn lại là để xử lý khi có sự cố: tắt truy cập, đổi
 * đường dẫn nếu lỡ gửi nhầm, và xem phụ huynh đã mở lần cuối lúc nào.
 */

import { useEffect, useMemo, useState } from "react";
import { Copy, Check, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LoadingRows, ErrorNote } from "@/components/ui/loading";
import { qrSvg } from "@/lib/qr";
import {
  ensureParentShareLink,
  parentShareUrl,
  rotateParentShareToken,
  setParentShareEnabled,
  type ParentShareLink,
} from "@/lib/db-parent-share";
import { dbErrorMessage } from "@/lib/db";

function last4(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
}

export function ParentShareModal({
  studentId,
  createdBy,
  phoneHints,
  onClose,
}: {
  studentId: string;
  createdBy: string | null;
  /** SĐT phụ huynh đã liên kết (+ SĐT học viên) — để nhắc nhân viên 4 số cần đọc. */
  phoneHints: (string | null | undefined)[];
  onClose: () => void;
}) {
  const [link, setLink] = useState<ParentShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    ensureParentShareLink(studentId, createdBy)
      .then((l) => alive && setLink(l))
      .catch((e) => alive && setError(dbErrorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [studentId, createdBy]);

  const url = link ? parentShareUrl(link.token) : "";
  const svg = useMemo(() => (url ? qrSvg(url, 200) : ""), [url]);
  const hints = phoneHints.map(last4).filter(Boolean);

  async function toggle() {
    if (!link || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setParentShareEnabled(studentId, !link.enabled);
      setLink({ ...link, enabled: !link.enabled });
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    if (!link || busy) return;
    if (!confirm("Tạo đường dẫn mới? Đường dẫn/QR đã gửi trước đó sẽ không mở được nữa.")) return;
    setBusy(true);
    setError(null);
    try {
      setLink(await rotateParentShareToken(studentId));
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Trình duyệt chặn sao chép — bôi đen đường dẫn rồi copy tay giúp em.");
    }
  }

  return (
    <Modal open onClose={onClose} title="Cổng phụ huynh">
      {loading ? (
        <LoadingRows rows={2} className="p-0" />
      ) : !link ? (
        <ErrorNote message={error ?? "Không mở được cổng phụ huynh."} />
      ) : (
        <div className="space-y-4">
          {error && <ErrorNote message={error} />}

          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <p className="text-sm font-semibold">Bật truy cập</p>
              <p className="text-xs text-muted-foreground">Khi tắt, đường dẫn sẽ không mở được.</p>
            </div>
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              aria-pressed={link.enabled}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                link.enabled ? "bg-brand-600" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  link.enabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold">Đường dẫn cho phụ huynh</p>
            <div className="flex gap-2">
              <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="outline" onClick={copy} title="Sao chép">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {hints.length
                ? `Phụ huynh sẽ được yêu cầu nhập 4 số cuối SĐT (••${hints[0]}) để xem.`
                : "Chưa có SĐT phụ huynh/học viên trong hồ sơ — phải nhập SĐT thì phụ huynh mới xác minh được."}
            </p>
          </div>

          <div className="rounded-xl border p-4 text-center">
            <p className="mb-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <QrCode className="h-4 w-4" /> Mã QR
            </p>
            <div
              className="mx-auto w-[200px]"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="mt-3 text-xs text-muted-foreground">Phụ huynh quét mã để mở đường dẫn.</p>
          </div>

          <div className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Lần xem gần nhất:</span>
            <span className="font-semibold">
              {link.last_viewed_at
                ? new Date(link.last_viewed_at).toLocaleString("vi-VN")
                : "Chưa xem"}
            </span>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={rotate} disabled={busy}>
            <RefreshCw className="h-4 w-4" /> Tạo đường dẫn mới
          </Button>
        </div>
      )}
    </Modal>
  );
}
