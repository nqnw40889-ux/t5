"""FastAPI Backend Server for AI4I Predictive Maintenance Application.
Provides REST APIs for manual prediction, CSV batch inference, test evaluation statistics,
and static template/figure distribution.
"""
from pathlib import Path
import io
import json
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sklearn.metrics import precision_recall_curve

from inference import MaintenancePredictor, ALL_COLUMNS, NUMERIC_COLUMNS, EXP_DIR, SPLIT_DIR, ROOT

app = FastAPI(
    title="AI4I Predictive Maintenance API",
    description="Hệ thống dự đoán hỏng hóc máy phục vụ bảo trì dự đoán trên dữ liệu cảm biến mất cân bằng",
    version="1.0.0"
)

# Enable CORS for development frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

predictor = MaintenancePredictor.get_instance()

class PredictRequest(BaseModel):
    Type: str = Field(..., description="Loại máy: L, M hoặc H")
    Air_temperature_K: float = Field(..., alias="Air temperature [K]", description="Nhiệt độ không khí [K]")
    Process_temperature_K: float = Field(..., alias="Process temperature [K]", description="Nhiệt độ quy trình [K]")
    Rotational_speed_rpm: float = Field(..., alias="Rotational speed [rpm]", description="Tốc độ quay [rpm]")
    Torque_Nm: float = Field(..., alias="Torque [Nm]", description="Mô-men xoắn [Nm]")
    Tool_wear_min: float = Field(..., alias="Tool wear [min]", description="Độ mòn dao [min]")

    class Config:
        populate_by_name = True

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "model": "LightGBM",
        "threshold": predictor.exact_threshold,
        "display_threshold_percent": predictor.display_threshold_percent
    }

@app.get("/api/metadata")
def get_metadata():
    return {
        "model_name": "LightGBM Classifier",
        "exact_threshold": predictor.exact_threshold,
        "display_threshold_percent": predictor.display_threshold_percent,
        "winner": predictor.winner,
        "train_stats": predictor.train_stats,
        "columns": ALL_COLUMNS,
        "numeric_columns": NUMERIC_COLUMNS
    }

@app.post("/api/predict")
def predict_manual(req: PredictRequest):
    try:
        input_dict = {
            "Type": req.Type,
            "Air temperature [K]": req.Air_temperature_K,
            "Process temperature [K]": req.Process_temperature_K,
            "Rotational speed [rpm]": req.Rotational_speed_rpm,
            "Torque [Nm]": req.Torque_Nm,
            "Tool wear [min]": req.Tool_wear_min,
        }
        res = predictor.predict_single(input_dict)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/predict-csv")
async def predict_csv_upload(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Vui lòng tải lên tệp có định dạng .csv.")
    try:
        contents = await file.read()
        csv_buffer = io.StringIO(contents.decode("utf-8-sig", errors="replace"))
        result = predictor.predict_csv(csv_buffer)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xử lý CSV: {str(e)}")

@app.get("/api/sample-csv")
def download_sample_csv():
    """Generates standard sample CSV with 6 input columns."""
    sample_data = [
        {"Type": "L", "Air temperature [K]": 298.1, "Process temperature [K]": 308.6, "Rotational speed [rpm]": 1551, "Torque [Nm]": 42.8, "Tool wear [min]": 0},
        {"Type": "M", "Air temperature [K]": 298.2, "Process temperature [K]": 308.7, "Rotational speed [rpm]": 1408, "Torque [Nm]": 46.3, "Tool wear [min]": 3},
        {"Type": "H", "Air temperature [K]": 298.4, "Process temperature [K]": 308.9, "Rotational speed [rpm]": 1498, "Torque [Nm]": 49.4, "Tool wear [min]": 5},
        {"Type": "L", "Air temperature [K]": 302.4, "Process temperature [K]": 311.5, "Rotational speed [rpm]": 1282, "Torque [Nm]": 60.7, "Tool wear [min]": 216},
        {"Type": "L", "Air temperature [K]": 300.7, "Process temperature [K]": 310.4, "Rotational speed [rpm]": 1360, "Torque [Nm]": 56.4, "Tool wear [min]": 204}
    ]
    df = pd.DataFrame(sample_data)
    csv_bytes = df.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mau_du_lieu_ai4i.csv"}
    )

