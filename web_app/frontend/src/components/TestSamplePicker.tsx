import { useEffect, useState } from 'react';
import type { PredictionInputs } from '../types';

export interface TestSample { id: number; label: number; inputs: PredictionInputs }
export function TestSamplePicker({ onSelect, disabled }: { onSelect: (sample: TestSample) => void; disabled: boolean }) {
  const [samples, setSamples] = useState<TestSample[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState('all');
  const [selected, setSelected] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/test-samples', { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Không đọc được tập Test.');
      setSamples(data);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, []);
  const filtered = samples.filter(s => String(s.id).includes(query.trim()) && (label === 'all' || s.label === Number(label)));
  return <section className="method-panel space-y-3">
    <h2>Chọn mẫu Test</h2>
    <p>Đây là các mẫu Test đã dùng để đánh giá mô hình, không phải một lần kiểm chứng độc lập mới.</p>
    {error && <p role="alert">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <label>Tìm mã UDI <input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label>Nhãn thật <select aria-label="Nhãn thật" value={label} onChange={e => setLabel(e.target.value)}><option value="all">Tất cả</option><option value="0">Bình thường</option><option value="1">Có hỏng</option></select></label>
      <label>Mẫu Test <select aria-label="Mẫu Test" disabled={disabled} value={filtered.some(s => String(s.id) === selected) ? selected : ''} onChange={e => {
        setSelected(e.target.value);
        const sample = samples.find(s => s.id === Number(e.target.value));
        if (sample) onSelect(sample);
      }}><option value="">Chọn mã mẫu</option>{filtered.map(s => <option key={s.id} value={s.id}>UDI {s.id} · {s.label ? 'Có hỏng' : 'Bình thường'}</option>)}</select></label>
    </div>
    <p role="status">{filtered.length} mẫu phù hợp</p>
  </section>;
}
