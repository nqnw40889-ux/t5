"""Read the deployed frozen LightGBM pipeline and draw grouped gain importance."""
from pathlib import Path
import sys
import json
import hashlib
import csv

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.dont_write_bytecode = True

import joblib
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.preprocessing import OneHotEncoder
from lightgbm import LGBMClassifier

LABELS = {
    "Type": "Cấp chất lượng sản phẩm",
    "Air temperature [K]": "Nhiệt độ không khí",
    "Process temperature [K]": "Nhiệt độ quá trình",
    "Rotational speed [rpm]": "Tốc độ quay",
    "Torque [Nm]": "Mô-men xoắn",
    "Tool wear [min]": "Độ mòn dao",
}


def manifest():
    return {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for folder in ("data", "ket_qua") for p in (ROOT/folder).rglob("*") if p.is_file()}


def write_json(path, value):
    with path.open("x", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, allow_nan=False)


def main():
    filenames = [
        "do_quan_trong_dac_trung_gain.png", "gain_sau_ma_hoa.csv", "gain_sau_gop.csv",
        "doi_chieu_dac_trung.json", "sha256-gain-after.json", "doi_chieu_sha256_gain.json",
    ]
    existing = [name for name in filenames if (HERE/name).exists()]
    if existing:
        raise FileExistsError("Các tệp đích đã tồn tại, từ chối ghi đè: " + ", ".join(existing))
    before = manifest()
    snapshot = HERE/"sha256-gain-before.json"
    if snapshot.exists():
        recorded = json.loads(snapshot.read_text(encoding="utf-8-sig"))
        if recorded != before:
            raise ValueError("Tệp bảo vệ khác bản SHA-256 trước sửa")
    else:
        write_json(snapshot, before)

    pipeline_path = ROOT/"ket_qua"/"thuc_nghiem"/"pipeline.joblib"
    pipeline = joblib.load(pipeline_path)
    model = pipeline.named_steps["model"]
    if not isinstance(model, LGBMClassifier):
        raise TypeError("Mô hình trong pipeline không phải LGBMClassifier")
    encode = pipeline.named_steps["encode"]
    names = encode.get_feature_names_out().tolist()
    model_names = model.feature_name_
    booster_names = model.booster_.feature_name()
    if names != model_names or names != booster_names:
        raise ValueError("Thứ tự đặc trưng sau biến đổi không khớp đầu vào LightGBM")
    prepare_names = pipeline.named_steps["prepare"].get_feature_names_out().tolist()
    if prepare_names != encode.feature_names_in_.tolist():
        raise ValueError("Thứ tự đầu ra prepare khác thứ tự đầu vào encode")
    gains = model.booster_.feature_importance(importance_type="gain")
    if len(gains) != len(names) or len(gains) != model.booster_.num_feature():
        raise ValueError("Số chiều gain không khớp số chiều mô hình")
    if not np.isfinite(gains).all() or (gains < 0).any() or gains.sum() <= 0:
        raise ValueError("Gain không hợp lệ hoặc tổng gain bằng 0")

    mapping = {}
    for name, transformer, columns in encode.transformers_:
        if isinstance(transformer, str) and transformer == "drop":
            continue
        indices = encode.output_indices_[name]
        output_columns = list(range(indices.start, indices.stop))
        columns = list(columns)
        if isinstance(transformer, OneHotEncoder) and columns == ["Type"]:
            if len(transformer.get_feature_names_out(columns)) != len(output_columns):
                raise ValueError("Số cột one-hot Type không khớp output_indices")
            mapping.update({index: "Type" for index in output_columns})
        elif columns and set(columns).issubset(set(LABELS)-{"Type"}) and len(columns) == len(output_columns):
            mapping.update(dict(zip(output_columns, columns)))
        else:
            raise ValueError(f"Chưa xác định được ánh xạ biến đổi {name}")
    if set(mapping) != set(range(len(names))) or set(mapping.values()) != set(LABELS):
        raise ValueError("Ánh xạ gain không bao phủ đúng sáu đầu vào")
    grouped = {column: float(sum(gains[i] for i in mapping if mapping[i] == column)) for column in LABELS}
    total = float(gains.sum())
    rows = sorted([
        dict(column=column, label=LABELS[column], gain=value, percent=100*value/total)
        for column, value in grouped.items()
    ], key=lambda row: row["gain"], reverse=True)
    if not np.isclose(sum(row["percent"] for row in rows), 100, atol=1e-10):
        raise ValueError("Tổng tỷ trọng không bằng 100%")

    with (HERE/"gain_sau_ma_hoa.csv").open("x", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(["thu_tu", "ten_sau_bien_doi", "thuoc_tinh_goc", "gain"])
        for index, (name, gain) in enumerate(zip(names, gains)):
            writer.writerow([index, name, mapping[index], float(gain)])
    with (HERE/"gain_sau_gop.csv").open("x", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=["column", "label", "gain", "percent"])
        writer.writeheader()
        writer.writerows(rows)
    write_json(HERE/"doi_chieu_dac_trung.json", dict(
        pipeline="ket_qua/thuc_nghiem/pipeline.joblib",
        pipeline_sha256=before["ket_qua/thuc_nghiem/pipeline.joblib"],
        importance_type="gain", prepare_features=prepare_names, encoded_features=names,
        model_features=model_names, booster_features=booster_names,
        original_columns_by_encoded_index=[mapping[i] for i in range(len(names))],
        type_categories=encode.named_transformers_["type"].categories_[0].tolist(),
        total_gain=total, total_percent=sum(row["percent"] for row in rows),
    ))
    with plt.rc_context({
        "font.family": "DejaVu Sans", "font.size": 11, "axes.titlesize": 15,
        "axes.labelsize": 11, "figure.facecolor": "white", "axes.facecolor": "white",
        "text.color": "#172433", "axes.labelcolor": "#172433",
        "xtick.color": "#33465A", "ytick.color": "#172433",
    }):
        fig, ax = plt.subplots(figsize=(10, 5.4), layout="constrained")
        values = [row["percent"] for row in rows]
        bars = ax.barh([row["label"] for row in rows], values, color="#08766D", height=.6)
        ax.invert_yaxis()
        ax.set_xlabel("Tỷ trọng gain (%)")
        ax.set_title("Độ quan trọng đặc trưng của mô hình LightGBM", loc="left", pad=18)
        ax.set_xlim(0, max(values)*1.18)
        ax.xaxis.grid(True, color="#E3E9ED", linewidth=.7)
        ax.set_axisbelow(True)
        ax.tick_params(axis="both", length=0, pad=8)
        for side in ("top", "right", "left"):
            ax.spines[side].set_visible(False)
        ax.spines["bottom"].set_color("#BAC8D1")
        ax.bar_label(bars, labels=[f'{value:.2f}%'.replace(".", ",") for value in values],
                     padding=7, fontsize=11, color="#172433")
        fig.savefig(HERE/"do_quan_trong_dac_trung_gain.png", dpi=360, facecolor="white")
        plt.close(fig)

    after = manifest()
    report = dict(
        matched=sum(after.get(path) == sha for path, sha in before.items()),
        added=sorted(set(after)-set(before)), missing=sorted(set(before)-set(after)),
        changed=[path for path in before if path in after and before[path] != after[path]],
    )
    write_json(HERE/"sha256-gain-after.json", after)
    write_json(HERE/"doi_chieu_sha256_gain.json", report)
    if before != after:
        raise ValueError("Dữ liệu hoặc kết quả thực nghiệm đã thay đổi")
    print(json.dumps(dict(rows=rows, preservation=report), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
