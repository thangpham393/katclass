import {
  BarChart3,
  BookMarked,
  BookOpen,
  Building2,
  Cake,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CalendarX2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  DollarSign,
  Download,
  FileText,
  GraduationCap,
  Languages,
  LayoutDashboard,
  Library,
  ListChecks,
  Package,
  Receipt,
  School,
  Settings,
  ShieldCheck,
  Sparkles,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { Role } from "@/lib/types";

export type Icon = React.ComponentType<{ className?: string }>;

export type NavLink = {
  href: string;
  label: string;
  icon: Icon;
};

/** Menu cha thu/mở được — chỉ còn dùng cho Thư viện học liệu. */
export type NavGroup = {
  label: string;
  icon: Icon;
  children: NavLink[];
};

export type NavEntry = NavLink | NavGroup;

/** Một khối menu; `label` rỗng = khối đầu, không có tiêu đề nhỏ. */
export type NavSection = {
  label?: string;
  entries: NavEntry[];
};

export const isGroup = (e: NavEntry): e is NavGroup => "children" in e;

/**
 * MENU PHẲNG, CHIA KHỐI THEO CÔNG VIỆC.
 *
 * Bản trước gom mọi thứ vào 5 cụm accordion — gọn nhưng mỗi lần đi đâu cũng
 * phải bung cụm ra mới thấy, hai lần bấm cho một trang. Nay bày phẳng hết và
 * chỉ chia bằng tiêu đề nhỏ ("Vận hành", "Cấu hình"): mắt lướt một lượt là
 * thấy toàn bộ chức năng, bấm một lần là tới nơi.
 *
 * Ngoại lệ duy nhất là Thư viện học liệu — 5 trang con cùng một chủ đề, để
 * phẳng thì chiếm gần nửa menu nên vẫn giữ dạng thu/mở.
 *
 * Tên mục đặt theo góc nhìn người dùng: cùng một tính năng nhưng admin thấy
 * "Duyệt đổi lịch" (việc phải làm) còn giáo viên thấy "Xin đổi lịch" (việc
 * mình gửi đi).
 */

/**
 * Kho học liệu trung tâm — một bộ menu duy nhất dùng chung cho giáo viên và
 * ban quản lý (các trang nằm ở /library, quyền nhập/xóa vẫn khóa theo vai trò).
 */
export const libraryGroup: NavGroup = {
  label: "Thư viện học liệu",
  icon: Library,
  children: [
    { href: "/library/textbooks", label: "Giáo trình", icon: BookMarked },
    { href: "/library/exercises", label: "Bộ bài tập", icon: ClipboardList },
    { href: "/library/lessons", label: "Bài học", icon: BookOpen },
    { href: "/library/vocab", label: "Kho từ vựng", icon: Languages },
    { href: "/library/questions", label: "Ngân hàng câu hỏi", icon: ListChecks },
  ],
};

const studentNav: NavSection[] = [
  {
    entries: [
      { href: "/student", label: "Trang chủ", icon: LayoutDashboard },
      { href: "/student/classes", label: "Lớp của tôi", icon: School },
      { href: "/student/homework", label: "Bài tập & kiểm tra", icon: ClipboardList },
      { href: "/student/flashcard", label: "Flashcard", icon: Sparkles },
      { href: "/student/library", label: "Kho tài liệu", icon: Library },
    ],
  },
  {
    label: "Cá nhân",
    entries: [
      { href: "/student/makeup", label: "Đăng ký học bù", icon: CalendarClock },
      { href: "/student/tuition", label: "Học phí & hóa đơn", icon: Receipt },
    ],
  },
];

const teacherNav: NavSection[] = [
  {
    entries: [
      { href: "/teacher", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/teacher/schedule", label: "Lịch dạy của tôi", icon: CalendarDays },
      { href: "/teacher/classes", label: "Lớp dạy", icon: School },
      { href: "/teacher/students", label: "Học viên của tôi", icon: Users },
    ],
  },
  {
    label: "Vận hành",
    entries: [
      { href: "/teacher/homework", label: "Giao bài tập", icon: ClipboardList },
      { href: "/teacher/requests", label: "Xin đổi lịch", icon: CalendarOff },
      { href: "/teacher/payroll", label: "Chấm công của tôi", icon: CalendarCheck },
    ],
  },
  { label: "Học liệu", entries: [libraryGroup] },
];

/**
 * MENU KHU QUẢN TRỊ — dựng sẵn theo bản thiết kế đầy đủ của trung tâm, kể cả
 * những mục chức năng chưa xây xong (Điểm danh, Vắng liên tiếp, Khách hàng
 * tiềm năng, Doanh thu, Học cụ, Sinh nhật, Học viên đã nghỉ, Trung tâm, Dữ
 * liệu). Mục chưa xong trỏ vào một trang `ComingSoon` nói rõ nó sẽ làm gì —
 * cố ý bày ra trước để người dùng thấy đường đi của phần mềm, rồi đắp dần
 * từng chức năng vào đúng chỗ đã có sẵn trong menu.
 *
 * Các mục CHỈ CLASSHUB mới có (Lớp học, Thời khóa biểu, Thư viện học liệu,
 * Duyệt đổi lịch, Quản lý học bù) xen vào đúng khối hợp nghĩa — không có
 * trong bản mẫu nhưng là chức năng đang chạy thật, bỏ đi là mất đường vào.
 */
const adminNav: NavSection[] = [
  {
    entries: [
      { href: "/admin", label: "Bảng điều khiển", icon: LayoutDashboard },
      { href: "/admin/students", label: "Học viên", icon: Users },
      { href: "/admin/attendance", label: "Điểm danh", icon: ClipboardCheck },
      { href: "/admin/checkin", label: "Check-in ca dạy", icon: Clock },
      { href: "/admin/absences", label: "Vắng liên tiếp", icon: CalendarX2 },
      { href: "/admin/classes", label: "Lớp học", icon: School },
      { href: "/admin/timetable", label: "Thời khóa biểu", icon: CalendarDays },
      libraryGroup,
    ],
  },
  {
    label: "Vận hành",
    entries: [
      { href: "/admin/leads", label: "Khách hàng tiềm năng", icon: UserPlus },
      { href: "/admin/revenue", label: "Doanh thu", icon: DollarSign },
      { href: "/admin/tuition", label: "Hóa đơn", icon: FileText },
      { href: "/admin/supplies", label: "Học cụ", icon: Package },
      { href: "/admin/birthdays", label: "Sinh nhật", icon: Cake },
      { href: "/admin/alumni", label: "Học viên đã nghỉ", icon: UserMinus },
      { href: "/admin/requests", label: "Duyệt đổi lịch", icon: CalendarOff },
      { href: "/admin/makeup", label: "Quản lý học bù", icon: CalendarClock },
    ],
  },
  {
    label: "Cấu hình",
    entries: [
      { href: "/admin/courses", label: "Khóa học", icon: BookMarked },
      { href: "/admin/centers", label: "Trung tâm", icon: Building2 },
      { href: "/admin/teachers", label: "Nhân sự", icon: ShieldCheck },
      { href: "/admin/payroll", label: "Bảng công & lương", icon: Wallet },
      { href: "/admin/settings", label: "Cài đặt", icon: Settings },
      { href: "/admin/data", label: "Dữ liệu", icon: Download },
      { href: "/admin/reports", label: "Báo cáo", icon: BarChart3 },
    ],
  },
];

const parentNav: NavSection[] = [
  { entries: [{ href: "/parent", label: "Trang chủ", icon: LayoutDashboard }] },
];

/**
 * Hành chính và kế toán dùng chung menu khu quản trị với admin — mục nào hiện
 * là do bảng quyền quyết định (lọc trong `SidebarNav`), không cắt cứng ở đây
 * nữa. Nhờ vậy bật quyền cho một vai trò là menu tự mọc ra.
 */
export const navByRole: Record<Role, NavSection[]> = {
  student: studentNav,
  teacher: teacherNav,
  admin: adminNav,
  staff: adminNav,
  accountant: adminNav,
  parent: parentNav,
};

export function isActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href.split("/").length > 2 && pathname.startsWith(href + "/"))
  );
}

/**
 * Tên trang hiện tại để in giữa thanh trên cùng. Lấy đúng nhãn trong menu nên
 * tiêu đề luôn khớp với mục đang sáng; trang con không có trong menu (vd
 * /admin/classes/<id>) thì lấy nhãn của mục cha.
 */
export function titleForPath(role: Role, pathname: string): string {
  let best = "";
  let bestLen = -1;
  const visit = (l: NavLink) => {
    if (isActive(pathname, l.href) && l.href.length > bestLen) {
      best = l.label;
      bestLen = l.href.length;
    }
  };
  for (const section of navByRole[role]) {
    for (const entry of section.entries) {
      if (isGroup(entry)) entry.children.forEach(visit);
      else visit(entry);
    }
  }
  if (best) return best;
  if (pathname.startsWith("/account")) return "Hồ sơ cá nhân";
  return "";
}
