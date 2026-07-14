import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Cài đặt trung tâm</h1>
        <p className="mt-1 text-muted-foreground">Thông tin chung và cấu hình toàn hệ thống.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Thông tin trung tâm</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 p-6 pt-0">
          <div>
            <label className="text-sm font-medium">Tên trung tâm</label>
            <Input className="mt-1.5" defaultValue="Trung tâm Hoa ngữ ClassHub" />
          </div>
          <div>
            <label className="text-sm font-medium">Hotline</label>
            <Input className="mt-1.5" defaultValue="1900 1234" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Địa chỉ</label>
            <Input className="mt-1.5" defaultValue="123 Nguyễn Trãi, Thanh Xuân, Hà Nội" />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button>Lưu thay đổi</Button>
      </div>
    </div>
  );
}
