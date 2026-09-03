import { ComingSoon } from "@/components/ui/coming-soon";

export default function CentersPage() {
  return (
    <ComingSoon
      title="Trung tâm"
      description="Hồ sơ từng cơ sở: tên, địa chỉ, số điện thoại, phòng học và giờ mở cửa."
      plan={[
        "Thêm / sửa / tạm dừng một cơ sở",
        "Sơ đồ phòng học và sức chứa, dùng để xếp thời khóa biểu",
        "Thông tin in trên biên lai của từng cơ sở",
      ]}
      fallback={{ href: "/admin/settings", label: "Sửa chi nhánh & phòng học ở Cài đặt" }}
    />
  );
}
