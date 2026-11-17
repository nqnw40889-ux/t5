import { useEffect, useId, useState } from 'react';

type ValidationPoint = { threshold: number; precision: number; recall: number; f1: number };
type ValidationSweep = { exact_threshold: number; display_threshold_percent: number; points: ValidationPoint[] };

const metrics = [
  { key: 'precision', label: 'Precision', color: 'var(--chart-precision)', dash: undefined },
  { key: 'recall', label: 'Recall', color: 'var(--chart-recall)', dash: '6 4' },
  { key: 'f1', label: 'F1', color: 'var(--chart-f1)', dash: undefined },
] as const;

const percent = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '%';
const ticks = [0, 0.25, 0.5, 0.75, 1];
const x = (value: number) => 46 + value * 620;
const y = (value: number) => 212 - value * 190;

export function ValidationThresholdChart() {
  const [data, setData] = useState<ValidationSweep | null>(null);
  const [failed, setFailed] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/validation-thresholds', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Validation sweep unavailable');
        return response.json() as Promise<ValidationSweep>;
      })
      .then(setData)
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);

  const selected = data?.points.find(point => point.threshold === data.exact_threshold);

  return (
    <section aria-labelledby={titleId} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">Chọn ngưỡng trên tập Validation</h2>
        <p id={descriptionId} className="mt-1 text-sm text-slate-600">
          Precision, Recall và F1 theo các ngưỡng đã thử trên Validation. Vạch đứng đánh dấu ngưỡng quyết định đã lưu.
        </p>
      </div>

      {!data ? (
        <p role={failed ? 'alert' : 'status'} className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          {failed ? 'Không tải được kết quả quét ngưỡng. Hãy tải lại trang để thử lại.' : 'Đang tải kết quả quét ngưỡng…'}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">
              Ngưỡng đã lưu {percent(data.display_threshold_percent)}
            </span>
            {metrics.map(({ key, label, color, dash }) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <svg width="20" height="6" aria-hidden="true"><line y1="3" y2="3" x2="20" stroke={color} strokeWidth="2" strokeDasharray={dash} /></svg>
                <span className="text-slate-600">{label}</span>
                {selected && <strong className="font-mono text-slate-900">{percent(selected[key] * 100)}</strong>}
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-4">
            <svg viewBox="0 0 688 254" className="mx-auto block w-full max-w-4xl" role="img" aria-labelledby={titleId} aria-describedby={descriptionId}>
              {ticks.map(tick => (
                <g key={tick}>
                  <line x1={x(0)} x2={x(1)} y1={y(tick)} y2={y(tick)} stroke="var(--chart-grid)" />
                  <text x="39" y={y(tick) + 4} textAnchor="end" fontSize="12" fill="var(--app-muted)">{tick * 100}%</text>
                  <text x={x(tick)} y="230" textAnchor="middle" fontSize="12" fill="var(--app-muted)">{tick * 100}%</text>
                </g>
              ))}
              {metrics.map(({ key, color, dash }) => (
                <polyline key={key} fill="none" stroke={color} strokeWidth={key === 'f1' ? 2.5 : 1.8} strokeDasharray={dash}
                  points={data.points.map(point => `${x(point.threshold).toFixed(2)},${y(point[key]).toFixed(2)}`).join(' ')} />
              ))}
              <line x1={x(data.exact_threshold)} x2={x(data.exact_threshold)} y1={y(0)} y2={y(1)} stroke="var(--chart-axis)" strokeDasharray="4 4" />
              <text x={x(data.exact_threshold)} y="14" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--app-ink)">{percent(data.display_threshold_percent)}</text>
              {selected && <circle cx={x(selected.threshold)} cy={y(selected.f1)} r="4" fill="var(--chart-f1)" stroke="#fff" strokeWidth="1.5" />}
              <text x={x(0.5)} y="250" textAnchor="middle" fontSize="12" fill="var(--app-muted)">Ngưỡng quyết định</text>
            </svg>
          </div>
          {selected && <p className="text-sm text-slate-600">F1 đạt {percent(selected.f1 * 100)} tại ngưỡng đã chọn trên Validation.</p>}
        </>
      )}
    </section>
  );
}
