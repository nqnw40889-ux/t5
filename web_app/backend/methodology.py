"""Read-only data inspection and labeled Test examples."""
from fastapi import APIRouter, HTTPException
import pandas as pd
from inference import MaintenancePredictor, ROOT, SPLIT_DIR, NUMERIC_COLUMNS, ALL_COLUMNS

router = APIRouter()


def read_frame(path):
    if not path.is_file():
        raise ValueError(f"Thiếu tệp {path.name}")
    frame = pd.read_csv(path)
    if "Machine failure" not in frame or not frame["Machine failure"].isin([0, 1]).all():
        raise ValueError(f"Nhãn Machine failure không hợp lệ trong {path.name}")
    return frame


def counts(frame):
    total = len(frame)
    failures = int(frame["Machine failure"].sum())
    return dict(total=total, failures=failures, normals=total-failures,
                failure_percent=100*failures/total if total else 0)


@router.get("/api/methodology")
def methodology():
    try:
        raw = read_frame(ROOT / "data" / "ai4i2020.csv")
        splits = {name: read_frame(SPLIT_DIR / f"{name}.csv") for name in ("train", "validation", "test")}
        predictor = MaintenancePredictor.get_instance()
        features = predictor.encode.get_feature_names_out().tolist()
        roles = []
        for column in raw.columns:
            if column in ALL_COLUMNS:
                role, decision, reason = "Đầu vào", "Giữ", "Thuộc tính vận hành dùng để dự đoán"
            elif column == "Machine failure":
                role, decision, reason = "Nhãn mục tiêu", "Tách làm nhãn", "Đối chiếu dự đoán nhị phân"
            elif column in ("TWF", "HDF", "PWF", "OSF", "RNF"):
                role, decision, reason = "Nhãn dạng hỏng", "Bỏ khỏi đầu vào", "Tránh rò rỉ nhãn"
            else:
                role, decision, reason = "Định danh", "Bỏ khỏi đầu vào", "Dùng nhận diện bản ghi"
            roles.append(dict(column=column, role=role, decision=decision, reason=reason))
        return dict(
            source="https://archive.ics.uci.edu/dataset/601/ai4i",
            distributions={"all": counts(raw), **{name: counts(frame) for name, frame in splits.items()}},
            missing_cells=int(raw.isna().sum().sum()),
            duplicate_rows=int(raw.duplicated().sum()),
            duplicate_udi=int(raw["UDI"].duplicated().sum()) if "UDI" in raw else None,
            columns=roles, inputs=ALL_COLUMNS, encoded_features=features,
            type_categories=predictor.encode.named_transformers_["type"].categories_[0].tolist(),
            sampler=str(predictor.pipeline.named_steps["sample"]),
            winner={k: predictor.winner[k] for k in ("model", "profile", "method")},
        )
    except (ValueError, KeyError, OSError) as error:
        raise HTTPException(500, detail=f"Không đọc được dữ liệu phương pháp: {error}")


@router.get("/api/test-samples")
def test_samples():
    try:
        frame = read_frame(SPLIT_DIR / "test.csv")
        return [dict(id=int(row["UDI"]), label=int(row["Machine failure"]),
                     inputs={key: row[key] for key in ALL_COLUMNS})
                for row in frame.to_dict(orient="records")]
    except (ValueError, KeyError, OSError) as error:
        raise HTTPException(500, detail=f"Không đọc được mẫu Test: {error}")


@router.post("/api/test-samples/{udi}/predict")
def predict_test_sample(udi: int):
    try:
        frame = read_frame(SPLIT_DIR / "test.csv")
        selected = frame.loc[frame["UDI"] == udi]
        if selected.empty:
            raise HTTPException(404, detail="Không tìm thấy mã mẫu trong tập Test")
        row = selected.iloc[0]
        # Only the six model inputs enter the inference engine.
        result = MaintenancePredictor.get_instance().predict_single({key: row[key] for key in ALL_COLUMNS})
        truth = int(row["Machine failure"])
        outcome = ("T" if int(result["is_failure"]) == truth else "F") + ("P" if result["is_failure"] else "N")
        result["test_comparison"] = dict(id=udi, label=truth, outcome=outcome)
        return result
    except (ValueError, KeyError, OSError) as error:
        raise HTTPException(400, detail=f"Không dự đoán được mẫu Test: {error}")
