import { useEffect, useId, useRef, useState } from 'react';
import { MisclassificationItem, PredictionResult } from '../types';
import { ShapWaterfall } from './ShapWaterfall';
import { ThresholdBar } from './ThresholdBar';

interface Props {
  sample: MisclassificationItem;
  threshold: number;
  onClose: () => void;
}

const formatPercent = (score: number) => (score * 100).toLocaleString('vi-VN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}) + '%';

export function MisclassificationDialog({ sample, threshold, onClose }: Props) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState(false);
  const isFalsePositive = sample.du_doan_hong === 1;
  const margin = (sample.diem_hong - threshold) * 100;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const inputs = {
      Type: sample.Type,
      'Air temperature [K]': sample['Air temperature [K]'],
      'Process temperature [K]': sample['Process temperature [K]'],
      'Rotational speed [rpm]': sample['Rotational speed [rpm]'],
      'Torque [Nm]': sample['Torque [Nm]'],
      'Tool wear [min]': sample['Tool wear [min]'],
    };
    fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
      signal: controller.signal,
    }).then(response => {
      if (!response.ok) throw new Error('TreeSHAP unavailable');
      return response.json() as Promise<PredictionResult>;
    }).then(setResult).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [sample]);

  const facts = [
    { label: 'Nhãn thực tế', value: sample['Machine failure'] === 1 ? 'Có hỏng' : 'Bình thường' },
    { label: 'Dự đoán trên tập Test', value: sample.du_doan_hong === 1 ? 'Cảnh báo hỏng' : 'Bình thường' },
    { label: 'Điểm mô hình đã lưu', value: formatPercent(sample.diem_hong) },
  ];

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby={titleId}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl backdrop:bg-slate-950/50">
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${isFalsePositive ? 'text-amber-800' : 'text-red-800'}`}>
              {isFalsePositive ? 'Báo nhầm (FP)' : 'Bỏ sót (FN)'}
            </p>
            <h2 id={titleId} className="text-xl font-semibold">Chi tiết ca Test #{sample.UDI}</h2>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50">Đóng</button>
        </div>

        <dl className="grid gap-2 sm:grid-cols-3">
          {facts.map(fact => (
            <div key={fact.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <dt className="text-xs text-slate-600">{fact.label}</dt>
              <dd className="mt-1 font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <ThresholdBar score={sample.diem_hong} scorePercent={Number((sample.diem_hong * 100).toFixed(2))}
          exactThreshold={threshold} displayThresholdPercent={Number((threshold * 100).toFixed(2))} isFailure={sample.du_doan_hong === 1} />
        <p className="text-sm text-slate-700">
          Chênh lệch so với ngưỡng {margin.toLocaleString('vi-VN', { maximumFractionDigits: 4, signDisplay: 'exceptZero' })} điểm phần trăm.
        </p>

        {result ? (
          result.is_failure === (sample.du_doan_hong === 1) && Math.abs(result.model_score - sample.diem_hong) < 1e-8 ? (
            result.top_contributions.length > 0 ? (
              <ShapWaterfall contributions={result.top_contributions} />
            ) : (
              <p role="status" className="text-sm text-slate-600">Mô hình chưa trả về đóng góp TreeSHAP cho ca này.</p>
            )
          ) : (
            <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Kết quả chạy lại khác bản ghi Test. Hãy kiểm tra trước khi dùng TreeSHAP cho ca này.
            </p>
          )
        ) : (
          <p role={error ? 'alert' : 'status'} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {error ? 'Không tải được TreeSHAP. Hãy đóng và mở lại để thử lại.' : 'Đang tính TreeSHAP cho ca này…'}
          </p>
        )}
      </div>
    </dialog>
  );
}
