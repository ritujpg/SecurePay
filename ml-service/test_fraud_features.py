import unittest

import numpy as np
import pandas as pd

from fraud_features import FEATURE_NAMES, build_paysim_features


class FraudFeatureTests(unittest.TestCase):
    def test_features_use_only_payment_and_prior_history_data(self):
        frame = pd.DataFrame({
            "step": [1, 1, 2, 2],
            "type": ["TRANSFER", "TRANSFER", "TRANSFER", "PAYMENT"],
            "amount": [10.0, 20.0, 30.0, 40.0],
            "nameOrig": ["A", "A", "A", "A"],
            "nameDest": ["B", "C", "B", "C"],
            "isFraud": [0, 0, 1, 0],
            "oldbalanceOrg": [100, 90, 70, 40],
            "isFlaggedFraud": [0, 0, 0, 0],
        })

        features, labels = build_paysim_features(frame)

        self.assertEqual(list(FEATURE_NAMES), [
            "log_amount",
            "log_sender_history_count",
            "log_beneficiary_history_count",
            "type_CASH_IN",
            "type_CASH_OUT",
            "type_DEBIT",
            "type_PAYMENT",
            "type_TRANSFER",
        ])
        self.assertEqual(features.shape, (4, len(FEATURE_NAMES)))
        self.assertEqual(labels.tolist(), [0, 0, 1, 0])
        self.assertEqual(features[0, 2], 0)
        self.assertEqual(features[1, 2], 0)
        self.assertAlmostEqual(float(features[2, 1]), 1.0986123, places=5)
        self.assertAlmostEqual(float(features[2, 2]), 0.6931472, places=5)
        self.assertAlmostEqual(float(features[3, 2]), 0.6931472, places=5)
        self.assertEqual(float(features[0, 7]), 1)
        self.assertEqual(float(features[3, 6]), 1)

    def test_same_step_rows_are_not_assumed_to_have_an_order(self):
        frame = pd.DataFrame({
            "step": [1, 1, 2, 3],
            "type": ["TRANSFER"] * 4,
            "amount": [10.0, 20.0, 30.0, 40.0],
            "nameOrig": ["A"] * 4,
            "nameDest": ["B"] * 4,
            "isFraud": [0, 0, 0, 0],
        })

        features, _ = build_paysim_features(frame)

        self.assertEqual(features[0, 1], 0)
        self.assertEqual(features[1, 1], 0)
        self.assertAlmostEqual(float(features[2, 1]), float(np.log1p(2)))
        self.assertAlmostEqual(float(features[3, 1]), float(np.log1p(3)))
        self.assertAlmostEqual(float(features[2, 2]), float(np.log1p(2)))
        self.assertAlmostEqual(float(features[3, 2]), float(np.log1p(3)))

    def test_history_counts_earlier_steps_across_hour_day_week_and_older_periods(self):
        frame = pd.DataFrame({
            "step": [1, 26, 170, 193, 194, 194],
            "type": ["TRANSFER"] * 6,
            "amount": [10.0] * 6,
            "nameOrig": ["A"] * 6,
            "nameDest": ["B"] * 6,
            "isFraud": [0] * 6,
        })

        features, _ = build_paysim_features(frame)

        self.assertAlmostEqual(float(features[4, 1]), float(np.log1p(4)))
        self.assertAlmostEqual(float(features[4, 2]), float(np.log1p(4)))
        self.assertAlmostEqual(float(features[5, 1]), float(np.log1p(4)))
        self.assertAlmostEqual(float(features[5, 2]), float(np.log1p(4)))

    def test_feature_values_match_equivalent_securepay_hourly_fixture(self):
        frame = pd.DataFrame({
            "step": [1, 1, 2, 3],
            "type": ["TRANSFER"] * 4,
            "amount": [100.0] * 4,
            "nameOrig": ["A"] * 4,
            "nameDest": ["B"] * 4,
            "isFraud": [0] * 4,
        })

        features, _ = build_paysim_features(frame)

        self.assertAlmostEqual(float(features[3, 0]), float(np.log1p(100)), places=6)
        self.assertAlmostEqual(float(features[3, 1]), float(np.log1p(3)), places=6)
        self.assertAlmostEqual(float(features[3, 2]), float(np.log1p(3)), places=6)
        self.assertEqual(float(features[3, 7]), 1)
        self.assertEqual(float(features[3, 6]), 0)

    def test_rejects_unsorted_steps_to_prevent_future_history_leakage(self):
        frame = pd.DataFrame({
            "step": [2, 1],
            "type": ["TRANSFER", "TRANSFER"],
            "amount": [10.0, 20.0],
            "nameOrig": ["A", "A"],
            "nameDest": ["B", "B"],
            "isFraud": [0, 1],
        })

        with self.assertRaisesRegex(ValueError, "sorted by step"):
            build_paysim_features(frame)

    def test_rejects_missing_payment_inputs(self):
        frame = pd.DataFrame({
            "step": [1],
            "type": ["TRANSFER"],
            "amount": [10.0],
            "nameOrig": ["A"],
            "nameDest": [None],
            "isFraud": [0],
        })

        with self.assertRaisesRegex(ValueError, "missing values"):
            build_paysim_features(frame)


if __name__ == "__main__":
    unittest.main()
