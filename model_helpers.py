"""Tune and compare four classifiers, then evaluate one frozen pipeline."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTENC
from imblearn.pipeline import Pipeline
from lightgbm import LGBMClassifier
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, classification_report,
                             ConfusionMatrixDisplay, confusion_matrix, precision_recall_curve)
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

from preprocess import FEATURES, NUMERIC, SEED, TARGET, encoded_name

MODELS = {
    "Logistic Regression": (LogisticRegression(max_iter=1000, random_state=SEED),
                            [{"C": .1}, {"C": 1}]),
    "Random Forest": (RandomForestClassifier(n_estimators=120, n_jobs=2, random_state=SEED),
                      [{"max_depth": 6, "min_samples_leaf": 10}, {"max_depth": 12, "min_samples_leaf": 6}]),
    "XGBoost": (XGBClassifier(learning_rate=.06, tree_method="hist", n_jobs=2, random_state=SEED),
                [{"max_depth": 3, "n_estimators": 150, "min_child_weight": 4, "reg_lambda": 4},
                 {"max_depth": 5, "n_estimators": 220, "min_child_weight": 2, "reg_lambda": 2}]),
    "LightGBM": (LGBMClassifier(learning_rate=.05, verbosity=-1, n_jobs=2, random_state=SEED,
                               deterministic=True, force_col_wise=True),
                 [{"max_depth": 3, "num_leaves": 7, "n_estimators": 170, "min_child_samples": 30,
                   "reg_lambda": 4},
                  {"max_depth": 5, "num_leaves": 15, "n_estimators": 220, "min_child_samples": 20,
                   "reg_lambda": 2}]),
}
def build_pipeline(name, model, strategy, params):
    model = clone(model).set_params(**params)
    if strategy == "class_weight":
        weights = {"scale_pos_weight": 5} if name == "XGBoost" else {"class_weight": {0: 1, 1: 5}}
        model.set_params(**weights)
    scale = StandardScaler() if name == "Logistic Regression" or strategy == "smotenc_25" else "passthrough"
    prepare = ColumnTransformer(
        [("numeric", scale, NUMERIC), ("type", "passthrough", ["Type"])],
        verbose_feature_names_out=False,
    ).set_output(transform="pandas")
    samplers = {
        "smotenc_25": SMOTENC(categorical_features=["Type"], sampling_strategy=.25, random_state=SEED),
    }
    encode = ColumnTransformer([
        ("numeric", "passthrough", NUMERIC),
        ("type", OneHotEncoder(handle_unknown="error", sparse_output=False), ["Type"]),
    ], verbose_feature_names_out=encoded_name).set_output(transform="pandas")
    return Pipeline([("prepare", prepare), ("sample", samplers.get(strategy, "passthrough")),
                     ("encode", encode), ("model", model)])


def choose_threshold(labels, scores):
    precision, recall, thresholds = precision_recall_curve(labels, scores)
    precision, recall = precision[:-1], recall[:-1]
    f1 = np.divide(2*precision*recall, precision+recall, out=np.zeros_like(precision),
                   where=(precision+recall) != 0)
    index = max(range(len(thresholds)), key=lambda i: (f1[i], recall[i], thresholds[i]))
    return float(thresholds[index]), pd.DataFrame({"threshold": thresholds, "precision": precision,
                                                   "recall": recall, "f1": f1})


def evaluate(labels, scores, threshold):
    pred = (scores >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(labels, pred, labels=[0, 1]).ravel()
    metrics = classification_report(labels, pred, labels=[0, 1], output_dict=True, zero_division=0)
    positive = metrics["1"]
    return {"threshold": threshold, "ap": float(average_precision_score(labels, scores)),
            "precision": positive["precision"], "recall": positive["recall"], "f1": positive["f1-score"],
            "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}


def save_figures(test, scores, threshold, dest):
    precision, recall, _ = precision_recall_curve(test[TARGET], scores)
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.step(recall, precision, where="post", color="#226F69")
    ax.axhline(test[TARGET].mean(), linestyle="--", color="#606972", label="Tỷ lệ mẫu hỏng")
    ax.set(xlabel="Recall", ylabel="Precision", title="Đường Precision–Recall trên Test",
           xlim=(0, 1), ylim=(0, 1.03))
    ax.legend()
    fig.savefig(dest / "precision_recall_test.png", dpi=180, bbox_inches="tight")
    plt.close(fig)
    fig, ax = plt.subplots(figsize=(5, 4))
    ConfusionMatrixDisplay.from_predictions(test[TARGET], (scores >= threshold).astype(int),
                                            display_labels=["Bình thường", "Hỏng"], cmap="Blues",
                                            colorbar=False, ax=ax)
    ax.set(xlabel="Dự đoán", ylabel="Nhãn thật", title="Ma trận nhầm lẫn trên Test")
    fig.savefig(dest / "ma_tran_nham_lan.png", dpi=180, bbox_inches="tight")
    plt.close(fig)


