import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import type { HistoryEntry } from '../reporting';
import { sensorFields, formatNumber } from './PredictionComparison';

export function PredictionReport({ entry, onClose }: { entry: HistoryEntry; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const result = entry.result;
  const threshold = result?.exact_threshold ?? entry.exactThreshold;
  const score = result?.model_score_percent ?? entry.score;
  return createPortal(
    <dialog ref={dialog} className="prediction-report" aria-labelledby="report-title" onClose={onClose}>
      <article className="prediction-report-content">
        <header>
          <p>AI4I 2020 · LightGBM</p>
          <h2 id="report-title">Báo cáo dự đoán tình trạng máy</h2>
          <p>{new Date(entry.time).toLocaleString('vi-VN')} · {entry.mode === 'csv' ? 'Tệp CSV' : 'Một mẫu'}</p>
          <p>{entry.sampleName && <>{entry.sampleName} · </>}Mã lượt: {entry.id}</p>
        </header>
        <section>
          <h3>Kết quả dự đoán</h3>
          {!!entry.outOfRangeCount && <p>{entry.outOfRangeCount} mẫu ngoài Train chỉ có kết quả tham khảo. Đối chiếu lại số đo trước khi sử dụng.</p>}
          {result?.out_of_range_warnings.length ? <p>Kết quả tham khảo. Kết quả ngoài phạm vi Train không đủ cơ sở kết luận. Đối chiếu lại số đo cảm biến.</p> : null}
          <p>{result ? result.status_label : `${entry.failures} cảnh báo hỏng trên ${entry.total} mẫu`}</p>
          {score !== undefined && <p>Điểm mô hình: {formatNumber.format(score)}%</p>}
          {threshold !== undefined && <p>Ngưỡng quyết định: {formatNumber.format(threshold * 100)}% (giá trị lưu: {threshold})</p>}
        </section>
        {result ? (
          <>
            <section>
              <h3>Thông số đầu vào</h3>
              <dl>
                <div><dt>Mức chất lượng</dt><dd>{result.inputs.Type}</dd></div>
                {sensorFields.map(({ key, label, unit }) => (
                  <div key={key}><dt>{label}</dt><dd>{formatNumber.format(result.inputs[key])} {unit}</dd></div>
                ))}
              </dl>
            </section>
            <section>
              <h3>Đối chiếu dải huấn luyện</h3>
              {result.out_of_range_warnings.length
                ? <ul>{result.out_of_range_warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
                : <p>Các thông số nằm trong dải huấn luyện.</p>}
            </section>
            {result.top_contributions.length > 0 && (
              <section>
                <h3>Đóng góp theo TreeSHAP</h3>
                <ul>{result.top_contributions.slice(0, 3).map(item => (
                  <li key={item.column}>{item.column_vn}: {item.contribution > 0 ? '+' : ''}{formatNumber.format(item.contribution)}</li>
                ))}</ul>
              </section>
            )}
          </>
        ) : (
          <p>{entry.mode === 'csv'
            ? 'Đây là báo cáo tổng hợp. Để xem đầu vào và TreeSHAP, mở chi tiết từng dòng ở trang dự đoán CSV.'
            : 'Lượt dự đoán cũ chỉ lưu thông tin tổng hợp.'}</p>
        )}
      </article>
      <div className="prediction-report-actions">
        <button type="button" className="app-button" onClick={() => dialog.current?.close()} autoFocus>Đóng</button>
        <button type="button" className="app-button app-button-primary" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> In / Lưu PDF
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
