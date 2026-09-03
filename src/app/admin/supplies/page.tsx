import { ComingSoon } from "@/components/ui/coming-soon";

export default function SuppliesPage() {
  return (
    <ComingSoon
      title="Học cụ"
      description="Sách, vở, bộ thẻ từ và dụng cụ học tập cấp cho học viên."
      plan={[
        "Danh mục học cụ kèm giá và tồn kho từng chi nhánh",
        "Cấp phát cho học viên, tính vào hóa đơn nếu có thu tiền",
        "Cảnh báo sắp hết hàng",
      ]}
    />
  );
}
