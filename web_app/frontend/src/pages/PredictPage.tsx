import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Upload, Download, RefreshCw, AlertTriangle, CheckCircle2, 
  FileText, Database, HelpCircle, ChevronRight, ArrowDownToLine, Info, RotateCcw
} from 'lucide-react';
import { PredictionInputs, PredictionResult, CSVBatchResponse, CSVRowResult } from '../types';
import { PredictionComparison, sensorFields, formatNumber, type PredictionDraft } from '../components/PredictionComparison';
import { downloadCsv, downloadFile, type HistoryEntry } from '../reporting';
import { parseSensorValue, predictionError, readPredictionResponse, validateCsv } from '../predictionRequest';
import { Machine3DViewer } from '../components/Machine3DViewer';
import { ThresholdBar } from '../components/ThresholdBar';
import { RangeBar } from '../components/RangeBar';
import { ShapWaterfall } from '../components/ShapWaterfall';
import { InspectionSuggestions } from '../components/InspectionSuggestions';

const normalPreset: PredictionInputs = {
    Type: 'L',
    'Air temperature [K]': 298.2,
    'Process temperature [K]': 308.7,
    'Rotational speed [rpm]': 1530.0,
    'Torque [Nm]': 38.5,
    'Tool wear [min]': 45.0,
  };

const failurePreset: PredictionInputs = {
    Type: 'L',
    'Air temperature [K]': 302.4,
    'Process temperature [K]': 311.5,
    'Rotational speed [rpm]': 1280.0,
    'Torque [Nm]': 66.0,
    'Tool wear [min]': 218.0,
  };

interface Props {
  sample?: 'normal' | 'failure';
  onRecord: (entry: Omit<HistoryEntry, 'id' | 'time'>) => HistoryEntry;
  onReport: (entry: HistoryEntry) => void;
}

const manualSummary = (result: PredictionResult): Omit<HistoryEntry, 'id' | 'time'> => ({
  mode: 'manual', total: 1, failures: Number(result.is_failure), score: result.model_score_percent, result,
});

