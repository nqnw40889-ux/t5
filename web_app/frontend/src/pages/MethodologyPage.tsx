import { useEffect, useState } from 'react';

interface Counts { total: number; failures: number; normals: number; failure_percent: number }
interface Methodology {
  source: string;
  distributions: Record<string, Counts>;
  missing_cells: number;
  duplicate_rows: number;
  duplicate_udi: number | null;
  columns: Array<{ column: string; role: string; decision: string; reason: string }>;
  inputs: string[];
  encoded_features: string[];
  type_categories: string[];
  sampler: string;
  winner: { model: string; profile: number; method: string };
}
const names: Record<string, string> = { all: 'Toàn bộ', train: 'Train', validation: 'Validation', test: 'Test' };
const roles: Record<string, string> = { train: 'Học mô hình', validation: 'Lựa chọn cấu hình và ngưỡng', test: 'Đánh giá cuối cùng' };
const number = new Intl.NumberFormat('vi-VN');

export function MethodologyPage() {
  const [data, setData] = useState<Methodology>();
  const [error, setError] = useState('');
  const [split, setSplit] = useState('all');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/methodology', { signal: controller.signal }).then(async response => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.detail || 'Không đọc được dữ liệu phương pháp.');
      setData(value);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Đang đọc các tập dữ liệu và pipeline đã lưu…</p>;
  const counts = data.distributions[split];
  return <div className="method-page space-y-6 pb-12">
    <header><h1>Dữ liệu &amp; phương pháp</h1><p>Dữ liệu tổng hợp mô phỏng vận hành thiết bị trong AI4I 2020.</p><a className="text-teal-700 underline" href={data.source} target="_blank" rel="noreferrer">Nguồn dữ liệu UCI AI4I 2020</a></header>
    <section className="method-panel">
      <h2>Tổng quan dữ liệu</h2>
      <p>{number.format(data.distributions.all.total)} bản ghi. Nhãn mục tiêu Machine failure. Mô hình nhận {data.inputs.length} thuộc tính đầu vào.</p>
      <p>{data.missing_cells} ô thiếu theo isna(). {data.duplicate_rows} bản ghi trùng trên toàn bộ các cột, tính từ lần xuất hiện thứ hai. {data.duplicate_udi ?? 'Chưa có dữ liệu'} mã UDI bị lặp.</p>
      <p>Kiểm tra thiếu và trùng chỉ phản ánh hai tiêu chí này. Dải quan sát trong Train không phải giới hạn vận hành an toàn.</p>
    </section>

    <section className="method-panel">
      <h2>Phân bố lớp</h2>
      <label>Tập dữ liệu <select aria-label="Tập dữ liệu" value={split} onChange={e => setSplit(e.target.value)}>{Object.entries(names).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <div className="class-chart" role="img" aria-label={`${names[split]}: ${counts.normals} không hỏng, ${counts.failures} hỏng`}>
        {[{ label: 'Không hỏng', count: counts.normals }, { label: 'Hỏng', count: counts.failures }].map((item, i) => <div key={item.label}>
          <strong>{item.label}</strong><span>{number.format(item.count)} mẫu · {(100 * item.count / counts.total).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%</span>
          <div className="class-track"><div className={i ? 'class-failure' : 'class-normal'} style={{ height: `${100 * item.count / counts.total}%` }} /></div>
        </div>)}
      </div>
    </section>
    <section className="method-panel">
      <h2>Phân chia các tập đã lưu</h2>
      <div className="overflow-x-auto"><table className="method-table"><thead><tr>{['Tập', 'Số mẫu', 'Không hỏng', 'Hỏng', 'Tỷ lệ toàn bộ', 'Vai trò'].map(x => <th scope="col" key={x}>{x}</th>)}</tr></thead><tbody>{Object.keys(roles).map(key => {
        const c = data.distributions[key];
        return <tr key={key}><th scope="row">{names[key]}</th><td>{number.format(c.total)}</td><td>{number.format(c.normals)}</td><td>{number.format(c.failures)} ({c.failure_percent.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%)</td><td>{(100*c.total/data.distributions.all.total).toLocaleString('vi-VN')}%</td><td>{roles[key]}</td></tr>;
      })}</tbody></table></div>
    </section>
    <section className="method-panel space-y-3">
      <h2>Tiền xử lý trong pipeline đã lưu</h2>
      <p>Type được one-hot theo thứ tự {data.type_categories.join(', ')}. Năm biến số giữ nguyên trong pipeline cuối. Sau biến đổi có {data.encoded_features.length} đặc trưng.</p>

      <h2>Thực nghiệm và lựa chọn mô hình</h2>
      <p>36 cấu hình chính thử baseline, trọng số lớp và SMOTENC. Bốn đối chứng chỉ dùng biến số thử numeric_baseline và smote_numeric. SMOTENC xử lý cả biến số và Type, SMOTE ở đối chứng chỉ dùng biến số. sampling_strategy=0.25 là tỷ lệ số mẫu thiểu số trên đa số sau tăng mẫu.</p>
      <p>Mô hình cuối dùng {data.winner.model} theo chiến lược {data.winner.method}. Lựa chọn dựa trên CV AP, Validation AP và Gap Train–CV; ngưỡng lấy từ F1 trên Validation.</p>
      <details><summary>Chi tiết tiền xử lý và tiêu chí lựa chọn</summary>
      <p>Trọng số lớp tăng trọng số mẫu hỏng lên 5. Logistic Regression và các cấu hình SMOTENC chuẩn hóa biến số trong từng pipeline huấn luyện. Mô hình cuối là {data.winner.model}, Profile {data.winner.profile}, chiến lược {data.winner.method}, bộ tăng mẫu {data.sampler === 'passthrough' ? 'không tăng mẫu' : data.sampler}.</p>
      <p>Theo mã thực nghiệm, lọc cấu hình có CV AP và Validation AP cách mức cao nhất tương ứng không quá 0,03. Trong nhóm đạt, ưu tiên Gap Train–CV nhỏ hơn, sau đó độ lệch chuẩn CV nhỏ hơn, rồi Validation F1 cao hơn. Train AP là trung bình AP trên phần huấn luyện của sáu lượt kiểm định chéo (3 fold × 2 lần).</p>
      <p>Ngưỡng được chọn theo F1 cao nhất trên Validation. Khi hòa, ưu tiên Recall rồi ngưỡng cao hơn. Test được dùng để đánh giá sau lựa chọn. TreeSHAP giải thích đóng góp lên điểm mô hình, không xác định nguyên nhân hoặc bộ phận hỏng.</p>
      <details><summary>Thứ tự đặc trưng sau biến đổi</summary><ol className="list-decimal pl-6">{data.encoded_features.map(name => <li key={name} className="break-all">{name}</li>)}</ol></details>      </details>
    </section>
    <details className="method-panel">
      <summary>Xem đầy đủ {data.columns.length} cột và lý do giữ / bỏ</summary>
      <div className="overflow-x-auto"><table className="method-table"><thead><tr>{['Tên cột', 'Vai trò', 'Giữ / bỏ', 'Lý do'].map(x => <th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{data.columns.map(c => <tr key={c.column}><th scope="row">{c.column}</th><td>{c.role}</td><td>{c.decision}</td><td>{c.reason}</td></tr>)}</tbody></table></div>
    </details>
  </div>;
}
