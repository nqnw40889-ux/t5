"""FastAPI Backend Server for AI4I Predictive Maintenance Application.
Provides REST APIs for manual prediction, CSV batch inference, test evaluation statistics,
and static template/figure distribution.
"""
from pathlib import Path
import io
import json
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException, Body
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
def predict_manual(req: dict = Body(...)):
    try:
        return predictor.predict_single(req)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

@app.post("/api/predict-csv")
async def predict_csv_upload(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".csv"):
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
        raise HTTPException(status_code=404, detail="Thiếu tệp kết quả quét ngưỡng Validation.")
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
        winner_test = meta["winner_test"]
        for key in ("tn", "fp", "fn", "tp", "precision", "recall", "f1", "ap", "threshold"):
            if key not in winner_test or not np.isfinite(winner_test[key]):
                raise ValueError(f"Thiếu hoặc sai trường kết quả {key}")
        winner_val = meta["winner"]["val"]
        for key in ("precision", "recall", "f1", "ap", "threshold"):
            if key not in winner_val or not np.isfinite(winner_val[key]):
                raise ValueError(f"Thiếu hoặc sai trường Validation {key}")
        
        # 2. PR curve points computed from saved du_doan_test.csv
        test_pred_path = EXP_DIR / "du_doan_test.csv"
        test_df = pd.read_csv(test_pred_path)
        p, r, thresh = precision_recall_curve(test_df["Machine failure"], test_df["diem_hong"])
        
        pr_points = []
        for i in range(len(p)):
            if i:
                pr_points.append({"recall": float(r[i]), "precision": float(p[i-1])})
            pr_points.append({"recall": float(r[i]), "precision": float(p[i])})

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
                "total_test_samples": len(test_df),
                "test_failures": int(test_df["Machine failure"].sum()),
                "test_normals": int((test_df["Machine failure"] == 0).sum()),
                "imbalance_ratio": f"{100 * test_df['Machine failure'].mean():.2f}% mẫu hỏng",
                "split_ratio": "70% Train / 15% Validation / 15% Test (phân tầng, seed=42)"
            },
            "winner_model": meta["winner"],
            "winner_test": winner_test,
            "winner_val": winner_val,
            "confusion_matrix": {
                "tn": winner_test["tn"],
                "fp": winner_test["fp"],
                "fn": winner_test["fn"],
                "tp": winner_test["tp"]
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
