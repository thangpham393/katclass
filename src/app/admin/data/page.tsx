import { ComingSoon } from "@/components/ui/coming-soon";

export default function DataPage() {
  return (
    <ComingSoon
      title="Dữ liệu"
      description="Nhập dữ liệu từ Excel vào phần mềm và xuất dữ liệu ra khi cần."
      plan={[
        "Nhập danh sách học viên, lớp, giáo viên từ file Excel mẫu",
        "Xuất học viên, điểm danh, học phí ra Excel",
        "Nhật ký nhập liệu: ai nhập, bao nhiêu dòng, dòng nào lỗi",
      ]}
    />
  );
}