@app.get("/api/validation-thresholds")
def get_validation_thresholds():
    """Serve the saved validation sweep with the frozen decision threshold."""
    path = EXP_DIR / "quet_nguong_validation.csv"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Saved validation sweep is unavailable.")
    sweep = pd.read_csv(
        path,
        usecols=["threshold", "precision", "recall", "f1"],
        float_precision="round_trip",
    )
    return {
        "exact_threshold": predictor.exact_threshold,
        "display_threshold_percent": predictor.display_threshold_percent,
        "points": sweep.to_dict(orient="records"),
    }


@app.get("/api/test-results")
def get_test_results():
    """Reads saved test evaluation data from ket_qua/thuc_nghiem/ strictly read-only."""
    try:
        # 1. Test & Validation metrics from ket_qua.json
        meta = predictor.metadata
        winner_test = meta.get("winner_test", {})
        winner_val = meta.get("winner", {}).get("val", {})
        
        # 2. PR curve points computed from saved du_doan_test.csv
        test_pred_path = EXP_DIR / "du_doan_test.csv"
        test_df = pd.read_csv(test_pred_path)
        p, r, thresh = precision_recall_curve(test_df["Machine failure"], test_df["diem_hong"])
        
        # Downsample PR curve to ~60 evenly spaced recall points for frontend rendering
        indices = [int(i) for i in np.linspace(0, len(p) - 1, min(60, len(p)))]
        pr_points = [{"recall": round(float(r[i]), 4), "precision": round(float(p[i]), 4)} for i in indices]
        # Sort by recall ascending
        pr_points = sorted(pr_points, key=lambda x: x["recall"])

        # 3. 40 Configurations from so_sanh_40_cau_hinh.csv
        cfg_path = EXP_DIR / "so_sanh_40_cau_hinh.csv"
        cfg_df = pd.read_csv(cfg_path)
        # Clean NaNs for JSON serialization
        cfg_df = cfg_df.fillna("")
        configs = cfg_df.to_dict(orient="records")

        # 4. 24 Misclassified samples from du_doan_sai.csv
        misclass_path = EXP_DIR / "du_doan_sai.csv"
        misclass_df = pd.read_csv(misclass_path)
        misclass_df = misclass_df.fillna("")
        misclass_records = misclass_df.to_dict(orient="records")

        return {
            "dataset_info": {
                "name": "AI4I 2020 Predictive Maintenance (Tập Test độc lập)",
                "total_test_samples": 1500,
                "test_failures": 51,
                "test_normals": 1449,
                "imbalance_ratio": "3.4% mẫu hỏng (mất cân bằng nghiêm trọng)",
                "split_ratio": "70% Train / 15% Validation / 15% Test (phân tầng, seed=42)"
            },
            "winner_model": meta.get("winner", {}),
            "winner_test": winner_test,
            "winner_val": winner_val,
            "confusion_matrix": {
                "tn": winner_test.get("tn", 1437),
                "fp": winner_test.get("fp", 12),
                "fn": winner_test.get("fn", 12),
                "tp": winner_test.get("tp", 39)
            },
            "pr_curve": pr_points,
            "configurations": configs,
            "misclassifications": misclass_records
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi đọc kết quả kiểm thử: {str(e)}")

# Mount static figures (original matplotlib generated plots)
FIGURES_DIR = EXP_DIR
@app.get("/api/figures/confusion-matrix")
def get_figure_cm():
    p = FIGURES_DIR / "ma_tran_nham_lan.png"
    if p.exists():
        return FileResponse(p, media_type="image/png")
    raise HTTPException(status_code=404, detail="Không tìm thấy tệp hình ảnh")

@app.get("/api/figures/pr-curve")
def get_figure_pr():
    p = FIGURES_DIR / "precision_recall_test.png"
    if p.exists():
        return FileResponse(p, media_type="image/png")
    raise HTTPException(status_code=404, detail="Không tìm thấy tệp hình ảnh")

# Serve built frontend if exists
FRONTEND_DIST = ROOT / "web_app" / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
