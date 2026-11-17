"""Inference engine for AI4I Predictive Maintenance web application.
Reads pipeline and metadata from ket_qua/thuc_nghiem/ strictly read-only.
"""
import sys
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
from scipy.special import expit

# Base directory of project
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
DATA_DIR = ROOT / "data"
RESULTS_DIR = ROOT / "ket_qua"
EXP_DIR = RESULTS_DIR / "thuc_nghiem"
SPLIT_DIR = RESULTS_DIR / "du_lieu"

NUMERIC_COLUMNS = [
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]"
]
ALL_COLUMNS = ["Type", *NUMERIC_COLUMNS]

FEATURE_VN_MAP = {
    "Type": "Mức chất lượng sản phẩm (Type)",
    "Air temperature [K]": "Nhiệt độ không khí [K]",
    "Process temperature [K]": "Nhiệt độ quy trình [K]",
    "Rotational speed [rpm]": "Tốc độ quay [rpm]",
    "Torque [Nm]": "Mô-men xoắn [Nm]",
    "Tool wear [min]": "Độ mòn dao [min]"
}

def validate_input(values, row=None):
    prefix = f"Dòng {row}: " if row is not None else ""
    result = {}
    for col in ALL_COLUMNS:
        value = values.get(col)
        label = FEATURE_VN_MAP[col]
        if value is None or (isinstance(value, str) and not value.strip()):
            raise ValueError(f"{prefix}Cột {col}: thiếu {label}")
        if col == "Type":
            value = str(value).strip().upper()
            if value not in ("L", "M", "H"):
                raise ValueError(f"{prefix}Cột Type chỉ nhận L, M hoặc H")
        else:
            try:
                if isinstance(value, bool):
                    raise ValueError()
                value = float(value)
            except (ValueError, TypeError, OverflowError):
                raise ValueError(f"{prefix}Cột {col}: {label} phải là số hữu hạn")
            if not np.isfinite(value):
                raise ValueError(f"{prefix}Cột {col}: {label} phải là số hữu hạn")
            if col == "Tool wear [min]" and value < 0:
                raise ValueError(f"{prefix}Cột {col}: Độ mòn dao phải từ 0 phút trở lên")
            if "temperature" in col and value <= 0:
                raise ValueError(f"{prefix}Cột {col}: Nhiệt độ Kelvin phải lớn hơn 0")
            if col in ("Torque [Nm]", "Rotational speed [rpm]") and value < 0:
                raise ValueError(f"{prefix}Cột {col}: {label} phải từ 0 trở lên")
        result[col] = value
    return result


