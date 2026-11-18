import gc
import json
import os
import sys
import tempfile
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.isotonic import IsotonicRegression
from xgboost import XGBClassifier


SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))
from fraud_features import FEATURE_NAMES, REQUIRED_COLUMNS, build_paysim_features  # noqa: E402

DATA_PATH = SERVICE_DIR / "training" / "data" / "paysim.csv"
MODEL_DIR = SERVICE_DIR / "models"
RANDOM_STATE = 42
ARTIFACTS = {
    "Random Forest": MODEL_DIR / "paysim_random_forest_v2.joblib",
    "Isolation Forest": MODEL_DIR / "paysim_isolation_forest_v2.joblib",
    "XGBoost": MODEL_DIR / "paysim_xgboost_v2.joblib",
}
EVALUATION_PATH = MODEL_DIR / "paysim_fraud_evaluation_v2.json"


def expected_calibration_error(labels: np.ndarray, scores: np.ndarray, bins: int = 10) -> float:
    edges = np.linspace(0.0, 1.0, bins + 1)
    error = 0.0
    for index in range(bins):
        in_bin = (scores >= edges[index]) & (
            scores <= edges[index + 1] if index == bins - 1 else scores < edges[index + 1]
        )
        if np.any(in_bin):
            error += float(np.mean(in_bin)) * abs(
                float(np.mean(labels[in_bin])) - float(np.mean(scores[in_bin]))
            )
    return error


def calibration_metrics(labels: np.ndarray, scores: np.ndarray) -> dict[str, float]:
    return {
        "brier_score": float(brier_score_loss(labels, scores)),
        "expected_calibration_error_10_bins": expected_calibration_error(labels, scores),
    }


def compare_isotonic_calibration(
    calibration_labels: np.ndarray,
    calibration_scores: np.ndarray,
    evaluation_labels: np.ndarray,
    evaluation_scores: np.ndarray,
) -> dict[str, dict[str, float]]:
    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(calibration_scores, calibration_labels)
    calibrated_scores = calibrator.predict(evaluation_scores)
    return {
        "uncalibrated": calibration_metrics(evaluation_labels, evaluation_scores),
        "isotonic_diagnostic": calibration_metrics(evaluation_labels, calibrated_scores),
    }


def choose_threshold(labels: np.ndarray, scores: np.ndarray) -> float:
    precision, recall, thresholds = precision_recall_curve(labels, scores)
    if not len(thresholds):
        raise ValueError("Cannot select a decision threshold without validation rows")
    denominator = precision[:-1] + recall[:-1]
    f1 = np.divide(
        2 * precision[:-1] * recall[:-1],
        denominator,
        out=np.zeros_like(denominator),
        where=denominator != 0,
    )
    return float(thresholds[int(np.argmax(f1))])


def evaluate(
    labels: np.ndarray,
    scores: np.ndarray,
    threshold: float,
    include_calibration: bool = True,
) -> dict[str, object]:
    predictions = scores >= threshold
    matrix = confusion_matrix(labels, predictions, labels=[0, 1])
    metrics: dict[str, object] = {
        "rows": int(len(labels)),
        "fraud_rows": int(labels.sum()),
        "precision_recall_auc": float(average_precision_score(labels, scores)),
        "roc_auc": float(roc_auc_score(labels, scores)),
        "threshold": threshold,
        "precision": float(precision_score(labels, predictions, zero_division=0)),
        "recall": float(recall_score(labels, predictions, zero_division=0)),
        "f1": float(f1_score(labels, predictions, zero_division=0)),
        "confusion_matrix": {
            "true_negative": int(matrix[0, 0]),
            "false_positive": int(matrix[0, 1]),
            "false_negative": int(matrix[1, 0]),
            "true_positive": int(matrix[1, 1]),
        },
    }
    if include_calibration:
        metrics.update(calibration_metrics(labels, scores))
    return metrics


