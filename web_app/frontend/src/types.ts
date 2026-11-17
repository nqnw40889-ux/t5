export interface PredictionInputs {
  Type: 'L' | 'M' | 'H';
  'Air temperature [K]': number;
  'Process temperature [K]': number;
  'Rotational speed [rpm]': number;
  'Torque [Nm]': number;
  'Tool wear [min]': number;
}

export interface SHAPContribution {
  column: string;
  column_vn: string;
  value: number | string;
  contribution: number;
  abs_contribution: number;
  direction: string;
  direction_type: 'positive' | 'negative';
}

export interface RangeCheckItem {
  column: string;
  column_vn: string;
  value: number;
  is_out_of_range: boolean;
  train_min: number;
  train_median: number;
  train_max: number;
  train_p05: number;
  train_p95: number;
  position_pct: number;
  warning_msg?: string;
}

export interface PredictionResult {
  test_comparison?: { id: number; label: number; outcome: "TP" | "TN" | "FP" | "FN" };
  inputs: PredictionInputs;
  model_score: number;
  model_score_percent: number;
  exact_threshold: number;
  display_threshold_percent: number;
  is_failure: boolean;
  status_label: 'Bình thường' | 'Cảnh báo hỏng';
  top_contributions: SHAPContribution[];
  range_checks: RangeCheckItem[];
  out_of_range_warnings: string[];
  suggestions: string[];
}

export interface CSVRowResult {
  row_index: number;
  inputs: PredictionInputs;
  model_score: number;
  model_score_percent: number;
  is_failure: boolean;
  status_label: 'Bình thường' | 'Cảnh báo hỏng';
  has_out_of_range: boolean;
}

export interface CSVBatchResponse {
  total_rows: number;
  total_failures: number;
  total_normals: number;
  exact_threshold: number;
  display_threshold_percent: number;
  rows: CSVRowResult[];
}

export interface ConfigurationItem {
  model: string;
  profile: number;
  method: string;
  columns: string;
  train_ap: number;
  cv_ap: number;
  cv_sd: number;
  gap: number;
  threshold: number;
  val_threshold: number;
  val_ap: number;
  val_precision: number;
  val_recall: number;
  val_f1: number;
  val_tn: number;
  val_fp: number;
  val_fn: number;
  val_tp: number;
  selected: boolean;
  [key: string]: any;
}

export interface MisclassificationItem {
  UDI: number;
  Type: string;
  'Air temperature [K]': number;
  'Process temperature [K]': number;
  'Rotational speed [rpm]': number;
  'Torque [Nm]': number;
  'Tool wear [min]': number;
  'Machine failure': number;
  diem_hong: number;
  du_doan_hong: number;
  TWF: number;
  HDF: number;
  PWF: number;
  OSF: number;
  RNF: number;
}

export interface TestResultsResponse {
  dataset_info: {
    name: string;
    total_test_samples: number;
    test_failures: number;
    test_normals: number;
    imbalance_ratio: string;
    split_ratio: string;
  };
  winner_model: {
    model: string;
    profile: number;
    method: string;
    params: Record<string, any>;
    train_ap: number;
    cv_ap: number;
    gap: number;
    threshold: number;
  };
  winner_test: {
    threshold: number;
    ap: number;
    precision: number;
    recall: number;
    f1: number;
    tn: number;
    fp: number;
    fn: number;
    tp: number;
  };
  winner_val: {
    threshold: number;
    ap: number;
    precision: number;
    recall: number;
    f1: number;
    tn: number;
    fp: number;
    fn: number;
    tp: number;
  };
  confusion_matrix: {
    tn: number;
    fp: number;
    fn: number;
    tp: number;
  };
  pr_curve: Array<{
    recall: number;
    precision: number;
  }>;
  configurations: ConfigurationItem[];
  misclassifications: MisclassificationItem[];
}
