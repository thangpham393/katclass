import { Empty } from "@/components/ui/empty";
import { HeartHandshake } from "lucide-react";

export default function ParentHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Cổng phụ huynh</h1>
        <p className="mt-1 text-muted-foreground">
          Theo dõi tình hình học tập của con tại KAT Education.
        </p>
      </div>
      <Empty
        icon={HeartHandshake}
        title="Đang hoàn thiện"
        description="Khu vực này sẽ hiển thị điểm danh, nhận xét của giáo viên, bài tập và thành tích của con bạn. Trung tâm sẽ liên kết tài khoản của bạn với hồ sơ học viên."
      />
    </div>
  );
}