def save_artifact(path: Path, payload: dict[str, object]) -> None:
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=path.parent,
            prefix=f".{path.stem}-",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
        joblib.dump(payload, temporary_path, compress=3)
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def fit_random_forest(
    features: np.ndarray,
    labels: np.ndarray,
    train_indices: np.ndarray,
    validation_features: np.ndarray,
    validation_labels: np.ndarray,
    calibration_features: np.ndarray,
    calibration_labels: np.ndarray,
    calibration_evaluation_features: np.ndarray,
    calibration_evaluation_labels: np.ndarray,
) -> tuple[dict[str, object], dict[str, object]]:
    train_labels = labels[train_indices]
    positive_indices = train_indices[train_labels == 1]
    negative_indices = train_indices[train_labels == 0]
    if len(positive_indices) == 0 or len(negative_indices) == 0:
        raise ValueError("Random Forest training requires both classes")
    negative_limit = min(len(negative_indices), len(positive_indices) * 100)
    rng = np.random.default_rng(RANDOM_STATE)
    sampled_negatives = rng.choice(negative_indices, size=negative_limit, replace=False)
    sampled_indices = np.concatenate((positive_indices, sampled_negatives))
    rng.shuffle(sampled_indices)

    model = RandomForestClassifier(
        n_estimators=120,
        max_depth=16,
        min_samples_leaf=2,
        max_features="sqrt",
        max_samples=0.8,
        class_weight=None,
        n_jobs=min(8, os.cpu_count() or 1),
        random_state=RANDOM_STATE,
    )
    model.fit(features[sampled_indices], labels[sampled_indices])
    positive_class = list(model.classes_).index(1)
    validation_scores = model.predict_proba(validation_features)[:, positive_class]
    threshold = choose_threshold(validation_labels, validation_scores)
    validation_metrics = evaluate(
        validation_labels, validation_scores, threshold, include_calibration=False
    )
    calibration_scores = model.predict_proba(calibration_features)[:, positive_class]
    calibration_evaluation_scores = model.predict_proba(calibration_evaluation_features)[:, positive_class]

    payload: dict[str, object] = {
        "model": model,
        "feature_names": FEATURE_NAMES,
        "decision_threshold": threshold,
        "model_name": "PaySim Random Forest",
        "version": 2,
        "training_rows": int(len(train_indices)),
        "training_sample_rows": int(len(sampled_indices)),
        "negative_sampling_ratio": 100,
        "class_weight": None,
        "validation_metrics": validation_metrics,
        "calibration_diagnostics": compare_isotonic_calibration(
            calibration_labels,
            calibration_scores,
            calibration_evaluation_labels,
            calibration_evaluation_scores,
        ),
    }
    return payload, validation_metrics


def fit_xgboost(
    features: np.ndarray,
    labels: np.ndarray,
    train_indices: np.ndarray,
    validation_features: np.ndarray,
    validation_labels: np.ndarray,
    calibration_features: np.ndarray,
    calibration_labels: np.ndarray,
    calibration_evaluation_features: np.ndarray,
    calibration_evaluation_labels: np.ndarray,
) -> tuple[dict[str, object], dict[str, object]]:
    train_labels = labels[train_indices]
    positive_count = int(train_labels.sum())
    negative_count = int(len(train_labels) - positive_count)
    if positive_count == 0 or negative_count == 0:
        raise ValueError("XGBoost training requires both classes")

    model = XGBClassifier(
        n_estimators=120,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.9,
        reg_lambda=2.0,
        scale_pos_weight=1,
        objective="binary:logistic",
        eval_metric="aucpr",
        tree_method="hist",
        n_jobs=min(8, os.cpu_count() or 1),
        random_state=RANDOM_STATE,
        verbosity=0,
    )
    model.fit(features[train_indices], train_labels, verbose=False)
    positive_class = list(model.classes_).index(1)
    validation_scores = model.predict_proba(validation_features)[:, positive_class]
    threshold = choose_threshold(validation_labels, validation_scores)
    validation_metrics = evaluate(
        validation_labels, validation_scores, threshold, include_calibration=False
    )
    calibration_scores = model.predict_proba(calibration_features)[:, positive_class]
    calibration_evaluation_scores = model.predict_proba(calibration_evaluation_features)[:, positive_class]

    payload: dict[str, object] = {
        "model": model,
        "feature_names": FEATURE_NAMES,
        "decision_threshold": threshold,
        "model_name": "PaySim XGBoost",
        "version": 2,
        "training_rows": int(len(train_indices)),
        "scale_pos_weight": 1,
        "validation_metrics": validation_metrics,
        "calibration_diagnostics": compare_isotonic_calibration(
            calibration_labels,
            calibration_scores,
            calibration_evaluation_labels,
            calibration_evaluation_scores,
        ),
    }
    return payload, validation_metrics