class MaintenancePredictor:
    _instance = None

    def __init__(self):
        for path in (EXP_DIR / "ket_qua.json", EXP_DIR / "pipeline.joblib", SPLIT_DIR / "train.csv"):
            if not path.is_file():
                raise ValueError(f"Thiếu tệp bắt buộc: {path.name}")
        # 1. Load exact winner threshold and metadata from ket_qua.json
        meta_path = EXP_DIR / "ket_qua.json"
        self.metadata = json.loads(meta_path.read_text(encoding="utf-8"))
        self.winner = self.metadata["winner"]
        self.exact_threshold = float(self.winner["threshold"])
        self.display_threshold_percent = round(self.exact_threshold * 100, 2)
        
        # 2. Load frozen pipeline
        pipeline_path = EXP_DIR / "pipeline.joblib"
        self.pipeline = joblib.load(pipeline_path)
        self.model = self.pipeline.named_steps["model"]
        self.prepare = self.pipeline.named_steps["prepare"]
        self.encode = self.pipeline.named_steps["encode"]
        self.booster = self.model.booster_
        
        # 3. Load Train statistics for range reference
        train_path = SPLIT_DIR / "train.csv"
        train_df = pd.read_csv(train_path)
        self.train_stats = {}
        for col in NUMERIC_COLUMNS:
            series = train_df[col]
            self.train_stats[col] = {
                "min": float(series.min()),
                "p05": float(series.quantile(0.05)),
                "q25": float(series.quantile(0.25)),
                "median": float(series.median()),
                "mean": float(series.mean()),
                "q75": float(series.quantile(0.75)),
                "p95": float(series.quantile(0.95)),
                "max": float(series.max())
            }

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def predict_single(self, input_dict: dict) -> dict:
        """Run single manual sample inference with exact SHAP, range check and inspection suggestions."""
        values = validate_input(input_dict)
        type_val = values["Type"]
        df = pd.DataFrame([values])

        # 1. Pipeline model score (diem_hong)
        scores = self.pipeline.predict_proba(df)[:, 1]
        score = float(scores[0])
        score_percent = round(score * 100, 2)
        is_failure = bool(score >= self.exact_threshold)
        status_label = "Cảnh báo hỏng" if is_failure else "Bình thường"
        
        # 2. Check Train Ranges
        range_checks = []
        out_of_range_warnings = []
        for col in NUMERIC_COLUMNS:
            val = float(df[col].iloc[0])
            stats = self.train_stats[col]
            is_out = bool(val < stats["min"] or val > stats["max"])
            range_span = max(stats["max"] - stats["min"], 1e-6)
            position_pct = max(0.0, min(100.0, ((val - stats["min"]) / range_span) * 100))
            
            check_item = {
                "column": col,
                "column_vn": FEATURE_VN_MAP[col],
                "value": val,
                "is_out_of_range": is_out,
                "train_min": stats["min"],
                "train_median": stats["median"],
                "train_max": stats["max"],
                "train_p05": stats["p05"],
                "train_p95": stats["p95"],
                "position_pct": round(position_pct, 1)
            }
            if is_out:
                msg = f"{FEATURE_VN_MAP[col]}: giá trị {val} nằm ngoài phạm vi quan sát trên tập Train [{stats['min']} - {stats['max']}]."
                out_of_range_warnings.append(msg)
                check_item["warning_msg"] = msg
            range_checks.append(check_item)

        # 3. Exact LightGBM TreeSHAP computation
        x_prep = self.prepare.transform(df)
        x_enc = self.encode.transform(x_prep)
        contribs = self.booster.predict(x_enc, pred_contrib=True)[0]
        # contribs: [0: Air, 1: Process, 2: Speed, 3: Torque, 4: Tool wear, 5: Type_H, 6: Type_L, 7: Type_M, 8: Base]
        type_shap = float(contribs[5] + contribs[6] + contribs[7])
        
        raw_shaps = [
            {"column": "Air temperature [K]", "column_vn": FEATURE_VN_MAP["Air temperature [K]"], "value": float(df["Air temperature [K]"].iloc[0]), "shap": float(contribs[0])},
            {"column": "Process temperature [K]", "column_vn": FEATURE_VN_MAP["Process temperature [K]"], "value": float(df["Process temperature [K]"].iloc[0]), "shap": float(contribs[1])},
            {"column": "Rotational speed [rpm]", "column_vn": FEATURE_VN_MAP["Rotational speed [rpm]"], "value": float(df["Rotational speed [rpm]"].iloc[0]), "shap": float(contribs[2])},
            {"column": "Torque [Nm]", "column_vn": FEATURE_VN_MAP["Torque [Nm]"], "value": float(df["Torque [Nm]"].iloc[0]), "shap": float(contribs[3])},
            {"column": "Tool wear [min]", "column_vn": FEATURE_VN_MAP["Tool wear [min]"], "value": float(df["Tool wear [min]"].iloc[0]), "shap": float(contribs[4])},
            {"column": "Type", "column_vn": FEATURE_VN_MAP["Type"], "value": type_val, "shap": type_shap},
        ]
        
        # Sort by absolute SHAP contribution descending and pick top 3
        sorted_shaps = sorted(raw_shaps, key=lambda x: abs(x["shap"]), reverse=True)
        top_3 = []
        for item in sorted_shaps[:3]:
            shap_val = item["shap"]
            top_3.append({
                "column": item["column"],
                "column_vn": item["column_vn"],
                "value": item["value"],
                "contribution": round(shap_val, 4),
                "abs_contribution": round(abs(shap_val), 4),
                "direction": "tăng điểm mô hình" if shap_val > 0 else "giảm điểm mô hình",
                "direction_type": "positive" if shap_val > 0 else "negative"
            })

        # 4. Gợi ý kiểm tra (1-2 gợi ý đối chiếu số đo / thông số liên quan)
        suggestions = []
        if out_of_range_warnings:
            suggestions = ["Kết quả ngoài phạm vi Train không đủ cơ sở kết luận",
                           "Đối chiếu lại số đo cảm biến và các thông số vượt dải trước khi sử dụng kết quả tham khảo."]
        elif is_failure:
            speed = float(df["Rotational speed [rpm]"].iloc[0])
            torque = float(df["Torque [Nm]"].iloc[0])
            tool_wear = float(df["Tool wear [min]"].iloc[0])
            air_temp = float(df["Air temperature [K]"].iloc[0])
            proc_temp = float(df["Process temperature [K]"].iloc[0])
            temp_diff = proc_temp - air_temp

            # Prioritize based on highest contributing factors
            top_columns = [item["column"] for item in top_3 if item["contribution"] > 0]
            
            if "Torque [Nm]" in top_columns or "Rotational speed [rpm]" in top_columns or torque >= 55.0 or speed <= 1300 or speed >= 2000:
                suggestions.append("Đối chiếu tải trọng làm việc của trục chính và kiểm tra mô-men xoắn/tốc độ quay thực tế để phòng ngừa quá tải công suất hoặc kẹt cơ khí.")
            
            if "Tool wear [min]" in top_columns or tool_wear >= 180.0:
                suggestions.append("Đo trực tiếp độ mòn cạnh cắt của dao gia công, kiểm tra rung động phôi và cân nhắc thay dao định kỳ.")
                
            if ("Process temperature [K]" in top_columns or "Air temperature [K]" in top_columns or temp_diff < 8.6) and len(suggestions) < 2:
                suggestions.append("Kiểm tra hệ thống tản nhiệt và lưu lượng bơm dung dịch làm mát quanh khu vực gia công do chênh lệch nhiệt độ bất thường.")
                
            if not suggestions:
                suggestions.append("Đối chiếu lại số liệu cảm biến với thiết bị đo chuẩn ngoài và kiểm tra rung động tại các gối đỡ trục.")
                suggestions.append("Theo dõi liên tục chu kỳ tải tiếp theo trước khi vận hành ở tốc độ tối đa.")
        else:
            suggestions.append("Mô hình dự đoán bình thường tại ngưỡng đã lưu")
            if out_of_range_warnings:
                suggestions.append("Lưu ý: Có thông số nằm ngoài dải quan sát của tập Train, khuyến nghị kiểm tra lại số đo cảm biến.")

        return {
            "inputs": {
                "Type": type_val,
                "Air temperature [K]": float(df["Air temperature [K]"].iloc[0]),
                "Process temperature [K]": float(df["Process temperature [K]"].iloc[0]),
                "Rotational speed [rpm]": float(df["Rotational speed [rpm]"].iloc[0]),
                "Torque [Nm]": float(df["Torque [Nm]"].iloc[0]),
                "Tool wear [min]": float(df["Tool wear [min]"].iloc[0]),
            },
            "model_score": score,
            "model_score_percent": score_percent,
            "exact_threshold": self.exact_threshold,
            "display_threshold_percent": self.display_threshold_percent,
            "is_failure": is_failure,
            "status_label": status_label,
            "top_contributions": top_3,
            "range_checks": range_checks,
            "out_of_range_warnings": out_of_range_warnings,
            "suggestions": suggestions[:2]
        }

    def predict_csv(self, csv_file_content_or_path) -> dict:
        """Run CSV batch inference using the exact pipeline logic."""
        if isinstance(csv_file_content_or_path, (str, Path)):
            data = pd.read_csv(csv_file_content_or_path, encoding="utf-8-sig", keep_default_na=False, skip_blank_lines=False)
        else:
            data = pd.read_csv(csv_file_content_or_path, encoding="utf-8-sig", keep_default_na=False, skip_blank_lines=False)

        if data.empty:
            raise ValueError("Tệp CSV rỗng, không chứa dữ liệu mẫu.")

        # Check required columns
        missing = [col for col in ALL_COLUMNS if col not in data.columns]
        if missing:
            raise ValueError(f"Dòng 1: Tệp CSV thiếu cột bắt buộc: {', '.join(missing)}")

        features = pd.DataFrame([
            validate_input(record, index + 2)
            for index, record in enumerate(data.to_dict(orient="records"))
        ], columns=ALL_COLUMNS)

        scores = self.pipeline.predict_proba(features)[:, 1]
        du_doan_hong = (scores >= self.exact_threshold).astype(int)

        results_list = []
        total_rows = len(features)
        total_failures = int(du_doan_hong.sum())
        total_normals = total_rows - total_failures

        for i in range(total_rows):
            sc = float(scores[i])
            fail = bool(du_doan_hong[i] == 1)
            row_in = {
                "Type": str(features["Type"].iloc[i]),
                "Air temperature [K]": float(features["Air temperature [K]"].iloc[i]),
                "Process temperature [K]": float(features["Process temperature [K]"].iloc[i]),
                "Rotational speed [rpm]": float(features["Rotational speed [rpm]"].iloc[i]),
                "Torque [Nm]": float(features["Torque [Nm]"].iloc[i]),
                "Tool wear [min]": float(features["Tool wear [min]"].iloc[i]),
            }
            # Fast out-of-range flag
            has_oor = False
            for col in NUMERIC_COLUMNS:
                v = row_in[col]
                st = self.train_stats[col]
                if v < st["min"] or v > st["max"]:
                    has_oor = True
                    break

            results_list.append({
                "row_index": i + 1,
                "inputs": row_in,
                "model_score": sc,
                "model_score_percent": round(sc * 100, 2),
                "is_failure": fail,
                "status_label": "Cảnh báo hỏng" if fail else "Bình thường",
                "has_out_of_range": has_oor
            })

        return {
            "total_rows": total_rows,
            "total_failures": total_failures,
            "total_normals": total_normals,
            "exact_threshold": self.exact_threshold,
            "display_threshold_percent": self.display_threshold_percent,
            "rows": results_list
        }
