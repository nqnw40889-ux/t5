# AI4I 2020 – Nhóm 16

Gói thực nghiệm chọn mô hình theo khả năng kiểm soát quá khớp và kết quả kiểm định. Mô hình đã lưu là LightGBM với độ sâu tối đa 4, tối đa 12 lá, 200 cây, tối thiểu 20 mẫu mỗi lá, learning rate 0,05 và L2 bằng 3. Cấu hình chọn giữ nguyên tỷ lệ lớp khi huấn luyện. Ngưỡng quyết định lấy từ F1 cao nhất trên Validation là 0,31537755439431603 (31,54%).

## Dùng mô hình đã lưu

Giải nén và mở terminal ở thư mục này. Dùng Python 3.12 và cài thư viện theo phiên bản trong gói.

```powershell
python -m pip install -r requirements.txt
python predict.py ket_qua/du_lieu/test.csv du_doan.csv
```

Thay đường dẫn đầu vào bằng CSV của bạn với các cột `Type`, `Air temperature [K]`, `Process temperature [K]`, `Rotational speed [rpm]`, `Torque [Nm]` và `Tool wear [min]`. Kết quả thêm `diem_hong` và `du_doan_hong` (1 là hỏng, 0 là bình thường). Áp ngưỡng đầy đủ từ JSON. Điểm là đầu ra của mô hình dùng để ra quyết định.

Để tích hợp với Antigravity, mở thư mục đã giải nén làm project. Gọi `predict_csv` trong `predict.py` cho luồng CSV, hoặc nạp pipeline và ngưỡng từ `ket_qua/thuc_nghiem/` cho luồng nhập tay. Giữ `preprocess.py` trong cùng project để Python tìm được hàm mã hóa đã lưu cùng pipeline.

## Chạy lại toàn bộ thí nghiệm

```powershell
python preprocess.py
python train.py
```

Lệnh thứ nhất tạo lại các tập và báo cáo kiểm tra từ CSV gốc trong `data/`. Lệnh thứ hai thử lại 40 cấu hình và ghi đè kết quả trong `ket_qua/thuc_nghiem/`. Tỷ lệ chia Train/Validation/Test là 70/15/15, phân tầng theo nhãn, với seed 42. Lựa chọn dựa trên AP kiểm định chéo (3 fold, lặp 2 lần) và AP Validation. Chấp nhận tối đa 0,03 dưới điểm cao nhất ở mỗi tiêu chí, sau đó chọn chênh lệch AP Train–kiểm định thấp nhất trong nhóm đạt điều kiện.

## Đối chiếu mục lục báo cáo

| Mục | Tệp và kết quả |
|---|---|
| 2.2, 3.1 | `ket_qua/du_lieu/audit.json` và `splits.csv` ghi kiểm tra CSV, thuộc tính và phân chia. Có 237/51/51 ca hỏng tương ứng Train/Validation/Test. |
| 2.3, 2.4, 3.2 | `so_sanh_40_cau_hinh.csv`, `quet_nguong_validation.csv` và `ket_qua.json` trong thư mục `ket_qua/thuc_nghiem/`. Cấu hình chọn có AP kiểm định chéo 0,7630, AP Validation 0,8190 và chênh lệch Train–kiểm định 0,1766. |
| 3.3 | Ma trận nhầm lẫn, đường Precision–Recall, kết quả Test và danh sách dự đoán sai. Test có 1.437 đúng bình thường, 12 báo nhầm, 12 bỏ sót và 39 đúng hỏng. |
| 3.4 | Dùng bảng so sánh để thảo luận ảnh hưởng của trọng số lớp, SMOTE và SMOTENC. Test là tập cố định đã dùng ở thí nghiệm trước và được mở sau bước chọn mô hình, ngưỡng ở lần chạy này. |

Gói này cung cấp phần xử lý, huấn luyện, dự đoán bằng CSV và kết quả thực nghiệm để tích hợp vào chương trình.
