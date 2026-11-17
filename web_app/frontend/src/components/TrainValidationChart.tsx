import { useState } from 'react';
import type { ConfigurationItem } from '../types';

export function TrainValidationChart({ configurations }: { configurations: ConfigurationItem[] }) {
  const [model, setModel] = useState('all');
  const [method, setMethod] = useState('all');
  const rows = configurations.filter(c => (model === 'all' || c.model === model) && (method === 'all' || c.method === method));
  return <section className="method-panel space-y-4">
    <h2>Train AP và Validation AP</h2>
    <p>Train AP là trung bình trên các phần huấn luyện CV. Biểu đồ tính chênh lệch Train AP − Validation AP. Cột Gap của tệp gốc là Train AP − CV AP.</p>
    <div className="flex flex-wrap gap-3">
      <label>Họ mô hình <select aria-label="Họ mô hình" value={model} onChange={e => setModel(e.target.value)}><option value="all">Tất cả</option>{[...new Set(configurations.map(c => c.model))].map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Chiến lược <select aria-label="Chiến lược biểu đồ" value={method} onChange={e => setMethod(e.target.value)}><option value="all">Tất cả</option>{[...new Set(configurations.map(c => c.method))].map(x => <option key={x}>{x}</option>)}</select></label>
    </div>
    <p>● Train AP　◆ Validation AP · Thang 0–1</p>
    <div className="ap-chart">
      {rows.map(c => {
        const label = `${c.model} · P${c.profile} · ${c.method}`;
        if (!Number.isFinite(c.train_ap) || !Number.isFinite(c.val_ap)) return <p key={label}>{label} · Thiếu Train AP hoặc Validation AP.</p>;
        const gap = c.train_ap-c.val_ap;
        const tooltip = `${label} | Train AP ${c.train_ap.toFixed(6)} | Validation AP ${c.val_ap.toFixed(6)} | Gap = Train AP − Validation AP = ${gap.toFixed(6)}`;
        return <div key={label} className={c.selected ? 'ap-row ap-selected' : 'ap-row'} tabIndex={0} title={tooltip}>
          <span>{label}{c.selected && <strong> · Được chọn</strong>}</span>
          <svg viewBox="0 0 300 24" role="img" aria-label={tooltip}><line x1="10" x2="290" y1="12" y2="12" stroke="var(--app-line)" /><line x1={10+280*c.val_ap} x2={10+280*c.train_ap} y1="12" y2="12" stroke="var(--app-accent)" strokeWidth="3" /><circle cx={10+280*c.train_ap} cy="12" r="5" fill="var(--app-accent)" /><path d={`M ${10+280*c.val_ap} 5 l 7 7 -7 7 -7 -7 Z`} fill="var(--chart-recall)" /></svg>
          <span>Train {c.train_ap.toFixed(4)} · Val {c.val_ap.toFixed(4)} · Δ {gap.toFixed(4)}</span>
        </div>;
      })}
      {!rows.length && <p>Không có cấu hình khớp bộ lọc.</p>}
    </div>
    <p>Chênh lệch nhỏ cần được xem cùng hiệu năng Validation. Biểu đồ này không chứng minh mô hình hoàn toàn không quá khớp.</p>
  </section>;
}
