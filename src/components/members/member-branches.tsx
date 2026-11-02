"use client";

import { useMemo, useState } from "react";
import { GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorNote } from "@/components/ui/loading";
import {
  fetchProfileExtraBranches,
  mergeProfiles,
  setProfileExtraBranch,
  type Branch,
} from "@/lib/branch";
import { dbErrorMessage, fetchProfilesByRoleAllBranches, type ProfileRow } from "@/lib/db";
import { useLoad } from "@/lib/use-load";

/**
 * CHI NHÁNH DẠY THÊM (0060) — một tài khoản GV / nhân viên làm ở nhiều cơ
 * sở: tích chọn cơ sở phụ, hồ sơ sẽ hiện trong danh sách GV của cơ sở đó
 * (xếp lớp, xếp dạy thay...). Chi nhánh chính vẫn chọn ở thẻ "Chi nhánh".
 */
export function ExtraBranchesCard({
  profile,
  branches,
  canEdit,
}: {
  profile: ProfileRow;
  branches: Branch[];
  canEdit: boolean;
}) {
  const extra = useLoad(() => fetchProfileExtraBranches(profile.id), [profile.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const others = branches.filter((b) => b.id !== profile.branch_id);

  async function toggle(branchId: string, on: boolean) {
    setBusy(branchId);
    setError(null);
    try {
      await setProfileExtraBranch(profile.id, branchId, on);
      extra.reload();
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Dạy thêm ở chi nhánh</CardTitle></CardHeader>
      <CardContent className="space-y-2 p-4 pt-0 sm:p-6 sm:pt-0">
        {extra.error ? (
          <ErrorNote message={extra.error} />
        ) : (
          others.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-brand-600"
                disabled={!canEdit || extra.loading || busy !== null}
                checked={(extra.data ?? []).includes(b.id)}
                onChange={(e) => toggle(b.id, e.target.checked)}
              />
              {b.name}
              {busy === b.id && <span className="text-xs text-muted-foreground">Đang lưu...</span>}
            </label>
          ))
        )}
        {error && <ErrorNote message={error} />}
        <p className="text-xs text-muted-foreground">
          Dùng một tài khoản cho nhiều cơ sở: hồ sơ hiện trong danh sách giáo viên của cơ sở được tích,
          xếp lớp / dạy thay được. Giáo viên đăng nhập sẽ thấy lịch dạy của mọi cơ sở mình dạy
          (cần đăng nhập lại hoặc F5).
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * GỘP TÀI KHOẢN TRÙNG (chỉ admin) — giữ hồ sơ đang xem, chuyển toàn bộ dữ
 * liệu (buổi dạy, chấm công, lớp, nhận xét...) của tài khoản trùng sang đây,
 * cơ sở của tài khoản trùng thành chi nhánh dạy thêm, rồi xoá tài khoản trùng.
 */
export function MergeProfileCard({
  profile,
  branches,
  onMerged,
}: {
  profile: ProfileRow;
  branches: Branch[];
  onMerged: (message: string) => void;
}) {
  const all = useLoad(() => fetchProfilesByRoleAllBranches(profile.role), [profile.role]);
  // Mặc định gợi ý theo tên gọi (từ cuối): "Thanh Tuyền" ↔ "Trần Thị Thanh Tuyền"
  const [q, setQ] = useState(() => profile.name.trim().split(/\s+/).pop() ?? "");
  const [dropId, setDropId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "chưa gán cơ sở";
  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (all.data ?? []).filter(
      (p) => p.id !== profile.id && (!needle || p.name.toLowerCase().includes(needle) || (p.student_code ?? "").toLowerCase().includes(needle)),
    );
  }, [all.data, q, profile.id]);
  const drop = candidates.find((p) => p.id === dropId) ?? null;

  async function handleMerge() {
    if (!drop) return;
    if (!confirm(
      `GỘP TÀI KHOẢN — không hoàn tác được.\n\n` +
      `Giữ: ${profile.name} (${profile.student_code ?? "chưa có mã"}, ${branchName(profile.branch_id)})\n` +
      `Xoá: ${drop.name} (${drop.student_code ?? "chưa có mã"}, ${branchName(drop.branch_id)})\n\n` +
      `Toàn bộ buổi dạy, chấm công, lớp, nhận xét của tài khoản bị xoá chuyển sang tài khoản giữ. ` +
      `Mã đăng nhập ${drop.student_code ?? ""} sẽ không dùng được nữa.`,
    )) return;
    setBusy(true);
    setError(null);
    try {
      const n = await mergeProfiles(profile.id, drop.id);
      setDropId("");
      all.reload();
      onMerged(
        `Đã gộp ${drop.name} vào ${profile.name} (chuyển ${n} dòng dữ liệu). ` +
        `Báo giáo viên chỉ đăng nhập bằng mã ${profile.student_code ?? "của tài khoản giữ"}.`,
      );
    } catch (e) {
      setError(dbErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Gộp tài khoản trùng</CardTitle></CardHeader>
      <CardContent className="space-y-2.5 p-4 pt-0 sm:p-6 sm:pt-0">
        <p className="text-xs text-muted-foreground">
          Một người có 2 tài khoản (mỗi cơ sở một mã)? Giữ tài khoản này, chọn tài khoản trùng để
          chuyển hết dữ liệu sang đây rồi xoá tài khoản kia.
        </p>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên hoặc mã..." />
        <div className="max-h-48 divide-y overflow-y-auto rounded-lg border scrollbar-thin">
          {all.loading ? (
            <div className="p-3 text-xs text-muted-foreground">Đang tải...</div>
          ) : candidates.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">Không có tài khoản nào khớp.</div>
          ) : (
            candidates.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50">
                <input
                  type="radio"
                  name="merge-drop"
                  className="accent-brand-600"
                  checked={dropId === p.id}
                  onChange={() => setDropId(p.id)}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.student_code ?? "—"} · {branchName(p.branch_id)}
                </span>
              </label>
            ))
          )}
        </div>
        {error && <ErrorNote message={error} />}
        <Button
          variant="outline"
          className="w-full text-gold-700 hover:bg-gold-50"
          disabled={!drop || busy}
          onClick={handleMerge}
        >
          <GitMerge className="h-4 w-4" />
          {busy ? "Đang gộp..." : drop ? `Gộp ${drop.name} vào tài khoản này` : "Chọn tài khoản trùng"}
        </Button>
      </CardContent>
    </Card>
  );
}
