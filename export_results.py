"""Export the chosen pipeline, full comparisons, and final Test predictions."""
import json

import joblib
import numpy as np
import pandas as pd

from model_helpers import MODELS, build_pipeline, choose_threshold, evaluate, save_figures
from preprocess import DATA, OUT, TARGET

RESULTS = OUT / "thuc_nghiem"


def export_results(review):
    RESULTS.mkdir(parents=True, exist_ok=True)
    winner = review["winner"]
    inputs = winner["columns"]
    train, validation, test = (
        pd.read_csv(OUT / "du_lieu" / f"{split}.csv")
        for split in ("train", "validation", "test")
    )
    estimator = build_pipeline(
        winner["model"], MODELS[winner["model"]][0], winner["method"], winner["params"]
    )
    estimator.fit(train[inputs], train[TARGET])
    validation_scores = estimator.predict_proba(validation[inputs])[:, 1]
    threshold, threshold_table = choose_threshold(validation[TARGET], validation_scores)
    scores = estimator.predict_proba(test[inputs])[:, 1]
    if not np.isclose(threshold, winner["threshold"], rtol=0, atol=1e-12):
        raise ValueError("Ngưỡng chạy lại khác ngưỡng đã chọn.")
    if evaluate(test[TARGET], scores, threshold) != review["winner_test"]:
        raise ValueError("Kết quả Test chạy lại khác kết quả đã ghi.")

    joblib.dump(estimator, RESULTS / "pipeline.joblib", compress=3)
    (RESULTS / "ket_qua.json").write_text(
        json.dumps(review, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    configurations = pd.json_normalize(review["all_configurations"], sep="_")
    configurations["selected"] = [
        (row["model"], row["profile"], row["method"])
        == (winner["model"], winner["profile"], winner["method"])
        for row in review["all_configurations"]
    ]
    configurations.to_csv(RESULTS / "so_sanh_40_cau_hinh.csv", index=False, encoding="utf-8-sig")
    threshold_table.to_csv(RESULTS / "quet_nguong_validation.csv", index=False)
    modes = ["TWF", "HDF", "PWF", "OSF", "RNF"]
    reference = pd.read_csv(DATA / "ai4i2020.csv", usecols=["UDI", *modes])
    prediction = test.assign(
        diem_hong=scores, du_doan_hong=(scores >= threshold).astype(int)
    ).merge(reference, on="UDI", validate="one_to_one")
    prediction.to_csv(RESULTS / "du_doan_test.csv", index=False)
    prediction.loc[prediction[TARGET] != prediction["du_doan_hong"]].to_csv(
        RESULTS / "du_doan_sai.csv", index=False
    )
    save_figures(test, scores, threshold, RESULTS)


if __name__ == "__main__":
    export_results(json.loads((RESULTS / "ket_qua.json").read_text(encoding="utf-8")))
