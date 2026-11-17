"""Audit and split the original AI4I CSV using stable record identifiers."""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OUT = ROOT / "ket_qua"
TARGET = "Machine failure"
NUMERIC = ["Air temperature [K]", "Process temperature [K]", "Rotational speed [rpm]",
           "Torque [Nm]", "Tool wear [min]"]
FEATURES = ["Type", *NUMERIC]
DROPPED = ["UDI", "Product ID", "TWF", "HDF", "PWF", "OSF", "RNF"]
SEED = 42


def encoded_name(transformer_name, feature_name):
    normalized = feature_name.replace(" [", "_").replace("]", "").replace(" ", "_")
    return f"{transformer_name}_{normalized}"


def counts(frame):
    return {"rows": len(frame), "normal": int(frame[TARGET].eq(0).sum()),
            "failure": int(frame[TARGET].eq(1).sum())}


def main():
    raw = pd.read_csv(DATA / "ai4i2020.csv", encoding="utf-8-sig")
    required = ["UDI", *FEATURES, TARGET]
    if any(name not in raw for name in required):
        raise ValueError("CSV thiếu cột bắt buộc.")
    frame = raw[required]
    if (frame.isna().any().any() or not frame.UDI.is_unique
            or set(frame[TARGET]) != {0, 1}
            or not set(frame.Type).issubset({"L", "M", "H"})
            or not np.isfinite(frame[NUMERIC].to_numpy(dtype=float)).all()):
        raise ValueError("Kiểm tra UDI, dữ liệu thiếu, cột số, Type và nhãn.")
    train, rest = train_test_split(frame, test_size=.30, stratify=frame[TARGET], random_state=SEED)
    val, test = train_test_split(rest, test_size=.50, stratify=rest[TARGET], random_state=SEED)
    splits = {"train": train, "validation": val, "test": test}
    prepared = OUT / "du_lieu"
    prepared.mkdir(parents=True, exist_ok=True)
    manifest = pd.concat([part[["UDI"]].assign(split=name) for name, part in splits.items()])
    assert manifest.UDI.is_unique and set(manifest.UDI) == set(raw.UDI)
    manifest.sort_values("UDI").to_csv(prepared / "splits.csv", index=False)
    for name, part in splits.items():
        part.to_csv(prepared / f"{name}.csv", index=False)
    audit = {
        "raw_shape": list(raw.shape), "raw_counts": counts(raw),
        "missing_cells": int(raw.isna().sum().sum()), "duplicate_rows": int(raw.duplicated().sum()),
        "types": raw.dtypes.astype(str).to_dict(),
        "numeric_summary": raw[NUMERIC].describe().to_dict(),
        "seed": SEED, "features": FEATURES, "target": TARGET, "excluded_from_inputs": DROPPED,
        "splits": {name: counts(part) for name, part in splits.items()},
    }
    (prepared / "audit.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")
    print(pd.DataFrame(audit["splits"]).T.to_string())


if __name__ == "__main__":
    main()