def fit_isolation_forest(
    features: np.ndarray,
    labels: np.ndarray,
    train_indices: np.ndarray,
    validation_features: np.ndarray,
    validation_labels: np.ndarray,
) -> tuple[dict[str, object], dict[str, object]]:
    legitimate_indices = train_indices[labels[train_indices] == 0]
    if len(legitimate_indices) == 0:
        raise ValueError("Isolation Forest requires legitimate training rows")

    rng = np.random.default_rng(RANDOM_STATE)
    sample_indices = rng.choice(
        legitimate_indices,
        size=min(200_000, len(legitimate_indices)),
        replace=False,
    )
    model = IsolationForest(
        n_estimators=100,
        max_samples="auto",
        contamination="auto",
        n_jobs=min(8, os.cpu_count() or 1),
        random_state=RANDOM_STATE,
    )
    model.fit(features[sample_indices])
    validation_scores = -model.decision_function(validation_features)
    threshold = choose_threshold(validation_labels, validation_scores)
    validation_metrics = evaluate(
        validation_labels, validation_scores, threshold, include_calibration=False
    )

    payload: dict[str, object] = {
        "model": model,
        "feature_names": FEATURE_NAMES,
        "decision_threshold": threshold,
        "model_name": "PaySim Isolation Forest",
        "version": 2,
        "training_rows": int(len(sample_indices)),
        "validation_metrics": validation_metrics,
    }
    return payload, validation_metrics


