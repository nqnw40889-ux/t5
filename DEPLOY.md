# Triển khai AI4I Nhóm 16

Giao diện chạy trên Vercel. API FastAPI và LightGBM chạy trong Docker trên Render.

## Render

1. Đăng nhập Render bằng GitHub và cấp quyền truy cập repo này.
2. Chọn New → Blueprint rồi chọn repo, branch main. Render đọc render.yaml để tạo dịch vụ Docker miễn phí.
3. Khi dịch vụ hoạt động, mở đường dẫn /api/health trên địa chỉ Render được cấp.

Kết quả kiểm tra cần có status healthy, model LightGBM và threshold 0.31537755439431603.
Địa chỉ thực tế do Render cấp có thể chứa hậu tố. Sao chép địa chỉ từ trang dịch vụ.

Docker sử dụng Python 3.12 và phiên bản thư viện trong requirements.txt.
Container chạy bằng tài khoản thường. Các tệp data/ và ket_qua/ thuộc root với quyền đọc cho tài khoản chạy API.
Gói miễn phí có thể cần thời gian khởi động khi có lượt truy cập đầu tiên.

## Vercel

1. Import cùng repo và đặt Root Directory là web_app/frontend.
2. Thêm biến môi trường AI4I_API_ORIGIN cho Production và Preview. Giá trị là địa chỉ HTTPS gốc của dịch vụ Render vừa tạo.
3. Bấm Deploy. vercel.mjs cấu hình build Vite và chuyển tiếp /api/ tới Render.

Sau khi thay biến môi trường, chạy Redeploy để cấu hình chuyển tiếp được tạo lại.
Kiểm tra Thử mẫu có sẵn → Chạy dự đoán mẫu, tải CSV, Kết quả kiểm thử và xuất báo cáo từ link Vercel.

## Bảo toàn mô hình

Các bước build và khởi động chỉ nạp pipeline.joblib và ngưỡng từ ket_qua.json để suy luận.
Lưu bản danh sách đường dẫn và SHA-256 của data/ và ket_qua/ trước khi chuẩn bị bản deploy,
rồi tính lại và đối chiếu sau khi hoàn tất.
