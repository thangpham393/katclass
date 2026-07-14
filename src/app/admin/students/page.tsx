import { Empty } from "@/components/ui/empty";
import { Users } from "lucide-react";

export default function AdminStudentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Học viên toàn trung tâm</h1>
        <p className="mt-1 text-muted-foreground">Module đang phát triển — sẽ liên kết với CRM nội bộ.</p>
      </div>
      <Empty
        icon={Users}
        title="Danh sách 142 học viên"
        description="Sẽ hiển thị bảng đầy đủ kèm filter theo cấp độ, GV, trạng thái thanh toán."
      />
    </div>
  );
}
