"""Use the saved AI4I pipeline on a CSV with the six raw inputs."""
import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from preprocess import NUMERIC, OUT

RESULTS = OUT / "thuc_nghiem"


def predict_csv(input_path, output_path):
    metadata = json.loads((RESULTS / "ket_qua.json").read_text(encoding="utf-8"))
    selected = metadata["winner"]
    data = pd.read_csv(input_path, encoding="utf-8-sig")
    missing = [column for column in selected["columns"] if column not in data]
    if missing:
        raise ValueError(f"Thiếu cột: {', '.join(missing)}")
    if data.empty:
        raise ValueError("CSV không có mẫu dự đoán.")
    features = data[selected["columns"]].copy()
    if not features["Type"].isin(["L", "M", "H"]).all():
        raise ValueError("Type chỉ nhận L, M hoặc H.")
    features[NUMERIC] = features[NUMERIC].apply(pd.to_numeric, errors="raise")
    if not np.isfinite(features[NUMERIC].to_numpy(dtype=float)).all():
        raise ValueError("Các thông số phải là số hữu hạn và không được để trống.")
    pipeline = joblib.load(RESULTS / "pipeline.joblib")
    scores = pipeline.predict_proba(features)[:, 1]
    predictions = data.assign(
        diem_hong=scores, du_doan_hong=(scores >= selected["threshold"]).astype(int)
    )
    predictions.to_csv(output_path, index=False, encoding="utf-8-sig")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("Hãy chọn đường dẫn kết quả khác tệp đầu vào.")
    try:
        predict_csv(args.input, args.output)
    except ValueError as error:
        parser.error(str(error))
