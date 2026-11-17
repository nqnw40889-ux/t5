# Báo cáo AI4I Nhóm 16

## Bảo toàn dữ liệu và kết quả thực nghiệm

- Với mọi yêu cầu sửa dự án, xử lý `data/` và `ket_qua/` ở chế độ chỉ đọc. Giữ nguyên pipeline LightGBM và ngưỡng quyết định chính xác đã lưu. Không huấn luyện lại, dò ngưỡng lại hoặc chạy tác vụ có thể ghi đè các tệp này.
- Trước lần ghi đầu tiên, lập danh sách đường dẫn tương đối và SHA-256 của toàn bộ tệp trong hai thư mục, kể cả tệp ẩn. Lưu bản đối chiếu ngoài hai thư mục.
- Sau khi sửa và kiểm thử, tính lại từ đĩa. So sánh cả danh sách đường dẫn lẫn mã băm, báo số tệp khớp và báo rõ tệp thêm, mất hoặc đổi nếu có. Chỉ xác nhận bảo toàn khi kiểm tra khớp hoàn toàn.
