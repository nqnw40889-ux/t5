import type { PredictionInputs, PredictionResult } from '../types';

export const sensorFields = [
  { key: 'Air temperature [K]', label: 'Nhiệt độ không khí', unit: 'K', min: 295.3, max: 304.5, step: 0.1 },
  { key: 'Process temperature [K]', label: 'Nhiệt độ quy trình', unit: 'K', min: 305.7, max: 313.8, step: 0.1 },
  { key: 'Rotational speed [rpm]', label: 'Tốc độ quay', unit: 'rpm', min: 1168, max: 2886, step: 1 },
  { key: 'Torque [Nm]', label: 'Mô-men xoắn', unit: 'Nm', min: 3.8, max: 76.6, step: 0.1 },
  { key: 'Tool wear [min]', label: 'Độ mòn dao', unit: 'min', min: 0, max: 253, step: 1 },
] as const;

export type PredictionDraft = { Type: PredictionInputs['Type'] } & Record<typeof sensorFields[number]['key'], number | string>;

export const formatNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 });

export function PredictionComparison({ baseline, current, onClear }: {
  baseline: PredictionResult;
  current: PredictionResult;
  onClear: () => void;
}) {
  const delta = (current.model_score - baseline.model_score) * 100;
  const deltaFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4, signDisplay: 'exceptZero' });
  const fields = [{ key: 'Type', label: 'Mức chất lượng', unit: '' }, ...sensorFields] as const;
  return (
    <section aria-labelledby="compare-title" className="space-y-4 rounded-xl border border-teal-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="compare-title" className="font-bold text-slate-900">So sánh với kết quả đã giữ</h3>
          <p className="mt-1 text-sm text-slate-600">
            {baseline === current
              ? 'Kết quả đã được giữ. Thay đổi thông số rồi chạy dự đoán để so sánh.'
              : `Điểm mô hình thay đổi ${deltaFormat.format(delta)} điểm phần trăm.`}
          </p>
        </div>
        <button type="button" onClick={onClear} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Bỏ kết quả đã giữ</button>
      </div>
      {baseline !== current && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead><tr className="border-b border-slate-200"><th scope="col" className="p-2">Chỉ số</th><th scope="col" className="p-2">Đã giữ</th><th scope="col" className="p-2">Mới nhất</th></tr></thead>
            <tbody>
              <tr className="border-b border-slate-200"><th scope="row" className="p-2">Điểm mô hình</th>{[baseline, current].map((item, i) => <td key={i} className="p-2">{formatNumber.format(item.model_score_percent)}%</td>)}</tr>
              <tr className="border-b border-slate-200"><th scope="row" className="p-2">Trạng thái tại ngưỡng đã lưu</th>{[baseline, current].map((item, i) => <td key={i} className="p-2">{item.status_label} <span className="block text-xs text-slate-600">Ngưỡng {formatNumber.format(item.display_threshold_percent)}%</span></td>)}</tr>
              <tr className="border-b border-slate-200"><th scope="row" className="p-2">Ngoài dải huấn luyện</th>{[baseline, current].map((item, i) => <td key={i} className="p-2">{item.out_of_range_warnings.length ? item.range_checks.filter(check => check.is_out_of_range).map(check => check.column_vn).join(', ') || `${item.out_of_range_warnings.length} cảnh báo` : 'Không có'}</td>)}</tr>
              {fields.map(({ key, label, unit }) => {
                const changed = baseline.inputs[key] !== current.inputs[key];
                return (
                  <tr key={key} className={changed ? 'bg-teal-50' : ''}>
                    <th scope="row" className="p-2 font-medium">{label}{unit && ` (${unit})`}{changed && <span className="ml-2 text-xs font-semibold text-teal-800">Đã đổi</span>}</th>
                    <td className="p-2">{baseline.inputs[key]}</td><td className="p-2">{current.inputs[key]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
