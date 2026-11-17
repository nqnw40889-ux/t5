import React from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { RangeCheckItem } from '../types';

interface RangeBarProps {
  rangeChecks: RangeCheckItem[];
  outOfRangeWarnings: string[];
}

export const RangeBar: React.FC<RangeBarProps> = ({ rangeChecks, outOfRangeWarnings }) => {
  const hasOutOfRange = outOfRangeWarnings.length > 0;

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span>Đối chiếu thông số với tập dữ liệu huấn luyện (Train)</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Dải giá trị quan sát tối thiểu, trung vị và tối đa được tính từ 7.000 mẫu Train đã lưu
          </p>
        </div>

        {hasOutOfRange ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1.5 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>{outOfRangeWarnings.length} thông số ngoài phạm vi Train</span>
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>100% thông số trong phạm vi Train</span>
          </span>
        )}
      </div>

      {/* Mandatory explicit out of range alert notice */}
      {hasOutOfRange && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Kết quả ngoài phạm vi Train không đủ cơ sở kết luận</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Mô hình học máy LightGBM được huấn luyện trong dải đo quy chuẩn. Khi thông số vượt ra ngoài phạm vi quan sát của tập Train, mô hình phải ngoại suy (extrapolation) và độ tin cậy bị suy giảm:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-amber-900 font-medium">
            {outOfRangeWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* List of 5 Numeric Feature Bars */}
      <div className="space-y-3.5">
        {rangeChecks.map((item) => {
          const isOut = item.is_out_of_range;
          const val = item.value;
          const min = item.train_min;
          const max = item.train_max;
          const median = item.train_median;
          
          // Percent positions for Train range representation
          const medianPct = ((median - min) / (max - min)) * 100;
          const q25Pct = ((item.train_p05 - min) / (max - min)) * 100;
          const q75Pct = ((item.train_p95 - min) / (max - min)) * 100;

          // Relative pin position (clamped 0 - 100% for display)
          let pinPct = ((val - min) / (max - min)) * 100;
          if (pinPct < 0) pinPct = 0;
          if (pinPct > 100) pinPct = 100;

          return (
            <div 
              key={item.column}
              className={`p-3 rounded-xl border transition-all ${
                isOut 
                  ? 'border-amber-300 bg-amber-50/50 shadow-sm' 
                  : 'border-slate-200 bg-slate-50/70'
              }`}
            >
              {/* Header: Name and values */}
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-800">
                  {item.column_vn}
                </span>

                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-500 font-sans text-[11px]">Giá trị vừa nhập:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-xs border ${
                    isOut
                      ? 'bg-amber-100 text-amber-950 border-amber-400'
                      : 'bg-white text-teal-800 border-slate-300'
                  }`}>
                    {val}
                  </span>
                  {isOut && (
                    <span className="text-[10px] text-amber-800 font-sans font-bold uppercase bg-amber-200/70 px-1.5 py-0.5 rounded">
                      Vượt dải Train
                    </span>
                  )}
                </div>
              </div>

              {/* Range Track */}
              <div className="relative h-3 rounded-full bg-slate-200 border border-slate-300 my-2">
                {/* 5% to 95% interquartile highlight band */}
                <div 
                  style={{ left: `${q25Pct}%`, width: `${Math.max(0, q75Pct - q25Pct)}%` }}
                  className="absolute top-0 bottom-0 bg-teal-200/60 border-x border-teal-400"
                  title="Dải 90% mẫu tập trung (P05 - P95)"
                />

                {/* Median marker dot */}
                <div 
                  style={{ left: `${medianPct}%` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-600 z-10"
                  title={`Trung vị Train: ${median}`}
                />

                {/* Sample Pin Indicator */}
                <div 
                  style={{ left: `${pinPct}%` }}
                  className="absolute -top-1.5 -translate-x-1/2 z-20 transition-all duration-500 flex flex-col items-center"
                >
                  <div className={`w-3.5 h-3.5 rounded-full border-2 shadow-sm ${
                    isOut 
                      ? 'bg-amber-600 border-white ring-2 ring-amber-300' 
                      : 'bg-teal-700 border-white ring-2 ring-teal-200'
                  }`} />
                </div>
              </div>

              {/* Bottom Labels: Min, Median, Max */}
              <div className="flex justify-between text-[10px] text-slate-500 font-mono font-medium">
                <span>Min: {min}</span>
                <span className="text-slate-600">Trung vị: {median}</span>
                <span>Max: {max}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
