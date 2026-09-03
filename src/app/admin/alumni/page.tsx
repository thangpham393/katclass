import { ComingSoon } from "@/components/ui/coming-soon";

export default function AlumniPage() {
  return (
    <ComingSoon
      title="Học viên đã nghỉ"
      description="Hồ sơ học viên đã dừng học — giữ lại để chăm sóc, mời quay lại khi có khóa phù hợp."
      plan={[
        "Lý do nghỉ và ngày nghỉ, thống kê theo lý do",
        "Số buổi còn thừa trong gói khi nghỉ",
        "Mời học lại: lọc theo trình độ đã học và thời điểm nghỉ",
      ]}
    />
  );
}
