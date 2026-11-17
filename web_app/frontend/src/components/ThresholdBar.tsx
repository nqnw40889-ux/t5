import React from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

interface ThresholdBarProps {
  score: number; // 0 to 1
  scorePercent: number; // e.g. 12.34
  exactThreshold: number; // 0.31537755439431603
  displayThresholdPercent: number; // 31.54
  isFailure: boolean;
  className?: string;
}

export const ThresholdBar: React.FC<ThresholdBarProps> = ({
  score,
  exactThreshold,
  scorePercent,
  displayThresholdPercent,
  isFailure,
  className = '',
}) => {
  const thresholdPct = exactThreshold * 100;
  const pinPositionPct = Math.max(0, Math.min(100, score * 100));

  return (
    <div className={`p-4 rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-600 font-bold">
            Thang điểm mô hình & Vạch ngưỡng phân loại
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-600 font-medium">Ngưỡng quyết định:</span>
            <span className="font-mono font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
              {displayThresholdPercent}%
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-600 font-medium">Điểm mô hình:</span>
            <span className={`font-mono font-bold px-2.5 py-0.5 rounded border text-sm ${
              isFailure 
                ? 'text-red-700 bg-red-50 border-red-300' 
                : 'text-emerald-700 bg-emerald-50 border-emerald-300'
            }`}>
              {scorePercent.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Bar Track */}
      <div className="relative pt-6 pb-2">
        {/* Track Container */}
        <div className="h-4 rounded-full overflow-hidden flex bg-slate-200 border border-slate-300 relative shadow-inner">
          {/* Below Threshold Zone (0 to threshold) */}
          <div 
            style={{ width: `${thresholdPct}%` }}
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 relative group"
            title={`Dưới ngưỡng: [0% - ${thresholdPct}%)`}
          />

          {/* Above Threshold Zone (threshold to 100%) */}
          <div 
            style={{ width: `${100 - thresholdPct}%` }}
            className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 relative group"
            title={`Từ ngưỡng trở lên: [${thresholdPct}% - 100%]`}
          />
        </div>

        {/* Threshold Line & Top Badge */}
        <div 
          style={{ left: `${thresholdPct}%` }}
          className="absolute top-2 bottom-0 w-0.5 bg-slate-900 shadow-md z-20 pointer-events-none"
        >
          {/* Top Label */}
          <div className="absolute -top-5 -translate-x-1/2 flex flex-col items-center">
            <span className="text-[10px] font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-400 shadow-sm whitespace-nowrap">
              Ngưỡng {displayThresholdPercent}%
            </span>
            <div className="w-1.5 h-1.5 rotate-45 bg-slate-900 -mt-0.5"></div>
          </div>
        </div>

        {/* Model Score Pin Indicator */}
        <div 
          style={{ left: `${pinPositionPct}%` }}
          className="absolute top-5 -translate-x-1/2 z-30 transition-all duration-500 flex flex-col items-center pointer-events-none"
        >
          {/* Indicator Marker Pin */}
          <div className={`w-3.5 h-3.5 rounded-full border-2 shadow-md ${
            isFailure 
              ? 'bg-red-600 border-white ring-2 ring-red-300' 
              : 'bg-emerald-600 border-white ring-2 ring-emerald-300'
          }`} />
          {/* Bottom Value Label */}
          <div className={`mt-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold whitespace-nowrap shadow border ${
            isFailure
              ? 'bg-red-600 text-white border-red-700'
              : 'bg-emerald-700 text-white border-emerald-800'
          }`}>
            ▲ {scorePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Explanatory Zone Legend */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 mt-6 pt-2.5 border-t border-slate-200">
        <div className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Dưới ngưỡng (0% → &lt; {displayThresholdPercent}%): Dự đoán Bình thường</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span>Từ ngưỡng trở lên (≥ {displayThresholdPercent}% → 100%): Dự đoán Cảnh báo hỏng</span>
        </div>
      </div>
    </div>
  );
};
