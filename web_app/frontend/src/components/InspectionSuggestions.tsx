import React from 'react';
import { Wrench, ShieldAlert, CheckCircle2, Info } from 'lucide-react';

interface InspectionSuggestionsProps {
  suggestions: string[];
  isFailure: boolean;
}

export const InspectionSuggestions: React.FC<InspectionSuggestionsProps> = ({ suggestions, isFailure }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className={`p-4 sm:p-5 rounded-xl border shadow-sm transition-all ${
      isFailure 
        ? 'watt-alert border-red-200 bg-red-50/40' 
        : 'border-slate-200 bg-white'
    }`}>
      <div className="flex items-center gap-3 mb-3 border-b border-slate-200/80 pb-3">
        {isFailure ? (
          <div className="w-8 h-8 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-700 shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        )}
        <div>
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            {isFailure ? 'Gợi ý đối chiếu số đo & kiểm tra thông số liên quan' : 'Khuyến nghị giám sát vận hành'}
          </h4>
          <p className="text-xs text-slate-500">
            Hành động kiểm tra thực tế tại xưởng dựa trên các thông số vận hành của mẫu
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {suggestions.map((sug, idx) => (
          <div 
            key={idx}
            className={`p-3 rounded-lg border text-xs sm:text-sm flex items-start gap-2.5 ${
              isFailure 
                ? 'bg-white border-red-200 text-slate-800' 
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <span className="font-mono font-bold text-teal-700 text-xs mt-0.5 shrink-0">
              {idx + 1}.
            </span>
            <div className="flex-1 leading-relaxed">
              {sug}
            </div>
          </div>
        ))}
      </div>

      {isFailure && (
        <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-red-200">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-teal-600" />
          <span>
            <strong>Lưu ý kỹ thuật:</strong> Đây là các gợi ý kỹ thuật nhằm đối chiếu số đo cảm biến và kiểm tra tình trạng làm việc, không suy ra bộ phận hỏng chỉ từ hình minh họa hay điểm mô hình.
          </span>
        </div>
      )}
    </div>
  );
};