export const PredictPage: React.FC<Props> = ({ sample, onRecord, onReport }) => {
  const [tab, setTab] = useState<'manual' | 'csv'>('manual');

  // Form Inputs
  const [inputs, setInputs] = useState<PredictionDraft>(() => sample === 'failure' ? failurePreset : sample === 'normal' ? normalPreset : {
    Type: 'L',
    'Air temperature [K]': 300.0,
    'Process temperature [K]': 310.0,
    'Rotational speed [rpm]': 1500.0,
    'Torque [Nm]': 40.0,
    'Tool wear [min]': 100.0,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [manualReport, setManualReport] = useState<HistoryEntry | null>(null);
  const [sampleName, setSampleName] = useState(sample === 'failure' ? 'Mẫu cảnh báo' : sample === 'normal' ? 'Mẫu bình thường' : undefined);

  const [baseline, setBaseline] = useState<PredictionResult | null>(null);
  const [checked, setChecked] = useState(false);
  const invalidFields = sensorFields.filter(({ key }) => !Number.isFinite(parseSensorValue(inputs[key])));

  // CSV States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState<boolean>(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvBatch, setCsvBatch] = useState<CSVBatchResponse | null>(null);
  const [csvReport, setCsvReport] = useState<HistoryEntry | null>(null);
  const [csvFilter, setCsvFilter] = useState<'all' | 'failure' | 'normal'>('all');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [csvDetail, setCsvDetail] = useState<PredictionResult | null>(null);
  const [csvDetailStatus, setCsvDetailStatus] = useState<'loading' | 'error' | null>(null);
  const csvDetailRequest = useRef<AbortController | null>(null);
  useEffect(() => () => csvDetailRequest.current?.abort(), []);
  const [selectedCsvRow, setSelectedCsvRow] = useState<number | null>(null);

  // Ref for the result panel to enable smart auto-scrolling
  const resultRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect after prediction result appears
  const triggerAutoScroll = () => {
    setTimeout(() => {
      if (resultRef.current) {
        const rect = resultRef.current.getBoundingClientRect();
        const navOffset = 80; // Leave room so sticky header does not obscure title
        // Check if top of result is out of viewport (either scrolled above or below)
        const isOutOfView = rect.top < navOffset || rect.top > (window.innerHeight - 100);
        if (isOutOfView) {
          const targetY = window.pageYOffset + rect.top - navOffset;
          const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          window.scrollTo({
            top: Math.max(0, targetY),
            behavior: prefersReduced ? 'auto' : 'smooth',
          });
        }
      }
    }, 60);
  };

  // Sample Presets
  const applyPreset = (presetType: 'normal' | 'failure' | 'out_of_range') => {
    setErrorMsg(null);
    setChecked(false);
    setSampleName(presetType === 'normal' ? 'Mẫu bình thường' : presetType === 'failure' ? 'Mẫu cảnh báo' : 'Mẫu ngoài dải');
    if (presetType === 'normal') {
      setInputs(normalPreset);
    } else if (presetType === 'failure') {
      setInputs(failurePreset);
    } else if (presetType === 'out_of_range') {
      setInputs({
        Type: 'H',
        'Air temperature [K]': 306.0,   // Train max: 304.5 K
        'Process temperature [K]': 315.0, // Train max: 313.8 K
        'Rotational speed [rpm]': 3100.0, // Train max: 2886.0 rpm
        'Torque [Nm]': 82.0,           // Train max: 76.6 Nm
        'Tool wear [min]': 270.0,       // Train max: 253.0 min
      });
    }
  };

  // Submit Manual Prediction
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setChecked(true);
    setErrorMsg(null);
    if (invalidFields.length > 0) {
      document.getElementById(invalidFields[0].key.replace(/[^a-zA-Z]+/g, '-'))?.focus();
      return;
    }
    const payload = { ...inputs };
    sensorFields.forEach(({ key }) => { payload[key] = parseSensorValue(inputs[key]); });
    setLoading(true);
    try {
      const resp = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
      const data = await readPredictionResponse<PredictionResult>(resp, 'Máy chủ không thể hoàn tất lượt dự đoán. Hãy thử lại.');
      setResult(data);
      setManualReport(onRecord({ ...manualSummary(data), sampleName }));
      triggerAutoScroll();
    } catch (error) {
      setErrorMsg(predictionError(error, 'Không thể dự đoán. Hãy thử lại.'));
    } finally {
      setLoading(false);
    }
  };

  // Upload CSV Batch
  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (csvLoading) return;
    if (!csvFile) {
      setCsvError('Vui lòng chọn tệp CSV trước khi tải lên.');
      return;
    }
    setCsvLoading(true);
    setCsvError(null);
    setCsvBatch(null);
    setCsvReport(null);
    setSelectedCsvRow(null);
    csvDetailRequest.current?.abort();
    setCsvDetail(null);
    setCsvDetailStatus(null);
    setCsvFilter('all');
    setPriorityOnly(false);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      await validateCsv(csvFile);
      const resp = await fetch('/api/predict-csv', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60000),
      });
      const data = await readPredictionResponse<CSVBatchResponse>(resp, 'Không thể xử lý tệp CSV. Kiểm tra tệp rồi thử lại.');
      setCsvBatch(data);
      setCsvReport(onRecord({ mode: 'csv', total: data.total_rows, failures: data.total_failures, exactThreshold: data.exact_threshold, sampleName: csvFile.name }));
      if (data.rows.length > 0) {
        handleInspectCsvRow(data.rows[0]);
      }
    } catch (error) {
      setCsvError(predictionError(error, 'Không thể đọc tệp CSV.'));
    } finally {
      setCsvLoading(false);
    }
  };

  // Inspect Row from CSV
  const handleInspectCsvRow = async (row: CSVRowResult) => {
    csvDetailRequest.current?.abort();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      if (!controller.signal.aborted) setCsvDetailStatus('error');
      controller.abort();
    }, 30000);
    csvDetailRequest.current = controller;
    setSelectedCsvRow(row.row_index);
    setCsvDetail(null);
    setCsvDetailStatus('loading');
    try {
      const resp = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row.inputs),
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error('CSV detail unavailable');
      const data: PredictionResult = await resp.json();
      if (controller.signal.aborted) return;
      setCsvDetail(data);
      setCsvDetailStatus(null);
      triggerAutoScroll();
    } catch {
      if (!controller.signal.aborted) setCsvDetailStatus('error');
    } finally {
      window.clearTimeout(timeout);
    }
  };

  // Download CSV Results
  const handleDownloadCsvResults = () => {
    if (!csvBatch || !filteredCsvRows.length) return;
    downloadCsv([
      ['Dong', 'Muc_chat_luong_Type', 'Air_temperature_K', 'Process_temperature_K', 'Rotational_speed_rpm', 'Torque_Nm', 'Tool_wear_min', 'diem_hong', 'du_doan_hong', 'Trang_thai'],
      ...filteredCsvRows.map(r => [
        r.row_index,
        r.inputs.Type,
        ...sensorFields.map(({ key }) => r.inputs[key]),
        r.model_score,
        Number(r.is_failure),
        `Dự đoán: ${r.status_label}`,
      ]),
    ], `ket-qua-du-doan-ai4i-${Date.now()}.csv`);
  };

  // Download Summary JSON
  const handleDownloadSummary = (result: PredictionResult | null) => {
    if (!result) return;
    const summaryData = {
      thoi_gian: new Date().toISOString(),
      mo_hinh: "LightGBM (Winner Profile 3)",
      thong_so_dau_vao: {
        "Mức chất lượng sản phẩm (Type)": result.inputs.Type === 'L' ? 'L - Thấp' : result.inputs.Type === 'M' ? 'M - Trung bình' : 'H - Cao',
        ...result.inputs
      },
      ket_qua_du_doan: {
        nhan_du_doan: result.is_failure ? "Dự đoán: Cảnh báo hỏng" : "Dự đoán: Bình thường",
        diem_mo_hinh: result.model_score,
        diem_mo_hinh_phan_tram: `${result.model_score_percent}%`,
        nguong_quyet_dinh: result.exact_threshold,
        nguong_hien_thi: `${result.display_threshold_percent}%`,
        vung_nguong: result.is_failure ? "Từ ngưỡng trở lên (>= 31.54%)" : "Dưới ngưỡng (< 31.54%)"
      },
      top_dong_gop_treeshap: result.top_contributions,
      doi_chieu_pham_vi_train: {
        thong_so_ngoai_dai: result.out_of_range_warnings,
        canh_bao_ngoai_dai: result.out_of_range_warnings.length > 0 ? "Kết quả ngoài phạm vi Train không đủ cơ sở kết luận" : "Trong phạm vi Train"
      },
      goi_y_kiem_tra: result.suggestions
    };
    downloadFile(JSON.stringify(summaryData, null, 2), 'application/json', `tom-tat-du-doan-${Date.now()}.json`);
  };

  const filteredCsvRows = (csvBatch?.rows || []).filter(r => {
    if (priorityOnly) return r.is_failure || r.has_out_of_range;
    if (csvFilter === 'failure') return r.is_failure;
    if (csvFilter === 'normal') return !r.is_failure;
    return true;
  });

  if (priorityOnly || csvFilter === 'failure') filteredCsvRows.sort((a, b) => Number(b.is_failure) - Number(a.is_failure) || b.model_score - a.model_score);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Dự đoán hỏng hóc thiết bị
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Nhập thông số máy hoặc tải CSV để nhận kết quả từ LightGBM.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex p-1 rounded-xl bg-slate-200/80 border border-slate-300">
          <button
            onClick={() => setTab('manual')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              tab === 'manual'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Nhập tay (6 thông số)
          </button>
          <button
            onClick={() => setTab('csv')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              tab === 'csv'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Tải tệp CSV</span>
          </button>
        </div>
      </div>

      {sample && tab === 'manual' && !result && sampleName && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm text-teal-800"><strong>{sampleName}</strong> đã được điền sẵn.</p>
          <button form="prediction-form" type="submit" disabled={loading} className="app-button app-button-primary">
            {loading ? 'Đang dự đoán…' : 'Chạy dự đoán mẫu'}
          </button>
        </div>
      )}
      {/* Main Content Area */}
      {tab === 'manual' ? (
        /* ================= MANUAL INPUT MODE ================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Input Form (Desktop: 5 cols) */}
          <div className={`p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-5 ${result ? "lg:col-span-12" : "lg:col-span-5"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                6 Thông số đầu vào
              </span>

              {/* Sample Preset Buttons */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-500 hidden sm:inline mr-1">Mẫu thử:</span>
                <button
                  type="button"
                  onClick={() => applyPreset('normal')}
                  className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 font-medium transition-colors"
                >
                  Bình thường
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('failure')}
                  className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-800 border border-red-300 hover:bg-red-100 font-medium transition-colors"
                >
                  Cảnh báo
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('out_of_range')}
                  className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 font-medium transition-colors"
                >
                  Ngoài dải
                </button>
              </div>
            </div>

             <form id="prediction-form" noValidate onSubmit={handleManualSubmit} className="space-y-4">
              {/* Type: Mức chất lượng sản phẩm */}
              <div>
                <label htmlFor="product-type" className="block text-xs font-bold text-slate-700 mb-1">
                  1. Mức chất lượng sản phẩm (Type)
                </label>
                <select id="product-type" name="Type"
                  value={inputs.Type}
                   onChange={e => {
                     setSampleName(undefined);
                     setInputs({ ...inputs, Type: e.target.value as PredictionInputs['Type'] });
                   }}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 font-medium text-sm focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                >
                   <option value="L">L – Thấp</option>
                   <option value="M">M – Trung bình</option>
                   <option value="H">H – Cao</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {sensorFields.map(({ key, label, unit, min, max }) => {
                  const value = inputs[key];
                  const invalid = checked && invalidFields.some(field => field.key === key);
                  const numericValue = parseSensorValue(value);
                  const outside = Number.isFinite(numericValue) && (numericValue < min || numericValue > max);
                  const id = key.replace(/[^a-zA-Z]+/g, '-');
                  return (
                    <div key={key}>
                      <label htmlFor={id} className="mb-1 block text-xs font-bold text-slate-700">{label} ({unit})</label>
                      <input
                        id={id}
                        name={key}
                         type="text"
                         inputMode="decimal"
                        required
                        value={value}
                        aria-invalid={invalid || undefined}
                        aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ''}`}
                        onBlur={() => { if (value === '') setChecked(true); }}
                         onChange={event => {
                           setSampleName(undefined);
                           setInputs(previous => ({ ...previous, [key]: event.target.value }));
                         }}
                        className={`w-full rounded-lg border bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 ${invalid ? 'border-red-500' : 'border-slate-300'}`}
                      />
                      <p id={`${id}-hint`} className={`mt-1 text-xs ${outside ? 'font-semibold text-amber-800' : 'text-slate-600'}`} aria-live="polite">
                        {outside ? 'Ngoài dải huấn luyện' : 'Dải huấn luyện'} {formatNumber.format(min)}–{formatNumber.format(max)} {unit}
                      </p>
                       {invalid && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-800">
                         {String(value).trim() ? `${label} phải là số hữu hạn.` : `Nhập ${label.toLocaleLowerCase('vi-VN')}.`}
                       </p>}
                    </div>
                  );
                })}
              </div>

              {/* Inline Form Error Display */}
              {errorMsg && (
                <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{errorMsg}{result && ' Bảng bên dưới hiển thị lượt thành công gần nhất.'}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang suy luận qua pipeline LightGBM...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Dự đoán tình trạng máy</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Result Panel or Standby Preview (Desktop: 7 cols) */}
          <div className={result ? "lg:col-span-12" : "lg:col-span-7"}>
            {!result ? (
              /* Standby Placeholder when no prediction has been made yet */
              <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Khung nhìn Máy phay CNC 3D
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Chế độ chờ</span>
                </div>
                <Machine3DViewer 
                  status="illustrative" 
                  interactive={true} 
                  height="h-64 sm:h-72" 
                  caption="Máy phay CNC 3D minh họa quy trình gia công trong bộ dữ liệu AI4I 2020"
                />
                <div className="text-center pt-2">
                  <h3 className="text-sm font-bold text-slate-800">Sẵn sàng nhận dữ liệu dự đoán</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Điền 6 thông số hoặc bấm thử các nút mẫu có sẵn, sau đó bấm <strong>“Dự đoán tình trạng máy”</strong>. Bảng kết quả sẽ tự động mở và cập nhật đèn trạng thái.
                  </p>
                </div>
              </div>
            ) : (
              /* Detailed Prediction Result Block */
              <div 
                ref={resultRef}
                className="animate-result-in rounded-2xl border border-slate-200 bg-white shadow-md p-5 sm:p-6 space-y-6"
                style={{ scrollMarginTop: '80px' }}
              >
                {/* Result Title Header & Download Action */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-700 font-mono">
                      KẾT QUẢ DỰ ĐOÁN GẦN NHẤT
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">
                      Bảng phân tích trạng thái thiết bị
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {manualReport && <button type="button" className="app-button" onClick={() => onReport(manualReport)}>Xem báo cáo</button>}
                    <button type="button" className="app-button" onClick={() => handleDownloadSummary(result)}>
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      Tải tóm tắt JSON
                    </button>
                  </div>
                </div>

                <dl className="watt-kpis">
                  <div>
                    <dt>Điểm mô hình</dt>
                    <dd className="watt-metric">{result.model_score_percent}%</dd>
                  </div>
                  <div>
                    <dt>Ngưỡng quyết định</dt>
                    <dd className="watt-metric">{result.display_threshold_percent}%</dd>
                  </div>
                  <div className={result.is_failure ? 'watt-alert' : 'watt-normal'}>
                    <dt>Trạng thái</dt>
                    <dd>Dự đoán: {result.status_label}</dd>
                  </div>
                </dl>

                {/* 2. Score Scale Bar with Threshold Marker */}
                <ThresholdBar
                  score={result.model_score}
                  scorePercent={result.model_score_percent}
                  exactThreshold={result.exact_threshold}
                  displayThresholdPercent={result.display_threshold_percent}
                  isFailure={result.is_failure}
                />

                {result.out_of_range_warnings.length > 0 && (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                    {result.out_of_range_warnings.length} thông số ngoài dải huấn luyện. Hãy kiểm tra đầu vào trước khi diễn giải kết quả.
                  </p>
                )}
                <button type="button" onClick={() => setBaseline(result)} disabled={baseline === result}
                  className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-white disabled:opacity-60">
                  {baseline && baseline !== result ? 'Giữ kết quả mới làm mốc' : 'Giữ kết quả này'}
                </button>
                {baseline && <PredictionComparison baseline={baseline} current={result} onClear={() => setBaseline(null)} />}

                <div className="watt-analysis-grid">
                  <ShapWaterfall contributions={result.top_contributions} />
                  <InspectionSuggestions suggestions={result.suggestions} isFailure={result.is_failure} />
                </div>

                {/* 3. 3D Machine Viewer with Status Tower Light */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      Đèn trạng thái thiết bị 3D
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                      result.is_failure 
                        ? 'bg-red-100 text-red-800 border-red-300' 
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}>
                      {result.is_failure ? 'Đèn đỏ trên nóc' : 'Đèn xanh trên nóc'}
                    </span>
                  </div>
                  <Machine3DViewer 
                    status={result.is_failure ? 'failure' : 'normal'} 
                    interactive={true} 
                    height="h-64 sm:h-72" 
                    caption="Máy phay CNC 3D minh họa quy trình gia công trong bộ dữ liệu AI4I 2020"
                  />
                </div>

                <RangeBar
                  rangeChecks={result.range_checks}
                  outOfRangeWarnings={result.out_of_range_warnings}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================= CSV BATCH UPLOAD MODE ================= */
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  Dự đoán hàng loạt từ tệp CSV
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nạp tệp CSV chứa 6 cột cảm biến để phân tích dự đoán cho danh sách nhiều máy
                </p>
              </div>

              {/* Sample CSV Download Link */}
              <a
                href="/api/sample-csv"
                download="mau_du_lieu_ai4i.csv"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải tệp CSV mẫu chuẩn</span>
              </a>
            </div>

            <form onSubmit={handleCsvUpload} className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="file"
                  aria-label="Chọn tệp CSV"
                  aria-invalid={Boolean(csvError)}
                  aria-describedby={csvError ? 'csv-error' : undefined}
                  accept=".csv"
                  onChange={(e) => {
                    setCsvFile(e.target.files?.[0] || null);
                    setCsvError(null);
                  }}
                  className="w-full text-xs text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-800 hover:file:bg-teal-100 cursor-pointer border border-slate-300 rounded-lg p-1.5 bg-slate-50"
                />

                <button
                  type="submit"
                  disabled={!csvFile || csvLoading}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shrink-0 shadow-sm"
                >
                  {csvLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang xử lý CSV...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Chạy dự đoán CSV</span>
                    </>
                  )}
                </button>
              </div>

              {csvError && (
                <div id="csv-error" role="alert" className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{csvError}</span>
                </div>
              )}
            </form>
          </div>

          {/* Batch CSV Results Table & Row Details */}
          {csvBatch && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* CSV Summary & Table (Left Column: 7 cols) */}
              <div className="min-w-0 lg:col-span-7 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  {/* Summary Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-300 font-medium">
                      Tổng số: <strong>{csvBatch.total_rows} mẫu</strong>
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-medium">
                      Bình thường: <strong>{csvBatch.total_normals}</strong>
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded bg-red-50 text-red-800 border border-red-300 font-medium">
                      Cảnh báo: <strong>{csvBatch.total_failures}</strong>
                    </span>
                  </div>

                  {/* Filter and Download Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" aria-pressed={priorityOnly} onClick={() => setPriorityOnly(!priorityOnly)}
                      className={`rounded-lg border border-teal-300 px-3 py-2 text-xs font-semibold ${priorityOnly ? 'bg-teal-800 text-white' : 'bg-white text-teal-800 hover:bg-teal-50'}`}>
                      Ca cần xem trước
                    </button>
                    <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-300 text-xs">
                      <button
                        aria-pressed={!priorityOnly && csvFilter === 'all'} onClick={() => { setPriorityOnly(false); setCsvFilter('all'); }}
                        className={`px-2 py-0.5 rounded ${!priorityOnly && csvFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-sm' : 'text-slate-600'}`}
                      >
                        Tất cả
                      </button>
                      <button
                        aria-pressed={!priorityOnly && csvFilter === 'failure'} onClick={() => { setPriorityOnly(false); setCsvFilter('failure'); }}
                        className={`px-2 py-0.5 rounded ${!priorityOnly && csvFilter === 'failure' ? 'bg-red-600 text-white font-bold shadow-sm' : 'text-slate-600'}`}
                      >
                        Cảnh báo
                      </button>
                      <button
                        aria-pressed={!priorityOnly && csvFilter === 'normal'} onClick={() => { setPriorityOnly(false); setCsvFilter('normal'); }}
                        className={`px-2 py-0.5 rounded ${!priorityOnly && csvFilter === 'normal' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-600'}`}
                      >
                        Bình thường
                      </button>
                    </div>

                    <button
                      onClick={handleDownloadCsvResults}
                      disabled={!filteredCsvRows.length}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-colors"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      <span>Tải CSV đã lọc</span>
                    </button>
                    {csvReport && <button type="button" className="app-button" onClick={() => onReport(csvReport)}>Xem báo cáo lô</button>}
                  </div>
                </div>

                <p className="text-xs text-slate-600" aria-live="polite">
                  {filteredCsvRows.length} dòng hiển thị{priorityOnly ? ' · Cảnh báo hỏng trước, sau đó ngoài dải. Mỗi nhóm xếp theo điểm giảm dần.' : ''}
                </p>
                {/* Table */}
                <div className="overflow-x-auto max-h-80 border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200 z-10">
                      <tr>
                        <th className="p-2.5">Dòng</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Nhiệt độ không khí [K]</th>
                        <th className="p-2.5">Nhiệt độ quy trình [K]</th>
                        <th className="p-2.5">Tốc độ quay [rpm]</th>
                        <th className="p-2.5">Mô-men xoắn [Nm]</th>
                        <th className="p-2.5">Độ mòn dao [min]</th>
                        <th className="p-2.5">Điểm</th>
                        <th className="p-2.5">Trạng thái</th>
                        <th className="p-2.5">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
                      {filteredCsvRows.length === 0 && <tr><td colSpan={10} className="p-4 text-slate-600">Không có dòng nào khớp bộ lọc.</td></tr>}
                      {filteredCsvRows.map((r) => {
                        const isSel = selectedCsvRow === r.row_index;
                        return (
                          <tr
                            key={r.row_index}
                            className={`hover:bg-teal-50/50 transition-colors ${
                              isSel ? 'bg-teal-50 font-semibold ring-1 ring-teal-500' : ''
                            }`}
                          >
                            <td className="p-2.5 text-slate-500">{r.row_index}</td>
                            <td className="p-2.5">{r.inputs.Type}</td>
                            <td className="p-2.5">{r.inputs['Air temperature [K]']}</td>
                            <td className="p-2.5">{r.inputs['Process temperature [K]']}</td>
                            <td className="p-2.5">{r.inputs['Rotational speed [rpm]']}</td>
                            <td className="p-2.5">{r.inputs['Torque [Nm]']}</td>
                            <td className="p-2.5">{r.inputs['Tool wear [min]']}</td>
                            <td className="p-2.5 font-bold">
                              <span className={r.is_failure ? 'text-red-700' : 'text-emerald-700'}>
                                {r.model_score_percent}%
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold border ${
                                r.is_failure
                                  ? 'bg-red-50 text-red-800 border-red-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}>
                                {r.is_failure ? 'Cảnh báo hỏng' : 'Bình thường'}
                              </span>
                              {r.has_out_of_range && <span className="mt-1 block whitespace-nowrap font-sans text-[11px] font-semibold text-amber-800">Ngoài dải</span>}
                            </td>
                            <td className="p-2.5">
                              <button type="button" aria-label={`Xem chi tiết dòng ${r.row_index}`} aria-pressed={isSel} onClick={() => handleInspectCsvRow(r)}
                                className="rounded-md p-2 text-teal-800 hover:bg-teal-100">
                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Selected Row Detail (Right Column: 5 cols) */}
              <div className="min-w-0 lg:col-span-5">
                {csvDetailStatus && (
                  <p role={csvDetailStatus === 'error' ? 'alert' : 'status'} className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    {csvDetailStatus === 'loading' ? `Đang tải chi tiết dòng #${selectedCsvRow}…` : `Không tải được dòng #${selectedCsvRow}. Hãy chọn lại dòng để thử lại.`}
                  </p>
                )}
                {csvDetail && (
                  <div 
                    ref={resultRef}
                    className="p-5 rounded-2xl border border-slate-200 bg-white shadow-md space-y-5"
                    style={{ scrollMarginTop: '80px' }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-teal-800 uppercase">
                        Chi tiết dòng #{selectedCsvRow}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {csvReport && (
                          <button type="button" className="app-button" onClick={() => onReport({
                            ...csvReport,
                            ...manualSummary(csvDetail),
                            mode: 'csv',
                            sampleName: `${csvReport.sampleName} · Dòng ${selectedCsvRow}`,
                          })}>Xem báo cáo dòng</button>
                        )}
                        <button type="button" className="app-button" onClick={() => handleDownloadSummary(csvDetail)}>
                          <Download className="w-3.5 h-3.5" aria-hidden="true" /> Tải tóm tắt JSON
                        </button>
                      </div>
                    </div>

                    {/* Prediction Label */}
                    <div className={`p-3.5 rounded-xl border ${
                      csvDetail.is_failure ? 'bg-red-50 border-red-300 text-red-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    }`}>
                      <div className="text-xs text-slate-600 font-medium">Kết luận dự đoán:</div>
                      <div className="text-lg font-extrabold flex items-center gap-2 mt-0.5">
                        {csvDetail.is_failure ? (
                          <>
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <span>Dự đoán: Cảnh báo hỏng</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <span>Dự đoán: Bình thường</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs font-mono mt-1 text-slate-700">
                        Điểm mô hình: <strong>{csvDetail.model_score_percent}%</strong> (Ngưỡng: {csvDetail.display_threshold_percent}%)
                      </div>
                    </div>

                    {/* Machine 3D */}
                    <Machine3DViewer 
                      status={csvDetail.is_failure ? 'failure' : 'normal'} 
                      interactive={true} 
                      height="h-56" 
                      caption="Máy phay CNC 3D minh họa quy trình gia công trong bộ dữ liệu AI4I 2020"
                    />

                    {/* Top 3 TreeSHAP */}
                    <ShapWaterfall contributions={csvDetail.top_contributions} />

                    {/* Range Check */}
                    <RangeBar rangeChecks={csvDetail.range_checks} outOfRangeWarnings={csvDetail.out_of_range_warnings} />

                    {/* Suggestions */}
                    <InspectionSuggestions suggestions={csvDetail.suggestions} isFailure={csvDetail.is_failure} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
