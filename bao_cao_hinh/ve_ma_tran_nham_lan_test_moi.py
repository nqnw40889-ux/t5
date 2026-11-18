"""Plot the saved Test confusion matrix without training or changing results."""
from pathlib import Path
import csv
import hashlib
import json
import sys

sys.dont_write_bytecode = True
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def manifest():
    return {
        p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for folder in ("data", "ket_qua")
        for p in (ROOT / folder).rglob("*") if p.is_file()
    }


def save_json(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)


def main():
    image_path = HERE / "ma_tran_nham_lan_test_moi.png"
    evidence_path = HERE / "doi_chieu_ma_tran_nham_lan_test_moi.json"
    after_path = HERE / "sha256-confusion-after.json"
    integrity_path = HERE / "doi_chieu_sha256_confusion.json"
    for path in (image_path, evidence_path, after_path, integrity_path):
        if path.exists():
            raise FileExistsError(f"Không ghi đè tệp đã có: {path}")
    before_path = HERE / "sha256-confusion-before.json"
    before = manifest()
    if before_path.exists():
        original = json.loads(before_path.read_text(encoding="utf-8-sig"))
        if original != before:
            raise ValueError("Tệp bảo vệ khác bản SHA-256 trước sửa; dừng xuất hình.")
    else:
        save_json(before_path, before)

    results = json.loads((ROOT / "ket_qua/thuc_nghiem/ket_qua.json").read_text(encoding="utf-8-sig"))
    winner, test = results["winner"], results["winner_test"]
    threshold = float(test["threshold"])
    assert threshold == float(winner["threshold"]), "Ngưỡng winner và winner_test không khớp."
    assert np.isfinite(threshold)
    with (ROOT / "ket_qua/thuc_nghiem/du_doan_test.csv").open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    counts = dict.fromkeys(("tn", "fp", "fn", "tp"), 0)
    keys = {(0, 0): "tn", (0, 1): "fp", (1, 0): "fn", (1, 1): "tp"}
    for row in rows:
        actual, predicted = int(row["Machine failure"]), int(row["du_doan_hong"])
        score = float(row["diem_hong"])
        assert np.isfinite(score), "CSV chứa điểm không hữu hạn."
        assert int(score >= threshold) == predicted, "Nhãn CSV không khớp điểm và ngưỡng."
        counts[keys[(actual, predicted)]] += 1
    expected = {"tn": 1437, "fp": 12, "fn": 12, "tp": 39}
    if counts != expected or len(rows) != 1500 or any(counts[k] != test[k] for k in counts):
        raise ValueError(f"Số liệu khác yêu cầu; dừng xuất hình. CSV: {counts}, N={len(rows)}; winner_test: {test}")
    if threshold != 0.31537755439431603:
        raise ValueError(f"Ngưỡng khác giá trị dự kiến; dừng xuất hình: {threshold!r}")
    assert (winner["model"], winner["profile"], winner["method"]) == ("LightGBM", 3, "baseline")

    matrix = np.array([[counts["tn"], counts["fp"]], [counts["fn"], counts["tp"]]])
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 12, "text.color": "#12263B", "axes.labelcolor": "#12263B"})
    fig, ax = plt.subplots(figsize=(11, 8.2), facecolor="white")
    fig.subplots_adjust(left=0.20, right=0.85, bottom=0.16, top=0.80)
    im = ax.imshow(matrix, cmap="Blues", vmin=0, vmax=int(matrix.max()), interpolation="nearest")
    colorbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.045)
    colorbar.set_label("Số mẫu", fontsize=12, labelpad=10)
    colorbar.outline.set_visible(False)
    labels = ["0 — Không hỏng", "1 — Có hỏng"]
    ax.set_xticks([0, 1], labels, fontsize=12, fontweight="bold")
    ax.set_yticks([0, 1], labels, fontsize=12, fontweight="bold")
    ax.set_xlabel("Nhãn dự đoán", fontsize=14, fontweight="bold", labelpad=16)
    ax.set_ylabel("Nhãn thực tế", fontsize=14, fontweight="bold", labelpad=18)
    ax.tick_params(axis="both", length=0, pad=12)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_xticks([0.5], minor=True)
    ax.set_yticks([0.5], minor=True)
    ax.grid(which="minor", color="white", linewidth=3)
    ax.tick_params(which="minor", bottom=False, left=False)
    descriptions = [["Phân loại đúng không hỏng", "Cảnh báo nhầm"], ["Bỏ sót hỏng hóc", "Phát hiện đúng hỏng hóc"]]
    codes = [["TN", "FP"], ["FN", "TP"]]
    for i in range(2):
        for j in range(2):
            color = "white" if im.norm(matrix[i, j]) > 0.5 else "#102C48"
            number = f"{matrix[i, j]:,}".replace(",", ".")
            ax.text(j, i - 0.08, f"{codes[i][j]} = {number}", ha="center", va="center", color=color, fontsize=20, fontweight="bold")
            ax.text(j, i + 0.12, f"({descriptions[i][j]})", ha="center", va="center", color=color, fontsize=10.5, fontweight="bold")
    n_display = f"{len(rows):,}".replace(",", ".")
    threshold_display = f"{threshold * 100:.2f}".replace(".", ",")
    fig.suptitle(
        f"Ma trận nhầm lẫn trên tập Test (N = {n_display}, ngưỡng = {threshold_display}%)\n"
        f"{winner['model']} — Cấu hình {winner['profile']} {winner['method']}",
        fontsize=16, fontweight="bold", y=0.94, linespacing=1.7,
    )
    fig.savefig(image_path, dpi=360, facecolor="white")
    plt.close(fig)
    save_json(evidence_path, {"source_json": "ket_qua/thuc_nghiem/ket_qua.json", "source_csv": "ket_qua/thuc_nghiem/du_doan_test.csv", "winner_test": test, "csv_counts": counts, "N": len(rows), "threshold_full_precision": threshold, "threshold_display_percent": threshold_display, "score_label_mismatches": 0})
    after = manifest()
    save_json(after_path, after)
    integrity = {"matched": sum(before[p] == after[p] for p in before.keys() & after.keys()), "added": sorted(after.keys() - before.keys()), "missing": sorted(before.keys() - after.keys()), "changed": sorted(p for p in before.keys() & after.keys() if before[p] != after[p])}
    save_json(integrity_path, integrity)
    assert before == after, "Danh sách hoặc SHA-256 tệp bảo vệ đã thay đổi."
    print(json.dumps({"counts": counts, "N": len(rows), "threshold": threshold, "integrity": integrity}, ensure_ascii=False))


if __name__ == "__main__":
    main()
