import { useState } from 'react';
import { Download, FileSearch, Search } from 'lucide-react';
import { downloadCsv, type HistoryEntry } from '../reporting';

interface HistoryPageProps {
  entries: HistoryEntry[];
  saved: boolean;
  onStart: () => void;
  onReport: (entry: HistoryEntry) => void;
}

const normalize = (value: string) => value.toLowerCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd');
const dayMs = 24 * 60 * 60 * 1000;

export function HistoryPage({ entries, saved, onStart, onReport }: HistoryPageProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [days, setDays] = useState(0);
  const term = normalize(query);
  const cutoff = days ? Date.now() - days * dayMs : 0;
  const filtered = entries.filter(entry =>
    entry.time >= cutoff
    && (status === 'all' || (status === 'warning' ? entry.failures > 0 : entry.failures === 0))
    && (normalize(entry.id).includes(term) || normalize(entry.sampleName ?? '').includes(term)),
  );
  const reset = () => {
    setQuery('');
    setStatus('all');
    setDays(0);
  };
  const exportHistory = () => {
    downloadCsv([
      ['Mã lượt', 'Thời gian (ISO 8601)', 'Tên mẫu hoặc tệp', 'Hình thức', 'Số mẫu', 'Số cảnh báo', 'Điểm mô hình (%)', 'Ngưỡng lưu'],
      ...filtered.map(entry => [
        entry.id, new Date(entry.time).toISOString(), entry.sampleName ?? '', entry.mode === 'csv' ? 'CSV' : 'Nhập tay',
        entry.total, entry.failures, entry.score ?? '', entry.result?.exact_threshold ?? entry.exactThreshold ?? '',
      ]),
    ], 'lich-su-du-doan-ai4i.csv');
  };

  return (
    <section className="space-y-5">
      <div>
        <h1>Lịch sử dự đoán</h1>
        <p className="mt-1 text-sm text-slate-600">{saved ? 'Tối đa 50 lượt gần nhất, lưu trên trình duyệt này.' : 'Trình duyệt không lưu được lịch sử. Các lượt hiện tại chỉ có trong phiên này.'}</p>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
          <FileSearch className="mb-3 text-teal-700" aria-hidden="true" />
          <h2 className="font-semibold">Chưa có lượt dự đoán</h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">Thử một mẫu đã điền sẵn để tạo kết quả đầu tiên.</p>
          <button className="app-button app-button-primary" type="button" onClick={onStart}>Thử mẫu có sẵn</button>
        </div>
      ) : (
        <>
          <div className="history-filters rounded-xl border border-slate-200 bg-white p-4">
            <label className="history-search">
              Tìm theo mã lượt, tên mẫu hoặc tên tệp
              <span>
                <Search size={16} aria-hidden="true" />
                <input type="search" value={query} onChange={event => setQuery(event.target.value)} />
              </span>
            </label>
            <label><span id="history-time-label">Thời gian</span>
              <select aria-labelledby="history-time-label" value={days} onChange={event => setDays(Number(event.target.value))}>
                <option value={0}>Mọi thời điểm</option>
                <option value={1}>24 giờ qua</option>
                <option value={7}>7 ngày qua</option>
                <option value={30}>30 ngày qua</option>
              </select>
            </label>
            <label><span id="history-status-label">Kết quả</span>
              <select aria-labelledby="history-status-label" value={status} onChange={event => setStatus(event.target.value)}>
                <option value="all">Mọi kết quả</option>
                <option value="warning">Có cảnh báo</option>
                <option value="normal">Không có cảnh báo</option>
              </select>
            </label>
            <button className="app-button" type="button" onClick={exportHistory} disabled={!filtered.length}>
              <Download size={16} aria-hidden="true" /> Tải CSV đã lọc
            </button>
          </div>
          <p className="text-sm text-slate-600" role="status">{filtered.length} / {entries.length} lượt dự đoán</p>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Không tìm thấy lượt dự đoán phù hợp</h2>
              <button className="app-button mt-3" type="button" onClick={reset}>Xóa bộ lọc</button>
            </div>
          ) : (
            <ul className="history-list rounded-xl border border-slate-200 bg-white">
              {filtered.map(entry => (
                <li key={entry.id} className="history-row">
                  <div className="min-w-0">
                    <h2 className="break-words font-semibold">{entry.sampleName || (entry.mode === 'csv' ? 'Dự đoán từ CSV' : 'Dự đoán nhập tay')}</h2>
                    <p className="mt-1 text-xs text-slate-600">{new Date(entry.time).toLocaleString('vi-VN')}</p>
                    <p className="mt-1 break-all text-xs text-slate-600">Mã lượt {entry.id}</p>
                  </div>
                  <p className={entry.failures ? 'text-red-800' : 'text-emerald-800'}>
                    {entry.failures} cảnh báo / {entry.total} mẫu
                    {entry.score !== undefined && <span className="block text-xs text-slate-600">Điểm {entry.score.toLocaleString('vi-VN')}%</span>}
                  </p>
                  <button className="app-button" type="button" onClick={() => onReport(entry)}>Xem báo cáo</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
