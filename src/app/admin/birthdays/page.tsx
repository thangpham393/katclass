import { ComingSoon } from "@/components/ui/coming-soon";

export default function BirthdaysPage() {
  return (
    <ComingSoon
      title="Sinh nhật"
      description="Học viên có sinh nhật trong tháng — để trung tâm chúc mừng đúng ngày."
      plan={[
        "Danh sách sinh nhật theo tháng, tuần này, hôm nay",
        "Mẫu tin nhắn chúc mừng gửi phụ huynh",
        "Đánh dấu đã chúc để không sót ai",
      ]}
    />
  );
}
