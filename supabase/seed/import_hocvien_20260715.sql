-- =====================================================================
-- Import danh sách học viên thực tế (DanhSachHocVien_20260715, 123 học viên)
-- Tự tạo: chi nhánh, khóa học (suy từ tên lớp), lớp, hồ sơ học viên, xếp lớp.
-- Chạy SAU 0004_decouple_profiles.sql. Chạy lại lần 2 an toàn (idempotent).
-- =====================================================================
begin;

create temp table _import (
  student_code text, name text, phone text, email text, address text, note text,
  class_name text, branch_name text, course_name text, course_level text
) on commit drop;

insert into _import values
  ('HV00329', 'Phạm Đức Trọng', null, null, null, null, 'PREKIDS 1 T3,5 (10h30-11h30)', 'Chi Nhánh Vinhome Landmark', 'PREKIDS', 'KIDS'),
  ('HV00328', 'Lê Nhật Khôi', null, null, null, null, 'HSK2 T4 (14h00) T6 (11h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 2', 'HSK2'),
  ('HV00327', 'Nguyễn Quốc Khang', null, null, null, null, 'HSK1 T2,4 (19h00-20h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00326', 'Đinh Nguyễn Bảo Ngọc', null, null, null, null, 'HSK1 T2,4 (19h00-20h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00319', 'Đậu Hoàng Cát Tường', null, null, null, null, 'HSK1 T3 (17h30) T7 (16h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00318', 'Đậu Hoàng An Tường', null, null, null, null, 'HSK1 T3 (17h30) T7 (16h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00316', 'Nguyễn Võ Ý Nguyên', null, null, null, null, 'HSK3 (1:1) T2,4 (16h15-17h45)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00315', 'Đỗ Anh Thư', null, null, null, null, 'HSK1 T3 (17h30) T7 (16h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00314', 'Zheng Zhiyuan', null, null, null, null, 'HSK2 T4 (14h00) T6 (11h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 2', 'HSK2'),
  ('HV00313', 'Đặng An Khánh', null, null, null, null, 'YCT1 T3,5 (9h00-10h30) PVT', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00312', 'Phạm Bá Thanh', null, null, null, null, 'HSK1 T3 (17h30) T7 (16h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00311', 'Zheng Thư Nguyên', null, null, null, null, 'HSK4 T6 (16h00)-CN (15h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 4', 'HSK4'),
  ('HV00310', 'Trần Ngọc Minh Khuê', null, null, null, null, 'HSK1 T3 (17h30) T7 (16h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00309', 'Phạm Ngọc Thục Quyên', null, null, null, null, 'HSK1 T3 (17h30) T7 (16h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00307', 'Nguyễn Võ Nhật Nguyên', null, null, null, null, 'PREKIDS 1 T2,4 (17h00-18h00)', 'Chi Nhánh Vinhome Landmark', 'PREKIDS', 'KIDS'),
  ('HV00306', 'Đặng Thái Thảo', null, null, null, null, 'YCT2 T2,4 (19h00-20h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 2', 'KIDS'),
  ('HV00304', 'Phùng Linh Đan (Kem)', null, null, null, null, 'PREKIDS 1 T3,5 (10h30-11h30)', 'Chi Nhánh Vinhome Landmark', 'PREKIDS', 'KIDS'),
  ('HV00303', 'Đỗ Nhật Minh', null, null, null, null, 'YCT2 T2,4 (19h00-20h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 2', 'KIDS'),
  ('HV00301', 'Huỳnh Nguyễn Thiên Thanh', null, null, null, null, 'YCT1 T3,5 (17h30-19h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00300', 'Chung Tuấn Vinh', null, null, null, null, 'YCT1 T3,5 (9h00-10h30) PVT', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00299', 'Nguyễn Khắc Triệu', null, null, null, null, 'YCT1 T3,5 (9h00-10h30) PVT', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00293', 'Nguyễn Thành An', null, null, null, null, 'HSK1 T3,5 (17h30-19h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00289', 'Trần Gia Nghi', null, null, null, null, 'HSK1 T3,5 (17h30-19h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00288', 'Nguyễn Đắc Nam', null, null, null, null, 'Giao Tiếp (1:1) T2,4,6 (9h00-10h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00287', 'Đinh Thái Thiện Minh', null, null, null, null, 'YCT1 T2,4 (19h00-20h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00286', 'Hoàng Đức Bình', null, null, null, null, 'YCT1 T2,4 (19h00-20h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00285', 'Nguyễn Phan Ngân Thương', null, null, null, null, 'HSK1  T3 (17h30) T6 online (15h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00284', 'Phan Thuỳ Minh', null, null, null, null, 'HSK1 T3,5 (17h30-19h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00281', 'Phạm Châu Anh', null, null, null, null, 'YCT1 T3,5 (9h00-10h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00280', 'Nguyễn Nhã Uyên', null, null, null, null, 'YCT1 T3,5 (9h00-10h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00279', 'Kiều Hạnh', null, null, null, null, 'Giao Tiếp 1 T3,5 (15h30-17h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00278', 'Nhung Lê', null, null, null, null, 'Giao Tiếp 1 T3,5 (15h30-17h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00277', 'Phạm Khánh Hà', null, null, null, null, 'HSK1 T7,CN (18h00-19h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00275', 'Nguyễn Lê Nhật Hằng', null, null, null, null, 'HSK1 T7,CN (18h00-19h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00274', 'Nguyễn Như Hoàng Trâm', null, null, null, null, 'HSK1 T7,CN (18h00-19h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00262', 'Võ Nữ Hồng Ly', null, null, null, null, 'Giao Tiếp T2,4 (10h30-12h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00261', 'Đỗ Nhã Tâm', null, null, null, null, 'YCT2 (1:1) T7 (10h30) CN (9h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 2', 'KIDS'),
  ('HV00260', 'Đỗ Đức Nhân', null, null, null, null, 'HSK1 (1:1) T7 (9h00) CN (11h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 1', 'HSK1'),
  ('HV00257', 'Nguyễn Thị Huỳnh Nơ', null, null, null, null, 'GT T2-T4 (14:00-15:30)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00256', 'Chu Quỳnh An', null, null, null, null, 'YCT2 T7,CN (14h00-15h30) (5)', 'Chi Nhánh Vinhome Landmark', 'YCT 2', 'KIDS'),
  ('HV00255', 'Er Shu Vy (Jenna)', null, null, null, null, 'YCT1 T7 (15h30-17h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00254', 'Er Zheng Vinh (Justin)', null, null, null, null, 'YCT1 T7 (15h30-17h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00253', 'Phạm Lê Trúc Uyên', null, null, null, null, 'YCT1 T2,4 (17h30-18h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00232', 'Lê Phương Khánh Mỹ', null, null, null, null, 'GT T3-T5 (10h00-11h30)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00231', 'Lê Ngọc Anh', null, null, null, null, 'GT T3-T5 (10h00-11h30)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00229', 'Keanu Er Jia Jie', null, null, null, null, 'YCT1 T3,5 (17h30-19h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00227', 'Haoula An (Alita)', null, null, null, null, 'YCT1 T3,5 (17h30-19h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00224', 'Nguyễn Anh Khoa (Boy)', null, null, null, null, 'PREKIDS 1 T4,6 (16h30-18h00)', 'Chi Nhánh Vinhome Landmark', 'PREKIDS', 'KIDS'),
  ('HV00211', 'Nguyễn Phương Vy', '0865876840', null, null, null, 'HSK2 T2,4 (16h00-17h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 2', 'HSK2'),
  ('HV00101', 'Nguyễn Trọng Nhân', '0906155188', null, null, null, 'YCT3 T7,CN (13h00-14h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 3', 'KIDS'),
  ('HV00100', 'Trần Nguyễn Việt Thư', '0919129129', null, null, null, 'HSK3 T5 (17h30) T7 (8h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00099', 'Trần Nguyễn Minh Minh', '0919129129', null, null, null, 'YCT3 T7-CN (16:00-17:30)', 'Chi Nhánh Vinhome Landmark', 'YCT 3', 'KIDS'),
  ('HV00095', 'Nguyễn Thị Hạnh Nguyên', null, null, null, null, 'HSK5 T2,4 (8h00-9h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 5', 'HSK5'),
  ('HV00094', 'Trần Linh Nhi', null, null, null, null, 'HSK3 T5 (17:30) - T7 (10:30)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00092', 'Lê Chí Vượng', null, null, null, null, 'HSK3 T5 (17h30) T7 (8h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00091', 'Nguyễn Quốc Đăng Khoa', null, null, null, null, 'HSK3 T5 (17h30) T7 (8h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00090', 'Lê Hiển', null, null, null, null, 'HSK3 T4 (14h00) T6 (17h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00089', 'Nguyễn Sỹ Khôi Nguyên', null, null, null, null, 'HSK3 T4 (14h00) T6 (17h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00088', 'Chu Trần Bảo Uyên', null, null, null, null, 'HSK3 T6 (17h00) CN (16h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00086', 'Nguyễn Hoàng Quân', null, null, null, null, 'YCT2 T7,CN (14h00-15h30) (4)', 'Chi Nhánh Vinhome Landmark', 'YCT 2', 'KIDS'),
  ('HV00084', 'Ông Đặng Anh Tuấn', null, null, null, null, 'YCT2 T7,CN (14h00-15h30) (4)', 'Chi Nhánh Vinhome Landmark', 'YCT 2', 'KIDS'),
  ('HV00083', 'Bùi Hữu Tấn Lộc (Phillip)', null, null, null, null, 'YCT2 T7,CN (14h00-15h30) (4)', 'Chi Nhánh Vinhome Landmark', 'YCT 2', 'KIDS'),
  ('HV00082', 'Bùi Hữu Đức Phúc (Peter)', null, null, null, null, 'YCT2 T7,CN (14h00-15h30) (4)', 'Chi Nhánh Vinhome Landmark', 'YCT 2', 'KIDS'),
  ('HV00081', 'Hà Nhật Linh', null, null, null, null, 'CME2 T3,5 (19h00-20h30) (3)', 'Chi Nhánh Vinhome Landmark', 'CME 2', 'KIDS'),
  ('HV00080', 'Hoàng Thiên Y', null, null, null, null, 'CME2 T3,5 (19h00-20h30) (3)', 'Chi Nhánh Vinhome Landmark', 'CME 2', 'KIDS'),
  ('HV00079', 'Nguyễn Phương Anh (Anna)', '0816883993', null, null, null, 'CME2 T3,5 (19h00-20h30) (3)', 'Chi Nhánh Vinhome Landmark', 'CME 2', 'KIDS'),
  ('HV00078', 'Trịnh Huân Uy (Bắp)', null, null, null, null, 'CME2 T3,5 (19h00-20h30)', 'Chi Nhánh Vinhome Landmark', 'CME 2', 'KIDS'),
  ('HV00077', 'Lê Thanh Hiền Anh (Cherry)', null, null, null, null, 'CME2 T3,5 (19h00-20h30)', 'Chi Nhánh Vinhome Landmark', 'CME 2', 'KIDS'),
  ('HV00076', 'Chu Tiểu Mễ', null, null, null, null, 'CME2 T3,5 (19h00-20h30)', 'Chi Nhánh Vinhome Landmark', 'CME 2', 'KIDS'),
  ('HV00075', 'Lê Nguyễn Bình An', null, null, null, null, 'CME2 T3,5 (19h00-20h30)', 'Chi Nhánh Vinhome Landmark', 'CME 2', 'KIDS'),
  ('HV00074', 'Nguyễn Dương Chi Anh', null, null, null, null, 'CME2 T3,5 (19h00-20h30)', 'Chi Nhánh Vinhome Landmark', 'CME 2', 'KIDS'),
  ('HV00071', 'Trần Thị Lê Dung', null, null, null, null, 'Giao Tiếp T2,4 (10h30-12h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00070', 'Lê Phan Ánh Loan', null, null, null, null, 'Giao Tiếp T2,4 (10h30-12h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00069', 'Phùng Nhật Minh', null, null, null, null, 'Giao Tiếp T2,4 (10h30-12h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00068', 'Nguyễn Đình Thuỷ Tiên', null, null, null, null, 'HSK3 T2,4 (17h30-19h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00067', 'Phạm Huy Hoàng', null, null, null, null, 'HSK3 T2,4 (17h30-19h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00066', 'Nguyễn Phương Thảo', null, null, null, null, 'HSK3 T4 (15h00) T5 (13h30) T6 (15h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00065', 'Trần Bảo Vy', null, null, null, null, 'HSK3 T2,4 (17h30-19h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00064', 'Nguyễn Gia Bảo', null, null, null, null, 'HSK3 T2,4 (17h30-19h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00063', 'Nguyễn Như Thảo', null, null, null, null, 'HSK3 T3,5 (16h00-17h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00062', 'Nguyễn Hoàng Thảo My', null, null, null, null, 'HSK3 T3,5 (16h00-17h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00061', 'Nguyễn Mỹ Hoa', null, null, null, null, 'YCT4 T3,5 (16h00-17h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 4', 'KIDS'),
  ('HV00060', 'Phạm Nguyễn Lan Chi', '0947879493', null, null, null, 'YCT4 T3,5 (16h00-17h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 4', 'KIDS'),
  ('HV00059', 'Phạm Cao Bảo Châu', null, null, null, null, 'YCT3 T3,5 (16h00-17h30) (1)', 'Chi Nhánh Vinhome Landmark', 'YCT 3', 'KIDS'),
  ('HV00058', 'Nguyễn Khôi Nguyên', '0903691001', null, null, null, 'YCT3 T3 (17h00) CN (15h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 3', 'KIDS'),
  ('HV00057', 'Trịnh Phi Long', null, null, null, null, 'HSK2 T7 (8h00-9h00)', 'Chi Nhánh Vinhome Landmark', 'HSK 2', 'HSK2'),
  ('HV00056', 'Phương Uyên', null, null, null, null, 'HSK2 -T7 - Thầy Thắng', 'Chi Nhánh Vinhome Landmark', 'HSK 2', 'HSK2'),
  ('HV00055', 'Trịnh Hoàng Nam', null, null, null, null, 'HSK4 T6 (16h00)-CN (15h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 4', 'HSK4'),
  ('HV00054', 'Huỳnh Hiếu Minh', null, null, null, null, 'HSK4 T6 (16h00)-CN (15h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 4', 'HSK4'),
  ('HV00053', 'Lai Bảo San', null, null, null, null, 'HSK4 T6 (16h00)-CN (15h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 4', 'HSK4'),
  ('HV00052', 'Lai Bảo Trân', null, null, null, null, 'HSK4 T6 (16h00)-CN (15h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 4', 'HSK4'),
  ('HV00051', 'Hoàng Bảo Châu', null, null, null, null, 'HSK3 T2,5 (10h00-11h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00050', 'Bùi Nguyễn An Thy', '0816883993', null, null, null, 'HSK3 T2,4 (10h00-11h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00048', 'Nguyễn Ngân Khánh', '0816883993', null, null, null, 'HSK3 T6 (17h00) CN (16h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 3', 'HSK3'),
  ('HV00047', 'Dương Công Sỹ', null, null, null, null, 'HSK2 T4,6 (16h00-17h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 2', 'HSK2'),
  ('HV00046', 'Phạm Ngọc Anh', '0352583964', null, null, null, 'HSK2 T3-T5 (16:00-17:30)', 'Chi Nhánh Vinhome Landmark', 'HSK 2', 'HSK2'),
  ('HV00044', 'Phạm Đức Trí', null, null, null, null, 'YCT3 T3,5 (18h30-20h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 3', 'KIDS'),
  ('HV00043', 'Nguyễn Linh An', null, null, null, null, 'YCT3 T3,5 (18h30-20h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 3', 'KIDS'),
  ('HV00042', 'Nguyễn Gia An', null, null, null, null, 'YCT3 T3,5 (18h30-20h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 3', 'KIDS'),
  ('HV00041', 'Nguyễn Phúc An', null, null, null, null, 'YCT3 T3,5 (18h30-20h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 3', 'KIDS'),
  ('HV00038', 'Nguyễn Mai Thanh', null, null, null, null, 'Giao Tiếp T2,4 (10h30-12h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00033', 'Ngô Thị Bảo Yến', null, null, null, null, 'Giao Tiếp T2,4 (10h30-12h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00031', 'Nguỵ Tuệ Ánh', null, null, null, null, 'PREKIDS T7,CN (14h00-15h30)', 'Chi Nhánh Vinhome Landmark', 'PREKIDS', 'KIDS'),
  ('HV00030', 'Nguyễn Đức Thịnh', null, null, null, null, 'PREKIDS T7,CN (14h00-15h30)', 'Chi Nhánh Vinhome Landmark', 'PREKIDS', 'KIDS'),
  ('HV00029', 'Lê Hải Đăng', null, null, null, null, 'YCT2 T7,CN (14h00-15h30) (5)', 'Chi Nhánh Vinhome Landmark', 'YCT 2', 'KIDS'),
  ('HV00028', 'Nguyễn Đức Hưng', null, null, null, null, 'YCT2 T7,CN (14h00-15h30) (5)', 'Chi Nhánh Vinhome Landmark', 'YCT 2', 'KIDS'),
  ('HV00027', 'Hồ Sỹ Thành An', null, null, null, null, 'YCT2 T5 (9h00) T7 (14h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 2', 'KIDS'),
  ('HV00026', 'Lê Khoa', null, null, null, null, 'YCT3 T2,4 (17h30-19h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 3', 'KIDS'),
  ('HV00025', 'Lê Minh Khuê', null, null, null, null, 'YCT3 T2,4 (17h30-19h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 3', 'KIDS'),
  ('HV00024', 'Vũ Thuỳ Linh', null, null, null, null, 'Giao Tiếp (1:1) T7,CN (10h00-11h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00023', 'Duyên Oanh', null, null, null, null, 'GT1 1:1 T2 - T4', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00022', 'Minh Khoa', '0917331339', null, null, null, 'YCT1 (T2 - T7) - Thầy Thắng, Cô Nhung', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00021', 'Bùi Nguyễn An Nhiên', null, null, null, null, 'YCT1 T6 (17h00) CN (16h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00020', 'Lê Vũ Trí Minh', null, null, null, null, 'YCT1 T7,CN (10h00-11h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00019', 'Lê Vũ Trí Lâm', null, null, null, null, 'YCT1 T7,CN (10h00-11h30)', 'Chi Nhánh Vinhome Landmark', 'YCT 1', 'KIDS'),
  ('HV00015', 'Đào Quang Huy', null, null, null, null, 'Giao Tiếp T2,4 (18h30-20h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00014', 'Trần Ngọc Mỹ Duyên', null, null, null, null, 'Giao Tiếp T2,4 (18h30-20h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00013', 'Trương Hoàng Nam', null, null, null, null, 'Giao Tiếp T2,4 (18h30-20h00)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00010', 'Nguyễn Thị Trúc Hân', null, null, null, null, 'Giao Tiếp T3,5 (14h00-15h30)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00009', 'Phạm Thị Hồng Nhung', null, null, null, null, 'Giao Tiếp T3,5 (14h00-15h30)', 'Chi Nhánh Vinhome Landmark', 'Giao tiếp', 'GIAO_TIEP'),
  ('HV00007', 'Lý Nguyên Huân', null, null, null, null, 'YCT2 T5 (9h00) CN (14h00)', 'Chi Nhánh Vinhome Landmark', 'YCT 2', 'KIDS'),
  ('HV00006', 'Thuỵ Anh', null, null, null, null, 'HSK2 T2-T4 (16:00-17:30)', 'Chi Nhánh Vinhome Landmark', 'HSK 2', 'HSK2'),
  ('HV00002', 'Hoàng Phúc', null, null, null, null, 'HSK2 T2,4 (16h00-17h30)', 'Chi Nhánh Vinhome Landmark', 'HSK 2', 'HSK2');

-- 1. Chi nhánh
insert into public.branches (name)
select distinct i.branch_name from _import i
where i.branch_name is not null
  and not exists (select 1 from public.branches b where b.name = i.branch_name);

-- 2. Khóa học (suy ra từ tiền tố tên lớp)
insert into public.courses (name, level, branch_id)
select distinct i.course_name, i.course_level,
       (select b.id from public.branches b where b.name = i.branch_name)
from _import i
where i.course_name is not null
  and not exists (select 1 from public.courses c where c.name = i.course_name);

-- 3. Lớp học (status active, lịch tuần bổ sung sau trong app)
insert into public.classes (name, branch_id, course_id, status)
select distinct i.class_name,
       (select b.id from public.branches b where b.name = i.branch_name),
       (select c.id from public.courses c where c.name = i.course_name),
       'active'
from _import i
where i.class_name is not null
  and not exists (select 1 from public.classes k where k.name = i.class_name);

-- 4. Hồ sơ học viên (chưa có tài khoản đăng nhập → user_id null)
insert into public.profiles (name, email, phone, address, note, role, student_code, branch_id)
select i.name, coalesce(i.email, ''), i.phone, i.address, i.note, 'student', i.student_code,
       (select b.id from public.branches b where b.name = i.branch_name)
from _import i
where i.student_code is not null
  and not exists (select 1 from public.profiles p where p.student_code = i.student_code);

-- 5. Xếp học viên vào lớp
insert into public.class_students (class_id, student_id)
select k.id, p.id
from _import i
join public.profiles p on p.student_code = i.student_code
join public.classes k on k.name = i.class_name
where i.class_name is not null
on conflict do nothing;

commit;

-- Báo cáo kết quả
select
  (select count(*) from public.profiles where role = 'student') as hoc_vien,
  (select count(*) from public.classes) as lop,
  (select count(*) from public.courses) as khoa_hoc,
  (select count(*) from public.class_students) as luot_xep_lop,
  (select count(*) from public.branches) as chi_nhanh;