def main() -> None:
    if not DATA_PATH.is_file():
        raise FileNotFoundError(f"PaySim dataset not found: {DATA_PATH}")
    existing = [path for path in [*ARTIFACTS.values(), EVALUATION_PATH] if path.exists()]
    if existing:
        raise FileExistsError(
            "Refusing to overwrite existing model output: "
            + ", ".join(str(path) for path in existing)
        )

    frame = pd.read_csv(
        DATA_PATH,
        usecols=REQUIRED_COLUMNS,
        dtype={
            "step": "int16",
            "type": "category",
            "amount": "float32",
            "nameOrig": "category",
            "nameDest": "category",
            "isFraud": "int8",
        },
    )
    features, labels = build_paysim_features(frame)
    row_count = len(frame)
    steps = frame["step"].to_numpy(dtype=np.int16, copy=True)
    maximum_step = int(steps.max())
    del frame
    gc.collect()
    train_end = round(maximum_step * 0.6)
    calibration_end = round(maximum_step * 0.7)
    validation_end = round(maximum_step * 0.8)
    train_indices = np.flatnonzero(steps <= train_end)
    calibration_indices = np.flatnonzero(
        (steps > train_end) & (steps <= calibration_end)
    )
    validation_indices = np.flatnonzero(
        (steps > calibration_end) & (steps <= validation_end)
    )
    test_indices = np.flatnonzero(steps > validation_end)
    if not len(train_indices) or not len(calibration_indices) or not len(validation_indices) or not len(test_indices):
        raise ValueError("Chronological train, calibration, validation, and test splits must be non-empty")

    calibration_features = features[calibration_indices]
    calibration_labels = labels[calibration_indices]
    validation_features = features[validation_indices]
    validation_labels = labels[validation_indices]
    test_features = features[test_indices]
    test_labels = labels[test_indices]
    if any(len(np.unique(split_labels)) != 2 for split_labels in (
        calibration_labels, validation_labels, test_labels
    )):
        raise ValueError("Calibration, validation, and test periods must each contain both classes")

    split_summary = {
        "train": {
            "first_step": int(steps[train_indices[0]]),
            "last_step": int(steps[train_indices[-1]]),
            "rows": int(len(train_indices)),
            "fraud_rows": int(labels[train_indices].sum()),
        },
        "validation": {
            "first_step": int(steps[validation_indices[0]]),
            "last_step": int(steps[validation_indices[-1]]),
            "rows": int(len(validation_indices)),
            "fraud_rows": int(validation_labels.sum()),
        },
        "calibration": {
            "first_step": int(steps[calibration_indices[0]]),
            "last_step": int(steps[calibration_indices[-1]]),
            "rows": int(len(calibration_indices)),
            "fraud_rows": int(calibration_labels.sum()),
        },
        "test": {
            "first_step": int(steps[test_indices[0]]),
            "last_step": int(steps[test_indices[-1]]),
            "rows": int(len(test_indices)),
            "fraud_rows": int(test_labels.sum()),
        },
    }
    print(
        f"Loaded {row_count:,} rows; fraud rate "
        f"{labels.mean():.6%}; chronological splits {split_summary}",
        flush=True,
    )

    models: dict[str, dict[str, object]] = {}
    pending_artifacts: dict[str, dict[str, object]] = {}
    for name, trainer in (
        ("Random Forest", fit_random_forest),
        ("Isolation Forest", fit_isolation_forest),
        ("XGBoost", fit_xgboost),
    ):
        print(f"Training {name}...", flush=True)
        trainer_arguments = (
            features,
            labels,
            train_indices,
            validation_features,
            validation_labels,
        )
        if name == "Isolation Forest":
            artifact, validation_metrics = trainer(*trainer_arguments)
        else:
            artifact, validation_metrics = trainer(
                *trainer_arguments,
                calibration_features,
                calibration_labels,
                validation_features,
                validation_labels,
            )
        model = artifact["model"]
        if name == "Isolation Forest":
            test_scores = -model.decision_function(test_features)
        else:
            positive_class = list(model.classes_).index(1)
            test_scores = model.predict_proba(test_features)[:, positive_class]
        threshold = float(artifact["decision_threshold"])
        test_metrics = evaluate(
            test_labels,
            test_scores,
            threshold,
            include_calibration=name != "Isolation Forest",
        )
        artifact["test_metrics"] = test_metrics
        models[name] = {
            "validation": validation_metrics,
            "test": test_metrics,
        }
        if name != "Isolation Forest":
            calibration_scores = model.predict_proba(calibration_features)[:, positive_class]
            calibrator = IsotonicRegression(out_of_bounds="clip")
            calibrator.fit(calibration_scores, calibration_labels)
            models[name]["calibration_validation"] = artifact["calibration_diagnostics"]
            models[name]["calibration_test"] = {
                "uncalibrated": calibration_metrics(test_labels, test_scores),
                "isotonic_diagnostic": calibration_metrics(
                    test_labels, calibrator.predict(test_scores)
                ),
            }
        pending_artifacts[name] = artifact
        print(
            f"{name}: validation PR-AUC={validation_metrics['precision_recall_auc']:.6f}; "
            f"test PR-AUC={test_metrics['precision_recall_auc']:.6f}; "
            f"test precision={test_metrics['precision']:.6f}; "
            f"test recall={test_metrics['recall']:.6f}",
            flush=True,
        )
        del model, test_scores
        gc.collect()

    for name, artifact in pending_artifacts.items():
        save_artifact(ARTIFACTS[name], artifact)

    evaluation = {
        "dataset": "PaySim synthetic mobile money transactions",
        "rows": int(row_count),
        "fraud_rows": int(labels.sum()),
        "fraud_rate": float(labels.mean()),
        "features": FEATURE_NAMES,
        "excluded_predictors": ["nameOrig", "nameDest", "isFraud", "isFlaggedFraud", "balance fields"],
        "time_feature": "No hour-of-day feature is used; PaySim steps are simulation-hour buckets and SecurePay timestamps are UTC-hour buckets with no known epoch alignment.",
        "history_definition": "Count all prior transactions regardless of status; only strictly earlier hour buckets count. Rows within the current PaySim step are excluded because their order is unknown.",
        "class_imbalance_treatment": "Random Forest retains all positives and randomly downsamples negatives to at most 100 per positive, with no additional class weighting. XGBoost scale_pos_weight is 1.",
        "scores_are_calibrated_probabilities": False,
        "splits": split_summary,
        "models": models,
        "limitations": [
            "PaySim is synthetic and is not representative evidence of real UPI fraud performance.",
            "The PaySim amount scale and transaction mix may differ from SecurePay usage.",
            "The dataset does not label recipient trust, device, location, or beneficiary identity risk.",
            "The reported holdout is from the same synthetic simulator and is not an external validation set.",
            "The hourly history window boundaries cannot be aligned exactly because PaySim's first simulation step has no known UTC offset.",
            "Isotonic calibration diagnostics are fit on a separate chronological calibration period and measured on later validation and test periods; production scores remain uncalibrated.",
        ],
    }
    with EVALUATION_PATH.open("x", encoding="utf-8") as evaluation_file:
        json.dump(evaluation, evaluation_file, indent=2)
        evaluation_file.write("\n")

    del features, labels, steps
    print(f"Evaluation written to {EVALUATION_PATH}", flush=True)


if __name__ == "__main__":
    main()
