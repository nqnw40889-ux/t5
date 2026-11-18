import { useEffect, useState } from 'react';
import type { PredictionResult } from '../types';
import { Machine3DViewer } from './Machine3DViewer';
import { ThresholdBar } from './ThresholdBar';
import { ShapWaterfall } from './ShapWaterfall';
import { InspectionSuggestions } from './InspectionSuggestions';
import { PredictionComparison, sensorFields } from './PredictionComparison';

export function PredictionPanel({ result, stale, failed, hideTruth, onReport, onExport, baseline, onKeep, onClear }: {
  result: PredictionResult; stale?: boolean; failed?: boolean; hideTruth?: boolean;
  onReport: () => void; onExport: () => void;
  baseline?: PredictionResult | null; onKeep?: () => void; onClear?: () => void;
}) {
  const outside = result.out_of_range_warnings.length > 0;
  const [rangeOpen, setRangeOpen] = useState(outside);
  useEffect(() => setRangeOpen(outside), [result, outside]);
  const compare = result.test_comparison;
  return <article className="prediction-panel" aria-label="Kết quả dự đoán">
    <header className="result-actions">
      <h2>Kết quả {stale || failed ? 'lần dự đoán trước' : 'dự đoán'}</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="app-button" onClick={onReport}>Xem báo cáo</button>
        <details className="export-menu"><summary>Xuất kết quả</summary><button type="button" className="app-button" onClick={onExport}>Tải tóm tắt JSON</button></details>
      </div>
    </header>
    {stale && <p role="status" className="result-notice">Thông số đã thay đổi. Bấm Dự đoán để cập nhật kết quả.</p>}
    {(stale || failed) && <p className="text-sm text-slate-600">Kết quả này tương ứng với thông số của lần dự đoán trước, xem trong phần thông số đã dùng.</p>}
    {failed && <p role="status" className="result-notice">Yêu cầu vừa gửi chưa có kết quả mới.</p>}
    <div className="result-primary">
      <div>
        <p className={result.is_failure ? 'result-label text-red-800' : 'result-label text-emerald-800'}>{result.status_label}</p>
        {outside && <p className="result-notice">Kết quả tham khảo. Kết quả ngoài phạm vi Train không đủ cơ sở kết luận.</p>}
        <dl className="result-scores"><div><dt>Điểm mô hình</dt><dd>{result.model_score_percent}%</dd></div><div><dt>Ngưỡng đã lưu</dt><dd>{result.display_threshold_percent}%</dd></div></dl>
        {compare && !hideTruth && <section aria-label="Đối chiếu nhãn Test" className="result-truth">
          <h3>Mẫu Test UDI {compare.id}</h3><p>Nhãn thật · {compare.label ? 'Có hỏng' : 'Bình thường'}</p>
          <p><strong>{compare.outcome}</strong> · {({TP:'Nhận đúng mẫu hỏng',TN:'Nhận đúng mẫu bình thường',FP:'Báo nhầm mẫu bình thường',FN:'Bỏ sót mẫu hỏng'})[compare.outcome]}</p>
        </section>}
      </div>
      <Machine3DViewer className="result-machine" status={result.is_failure ? 'failure' : 'normal'} height="h-40" caption="Mô hình thiết bị minh họa" />
    </div>
    <ThresholdBar className="result-scale" score={result.model_score} scorePercent={result.model_score_percent} exactThreshold={result.exact_threshold} displayThresholdPercent={result.display_threshold_percent} isFailure={result.is_failure} />
    <div className="result-explanations">
      <ShapWaterfall contributions={result.top_contributions} />
      <InspectionSuggestions suggestions={result.suggestions} isFailure={result.is_failure} />
    </div>
    <details open={rangeOpen} onToggle={event => setRangeOpen(event.currentTarget.open)}>
      <summary>Đối chiếu dải Train{outside ? ' · Có thông số ngoài dải' : ''}</summary>
      <p>Dải quan sát Train dùng đối chiếu dữ liệu, không phải giới hạn vận hành an toàn.</p>
      <div className="overflow-x-auto"><table className="compact-range"><thead><tr>{['Thông số', 'Giá trị đã dùng', 'Min', 'P05–P95', 'Trung vị', 'Max'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>
        {result.range_checks.map(item => <tr key={item.column} className={item.is_out_of_range ? 'text-amber-800' : ''}><th scope="row">{item.column_vn}{item.is_out_of_range && <span className="block">Ngoài dải Train</span>}</th><td>{item.value}</td><td>{item.train_min}</td><td>{item.train_p05}–{item.train_p95}</td><td>{item.train_median}</td><td>{item.train_max}</td></tr>)}
      </tbody></table></div>
    </details>
    <details><summary>Thông số đã dùng cho lần dự đoán này</summary><dl className="used-inputs"><div><dt>Type</dt><dd>{result.inputs.Type}</dd></div>{sensorFields.map(f => <div key={f.key}><dt>{f.label}</dt><dd>{result.inputs[f.key]} {f.unit}</dd></div>)}</dl></details>
    {onKeep && <div className="flex flex-wrap gap-2"><button className="app-button" type="button" disabled={baseline === result} onClick={onKeep}>{baseline === result ? 'Đã giữ kết quả' : 'Giữ kết quả này'}</button></div>}
    {baseline && onClear && <details><summary>So sánh với kết quả đã giữ</summary><PredictionComparison baseline={baseline} current={result} onClear={onClear} /></details>}
  </article>;
}
