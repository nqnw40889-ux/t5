import React from 'react';
import { ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { SHAPContribution } from '../types';

interface ShapWaterfallProps {
  contributions: SHAPContribution[];
}

export const ShapWaterfall: React.FC<ShapWaterfallProps> = ({ contributions }) => {
  if (!contributions || contributions.length === 0) return null;

  const maxAbs = Math.max(...contributions.map((c) => c.abs_contribution), 0.1);

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span>Top 3 yếu tố đóng góp nhiều nhất theo TreeSHAP</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            TreeSHAP giải thích đóng góp vào điểm mô hình của mẫu hiện tại, không chứng minh nguyên nhân hoặc bộ phận hỏng.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 font-medium">
          <Info className="w-3.5 h-3.5 text-teal-600" />
          <span>TreeSHAP cục bộ (Log-odds)</span>
        </div>
      </div>

      <div className="space-y-3">
        {contributions.map((item, idx) => {
          const isPositive = item.contribution > 0;
          const barWidthPct = Math.min(100, Math.max(15, (item.abs_contribution / maxAbs) * 100));

          return (
            <div 
              key={idx}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-800 font-mono text-[11px] flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {item.column_vn}
                  </span>
                  <span className="text-slate-600 font-mono text-[11px]">
                    (Giá trị: <strong className="text-slate-900 font-semibold">{item.value}</strong>)
                  </span>
                </div>

                {/* Direction Tag */}
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                    isPositive 
                      ? 'bg-red-50 text-red-700 border-red-200' 
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    {isPositive ? (
                      <>
                        <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
                        <span>Góp phần tăng điểm mô hình</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Góp phần giảm điểm mô hình</span>
                      </>
                    )}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {item.contribution > 0 ? `+${item.contribution.toFixed(4)}` : item.contribution.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Proportional Contribution Bar */}
              <div className="relative h-2.5 rounded-full bg-slate-200 overflow-hidden">
                <div 
                  style={{ width: `${barWidthPct}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    isPositive 
                      ? 'bg-gradient-to-r from-amber-500 to-red-600' 
                      : 'bg-gradient-to-r from-teal-500 to-emerald-600'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 pt-1 text-right italic">
        * Đây là mức đóng góp vào dự đoán của mô hình LightGBM cho riêng mẫu này, không phải độ quan trọng trung bình toàn cục.
      </p>
    </div>
  );
};
