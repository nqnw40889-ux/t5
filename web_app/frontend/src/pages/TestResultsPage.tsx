import { TrainValidationChart } from '../components/TrainValidationChart';
import React, { useEffect, useState } from 'react';
import { 
  BarChart3, CheckCircle2, AlertTriangle, ShieldCheck, Database, 
  ExternalLink, Image as ImageIcon, Filter, Search, Info, RefreshCw 
} from 'lucide-react';
import { TestResultsResponse, ConfigurationItem, MisclassificationItem } from '../types';

import { ValidationThresholdChart } from '../components/ValidationThresholdChart';
import { MisclassificationDialog } from '../components/MisclassificationDialog';

export const TestResultsPage: React.FC<{ section?: 'validation' | 'missed' }> = ({ section }) => {
  const [data, setData] = useState<TestResultsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for 40 configs
  const [expanded, setExpanded] = useState(false);
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  // Filter for misclassifications
  const [misclassFilter, setMisclassFilter] = useState<'all' | 'fp' | 'fn'>(section === 'missed' ? 'fn' : 'all');

  const [activeCase, setActiveCase] = useState<MisclassificationItem | null>(null);

  // Image Modal / Toggle
  const [showFigure, setShowFigure] = useState<'none' | 'pr'>('none');

  useEffect(() => {
    fetch('/api/test-results')
      .then(res => {
        if (!res.ok) throw new Error('Không thể tải dữ liệu kiểm thử từ máy chủ.');
        return res.json();
      })
      .then(resData => {
        setData(resData);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (data && section) {
      const target = document.getElementById(section);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'start' });
    }
  }, [data, section]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
        <p className="text-sm font-medium">Đang nạp số liệu thực nghiệm từ ket_qua/thuc_nghiem/...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl border border-red-200 bg-red-50 text-red-800">
        <p className="font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Lỗi nạp dữ liệu kiểm thử: {error}
        </p>
      </div>
    );
  }

  const { winner_test, confusion_matrix, pr_curve, configurations, misclassifications } = data;

  // Filter configurations
  const filteredConfigs = configurations.filter(c => {
    if (modelFilter !== 'all' && c.model !== modelFilter) return false;
    if (methodFilter !== 'all' && c.method !== methodFilter) return false;
    return true;
  });

  // Filter misclassifications
  const filteredMisclass = misclassifications.filter(m => {
    if (misclassFilter === 'fp') return m.du_doan_hong === 1 && m['Machine failure'] === 0;
    if (misclassFilter === 'fn') return m.du_doan_hong === 0 && m['Machine failure'] === 1;
    return true;
  });

  const topComparisons = [...filteredConfigs].filter(c => !c.selected).sort((a,b) => b.val_ap-a.val_ap).slice(0,4);
  const shownConfigs = expanded ? filteredConfigs : filteredConfigs.filter(c => c.selected || topComparisons.includes(c));

  return (
    <div className="space-y-8 pb-16">
      {/* Header & Integrity Notice */}
      <div className="border-b border-slate-200 pb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-mono font-medium mb-2 border border-teal-200">
          <Database className="w-3.5 h-3.5" />
          <span>Tập Test đã lưu ({data.dataset_info.total_test_samples.toLocaleString("vi-VN")} mẫu)</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Kết quả kiểm định & Đánh giá mô hình
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
          Toàn bộ các chỉ số, ma trận nhầm lẫn và đường Precision–Recall dưới đây được đọc trực tiếp từ các tệp thực nghiệm đã lưu 
          tại <code className="text-teal-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">ket_qua/thuc_nghiem/</code>. 
          Không sử dụng số liệu tự tạo hay huấn luyện lại.
        </p>
      </div>

      {/* Metric Cards Row */}
      <div className="watt-test-kpis grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Precision */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Precision (Độ chính xác)</span>
          <span className="text-2xl sm:text-3xl font-extrabold font-mono text-teal-600 mt-1 block">
            {(winner_test.precision * 100).toFixed(2)}%
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">{confusion_matrix.tp} đúng hỏng / {confusion_matrix.tp + confusion_matrix.fp} mẫu dự báo hỏng</span>
        </div>

        {/* Recall */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Recall (Độ bao phủ)</span>
          <span className="text-2xl sm:text-3xl font-extrabold font-mono text-sky-600 mt-1 block">
            {(winner_test.recall * 100).toFixed(2)}%
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">{confusion_matrix.tp} phát hiện / {confusion_matrix.tp + confusion_matrix.fn} mẫu hỏng thật</span>
        </div>

        {/* F1-Score */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">F1-Score</span>
          <span className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-600 mt-1 block">
            {(winner_test.f1 * 100).toFixed(2)}%
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Kết quả tại ngưỡng đã lưu</span>
        </div>

        {/* Average Precision */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Average Precision (AP)</span>
          <span className="text-2xl sm:text-3xl font-extrabold font-mono text-indigo-600 mt-1 block">
            {winner_test.ap.toFixed(4)}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">AP trên tập Test đã lưu</span>
        </div>
      </div>



      {/* Confusion Matrix and PR Curve Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Confusion Matrix (Left) */}
        <div className="lg:col-span-6 min-w-0 p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Ma trận nhầm lẫn trên Test</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Tập Test đã lưu ({data.dataset_info.total_test_samples.toLocaleString("vi-VN")} mẫu)</p>
            </div>

            <a
              href="/figures/ma_tran_nham_lan_test_moi.png"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2.5 rounded-lg border border-slate-300 font-semibold transition-colors"
              aria-label="Mở ảnh ma trận nhầm lẫn đầy đủ trong thẻ mới"
            >
              <ImageIcon className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
              <span>Mở ảnh đầy đủ</span>
            </a>
          </div>

          <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <img
              src="/figures/ma_tran_nham_lan_test_moi.png"
              alt={`Ma trận nhầm lẫn tập Test: TN ${confusion_matrix.tn}, FP ${confusion_matrix.fp}, FN ${confusion_matrix.fn}, TP ${confusion_matrix.tp}. Trục ngang là nhãn dự đoán, trục dọc là nhãn thực tế.`}
              width={3960}
              height={2952}
              className="block h-auto w-full max-w-full"
            />
          </figure>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>
              Tại ngưỡng <strong>{(winner_test.threshold * 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%</strong>, mô hình nhận đúng {confusion_matrix.tp} mẫu hỏng, bỏ sót {confusion_matrix.fn} mẫu hỏng và báo nhầm {confusion_matrix.fp} mẫu bình thường trên tập kiểm thử.
            </span>
          </div>
        </div>

        {/* Precision-Recall Curve (Right) */}
        <div className="lg:col-span-6 min-w-0 p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Đường Precision–Recall (Test)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">AP = 0,7900 • Đường cơ sở = 0,034</p>
            </div>

            <button
              onClick={() => setShowFigure(showFigure === 'pr' ? 'none' : 'pr')}
              className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 font-semibold transition-colors"
            >
              <ImageIcon className="w-3.5 h-3.5 text-sky-600" />
              <span>{showFigure === 'pr' ? 'Đóng ảnh gốc' : 'Xem ảnh gốc matplotlib'}</span>
            </button>
          </div>

          {showFigure === 'pr' ? (
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex justify-center">
              <img src="/api/figures/pr-curve" alt="Đường Precision-Recall" className="max-h-64 object-contain rounded" />
            </div>
          ) : (
            /* Interactive SVG PR Chart */
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 relative">
              <svg viewBox="0 0 400 220" className="w-full h-56">
                {/* Grid Lines */}
                <line x1="40" y1="20" x2="380" y2="20" stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <line x1="40" y1="65" x2="380" y2="65" stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <line x1="40" y1="110" x2="380" y2="110" stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <line x1="40" y1="155" x2="380" y2="155" stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <line x1="40" y1="200" x2="380" y2="200" stroke="var(--chart-axis)" strokeWidth="1.5" />
                <line x1="40" y1="20" x2="40" y2="200" stroke="var(--chart-axis)" strokeWidth="1.5" />

                {/* Y Axis Labels (Precision) */}
                <text x="35" y="24" fill="var(--app-muted)" fontSize="10" textAnchor="end">1.0</text>
                <text x="35" y="69" fill="var(--app-muted)" fontSize="10" textAnchor="end">0.75</text>
                <text x="35" y="114" fill="var(--app-muted)" fontSize="10" textAnchor="end">0.5</text>
                <text x="35" y="159" fill="var(--app-muted)" fontSize="10" textAnchor="end">0.25</text>
                <text x="35" y="200" fill="var(--app-muted)" fontSize="10" textAnchor="end">0.0</text>

                {/* X Axis Labels (Recall) */}
                <text x="40" y="214" fill="var(--app-muted)" fontSize="10" textAnchor="middle">0.0</text>
                <text x="125" y="214" fill="var(--app-muted)" fontSize="10" textAnchor="middle">0.25</text>
                <text x="210" y="214" fill="var(--app-muted)" fontSize="10" textAnchor="middle">0.5</text>
                <text x="295" y="214" fill="var(--app-muted)" fontSize="10" textAnchor="middle">0.75</text>
                <text x="380" y="214" fill="var(--app-muted)" fontSize="10" textAnchor="middle">1.0</text>

                {/* Baseline 0.034 horizontal dashed line */}
                <line 
                  x1="40" 
                  y1={200 - (0.034 * 180)} 
                  x2="380" 
                  y2={200 - (0.034 * 180)} 
                  stroke="var(--chart-warning)" 
                  strokeDasharray="4 4" 
                  strokeWidth="1.2" 
                />
                <text x="375" y={195 - (0.034 * 180)} fill="var(--chart-warning)" fontSize="9" textAnchor="end" fontWeight="bold">Tỷ lệ mẫu hỏng (3,4%)</text>

                {/* PR Curve Line */}
                <polyline
                  fill="none"
                  stroke="var(--chart-precision)"
                  strokeWidth="2.5"
                  points={pr_curve.map(pt => `${40 + pt.recall * 340},${200 - pt.precision * 180}`).join(' ')}
                />

                {/* Operating Point (Threshold = 31.54%) */}
                <circle 
                  cx={40 + winner_test.recall * 340} 
                  cy={200 - winner_test.precision * 180} 
                  r="5" 
                  fill="#f59e0b" 
                  stroke="#ffffff" 
                  strokeWidth="2" 
                />
              </svg>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-600 px-1">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-3 h-3 rounded-full bg-teal-600 inline-block"></span>
              Đường Precision–Recall LightGBM
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              Điểm vận hành tại ngưỡng đã lưu
            </span>
          </div>
        </div>
      </div>

      <div id="validation" tabIndex={-1} className="scroll-mt-24"><ValidationThresholdChart /></div>
      {/* Section: Comparison of 40 Experimental Configurations */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Bảng so sánh 40 cấu hình thực nghiệm</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Nạp từ <code className="text-teal-700 font-mono bg-slate-100 px-1 py-0.5 rounded">so_sanh_40_cau_hinh.csv</code> • 36 cấu hình chính và 4 cấu hình đối chứng chỉ dùng biến số
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 font-medium">Mô hình:</span>
              <select aria-label="Họ mô hình"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="bg-transparent text-slate-800 font-semibold focus:outline-none"
              >
                <option value="all">Tất cả (4 họ)</option>
                <option value="LightGBM">LightGBM</option>
                <option value="XGBoost">XGBoost</option>
                <option value="Random Forest">Random Forest</option>
                <option value="Logistic Regression">Logistic Regression</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 font-medium">Chiến lược:</span>
              <select aria-label="Chiến lược"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="bg-transparent text-slate-800 font-semibold focus:outline-none"
              >
                <option value="all">Tất cả</option>
                <option value="baseline">Baseline (Nguyên bản)</option>
                <option value="class_weight">Class Weight (Trọng số)</option>
                <option value="numeric_baseline">Đối chứng biến số</option><option value="smote_numeric">SMOTE biến số</option><option value="smotenc_25">SMOTENC (thiểu số/đa số = 0,25)</option>
              </select>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-600">Bản thu gọn hiển thị cấu hình được chọn nếu khớp bộ lọc và tối đa 4 cấu hình còn lại có Validation AP cao nhất trong bộ lọc. Cột Gap gốc = Train AP − CV AP.</p>
        <button type="button" className="app-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Thu gọn' : 'Xem toàn bộ 40 cấu hình'}</button>
        <p role="status">{shownConfigs.length} / {filteredConfigs.length} cấu hình phù hợp</p>
        <TrainValidationChart configurations={shownConfigs} />
        {/* Table of 40 Configs */}
        <div className="overflow-x-auto max-h-80 border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200 z-10">
              <tr>
                <th className="p-2.5">Trạng thái</th>
                <th className="p-2.5">Mô hình</th>
                <th className="p-2.5">Profile</th>
                <th className="p-2.5">Chiến lược</th>
                <th className="p-2.5">CV AP</th>
                <th className="p-2.5">Val AP</th>
                <th className="p-2.5">Chênh lệch Gap</th>
                <th className="p-2.5">Ngưỡng</th>
                <th className="p-2.5">Val F1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
              {shownConfigs.map((c, i) => (
                <tr 
                  key={i}
                  className={`hover:bg-slate-50 transition-colors ${
                    c.selected ? 'bg-emerald-50 text-emerald-950 font-bold ring-1 ring-inset ring-emerald-500/50' : ''
                  }`}
                >
                  <td className="p-2.5">
                    {c.selected ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-600 text-white font-extrabold uppercase font-sans">
                        ★ Chọn lựa
                      </span>
                    ) : (
                      <span className="text-slate-400 font-sans text-[11px]">Thực nghiệm</span>
                    )}
                  </td>
                  <td className="p-2.5 font-bold text-slate-900">{c.model}</td>
                  <td className="p-2.5">{c.profile}</td>
                  <td className="p-2.5 font-sans">{c.method}</td>
                  <td className="p-2.5 font-bold text-slate-900">{c.cv_ap.toFixed(4)}</td>
                  <td className="p-2.5">{c.val_ap ? c.val_ap.toFixed(4) : '-'}</td>
                  <td className="p-2.5">{c.gap ? c.gap.toFixed(4) : '-'}</td>
                  <td className="p-2.5 font-mono">{c.threshold ? (c.threshold * 100).toFixed(2) + '%' : '-'}</td>
                  <td className="p-2.5 font-bold">{c.val_f1 ? (c.val_f1 * 100).toFixed(2) + '%' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section: Analysis of 24 Misclassified Test Samples */}
      <p className="text-sm text-slate-600">sampling_strategy=0.25 là tỷ lệ số mẫu lớp thiểu số trên lớp đa số sau tăng mẫu.</p>
      <div id="missed" tabIndex={-1} className="scroll-mt-24 p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Phân tích 24 ca dự đoán sai trên tập Test</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Đọc từ <code className="text-teal-700 font-mono bg-slate-100 px-1 py-0.5 rounded">du_doan_sai.csv</code> • Gồm 12 ca Báo nhầm (FP) và 12 ca Bỏ sót (FN)
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setMisclassFilter('all')}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                misclassFilter === 'all' 
                  ? 'bg-slate-900 text-white font-bold border-slate-900' 
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              Tất cả (24)
            </button>
            <button
              onClick={() => setMisclassFilter('fp')}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                misclassFilter === 'fp' 
                  ? 'bg-amber-100 text-amber-900 font-bold border-amber-300' 
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              12 Báo nhầm (FP)
            </button>
            <button
              onClick={() => setMisclassFilter('fn')}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                misclassFilter === 'fn' 
                  ? 'bg-red-100 text-red-900 font-bold border-red-300' 
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              12 Bỏ sót (FN)
            </button>
          </div>
        </div>

        {/* Misclassification Table */}
        <div className="overflow-x-auto max-h-80 border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200 z-10">
              <tr>
                <th className="p-2.5">UDI</th>
                <th className="p-2.5">TreeSHAP</th>
                <th className="p-2.5">Phân loại lỗi</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">T_Air [K]</th>
                <th className="p-2.5">T_Proc [K]</th>
                <th className="p-2.5">Speed [rpm]</th>
                <th className="p-2.5">Torque [Nm]</th>
                <th className="p-2.5">Wear [min]</th>
                <th className="p-2.5">Điểm mô hình</th>
                <th className="p-2.5">Dạng hỏng vật lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
              {filteredMisclass.map((m) => {
                const isFP = m.du_doan_hong === 1 && m['Machine failure'] === 0;
                // Identify failure cause tag
                const failureModes = [];
                if (m.TWF === 1) failureModes.push('TWF (Mòn dao)');
                if (m.HDF === 1) failureModes.push('HDF (Tản nhiệt)');
                if (m.PWF === 1) failureModes.push('PWF (Công suất)');
                if (m.OSF === 1) failureModes.push('OSF (Quá tải)');
                if (m.RNF === 1) failureModes.push('RNF (Ngẫu nhiên)');

                return (
                  <tr key={m.UDI} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-bold text-slate-500">#{m.UDI}</td>
                    <td className="p-2.5 font-sans">
                      <button type="button" onClick={() => setActiveCase(m)} aria-haspopup="dialog"
                        aria-label={`Xem giải thích ca #${m.UDI}`}
                        className="whitespace-nowrap rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50">
                        Xem giải thích
                      </button>
                    </td>
                    <td className="p-2.5 font-sans">
                      {isFP ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Báo nhầm (FP)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                          Bỏ sót (FN)
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 font-bold">{m.Type}</td>
                    <td className="p-2.5">{m['Air temperature [K]']}</td>
                    <td className="p-2.5">{m['Process temperature [K]']}</td>
                    <td className="p-2.5">{m['Rotational speed [rpm]']}</td>
                    <td className="p-2.5">{m['Torque [Nm]']}</td>
                    <td className="p-2.5">{m['Tool wear [min]']}</td>
                    <td className="p-2.5 font-bold">
                      <span className={isFP ? 'text-amber-700 font-bold' : 'text-red-700 font-bold'}>
                        {(m.diem_hong * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-2.5 font-sans text-[11px] text-slate-600">
                      {failureModes.length > 0 ? failureModes.join(', ') : 'Không có nhãn hỏng (Thật sự bình thường)'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {activeCase && (
        <MisclassificationDialog key={activeCase.UDI} sample={activeCase} threshold={data.winner_model.threshold} onClose={() => setActiveCase(null)} />
      )}
    </div>
  );
};
