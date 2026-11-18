import numpy as np
import pandas as pd


FEATURE_NAMES = [
    "log_amount",
    "log_sender_history_count",
    "log_beneficiary_history_count",
    "type_CASH_IN",
    "type_CASH_OUT",
    "type_DEBIT",
    "type_PAYMENT",
    "type_TRANSFER",
]

TRANSACTION_TYPES = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]
REQUIRED_COLUMNS = ["step", "type", "amount", "nameOrig", "nameDest", "isFraud"]


def build_paysim_features(frame: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    missing = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    if missing:
        raise ValueError(f"PaySim data is missing columns: {', '.join(missing)}")
    missing_values = [
        column for column in REQUIRED_COLUMNS if frame[column].isna().any()
    ]
    if missing_values:
        raise ValueError(
            "PaySim feature columns must not contain missing values: "
            + ", ".join(missing_values)
        )

    steps = frame["step"].to_numpy(dtype=np.int32, copy=False)
    if np.any(np.diff(steps) < 0):
        raise ValueError("PaySim rows must be sorted by step")

    amounts = frame["amount"].to_numpy(dtype=np.float64, copy=False)
    if not np.isfinite(amounts).all() or np.any(amounts < 0):
        raise ValueError("PaySim amounts must be finite and non-negative")

    labels = frame["isFraud"].to_numpy(dtype=np.uint8, copy=True)
    if not np.isin(labels, [0, 1]).all():
        raise ValueError("PaySim fraud labels must be binary")

    sender_codes, _ = pd.factorize(frame["nameOrig"], sort=False)
    recipient_codes, _ = pd.factorize(frame["nameDest"], sort=False)
    if max(sender_codes.max(initial=-1), recipient_codes.max(initial=-1)) >= 2**32:
        raise ValueError("PaySim identifiers exceed the supported feature encoding")

    pair_keys = (
        sender_codes.astype(np.uint64, copy=False) << np.uint64(32)
    ) | recipient_codes.astype(np.uint64, copy=False)
    pair_codes, _ = pd.factorize(pair_keys, sort=False)
    pair_codes = pair_codes.astype(np.int32, copy=False)
    del pair_keys

    transaction_types = frame["type"]
    if isinstance(transaction_types.dtype, pd.CategoricalDtype):
        type_codes = transaction_types.cat.codes.to_numpy(copy=False)
        type_code_map = {
            value: index
            for index, value in enumerate(transaction_types.cat.categories)
        }
    else:
        type_codes, categories = pd.factorize(transaction_types, sort=False)
        type_code_map = {value: index for index, value in enumerate(categories)}

    features = np.zeros((len(frame), len(FEATURE_NAMES)), dtype=np.float32)
    features[:, 0] = np.log1p(amounts).astype(np.float32)
    for offset, transaction_type in enumerate(TRANSACTION_TYPES, start=3):
        code = type_code_map.get(transaction_type)
        if code is not None:
            features[:, offset] = type_codes == code

    sender_history = np.zeros(int(sender_codes.max(initial=-1)) + 1, dtype=np.uint32)
    pair_history = np.zeros(int(pair_codes.max(initial=-1)) + 1, dtype=np.uint32)
    boundaries = np.flatnonzero(
        np.r_[True, steps[1:] != steps[:-1], True]
    )

    for start, end in zip(boundaries[:-1], boundaries[1:]):
        current_senders = sender_codes[start:end]
        current_pairs = pair_codes[start:end]

        features[start:end, 1] = np.log1p(sender_history[current_senders])
        features[start:end, 2] = np.log1p(pair_history[current_pairs])

        unique_senders, sender_counts = np.unique(
            current_senders, return_counts=True
        )
        sender_history[unique_senders] += sender_counts.astype(np.uint32)

        unique_pairs, pair_counts = np.unique(current_pairs, return_counts=True)
        pair_history[unique_pairs] += pair_counts.astype(np.uint32)

    return features, labels
