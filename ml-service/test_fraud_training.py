import unittest

import numpy as np

from training.train_fraud import (
    calibration_metrics,
    choose_threshold,
    compare_isotonic_calibration,
)


class FraudTrainingMetricTests(unittest.TestCase):
    def test_selects_threshold_from_the_supplied_validation_scores(self):
        labels = np.array([0, 0, 1, 1])
        scores = np.array([0.1, 0.2, 0.7, 0.9])

        threshold = choose_threshold(labels, scores)

        self.assertGreaterEqual(threshold, 0.2)
        self.assertLessEqual(threshold, 0.9)

    def test_calibration_metrics_are_reported_without_claiming_calibration(self):
        metrics = calibration_metrics(
            np.array([0, 1]),
            np.array([0.1, 0.9]),
        )

        self.assertAlmostEqual(metrics["brier_score"], 0.01)
        self.assertAlmostEqual(metrics["expected_calibration_error_10_bins"], 0.1)

    def test_isotonic_diagnostic_fits_only_the_calibration_period(self):
        calibration_labels = np.array([0, 0, 1, 1])
        calibration_scores = np.array([0.1, 0.2, 0.7, 0.8])
        validation_labels = np.array([0, 1])
        validation_scores = np.array([0.35, 0.65])

        metrics = compare_isotonic_calibration(
            calibration_labels,
            calibration_scores,
            validation_labels,
            validation_scores,
        )

        self.assertEqual(set(metrics), {"uncalibrated", "isotonic_diagnostic"})
        self.assertIn("brier_score", metrics["uncalibrated"])
        self.assertIn("expected_calibration_error_10_bins", metrics["isotonic_diagnostic"])


if __name__ == "__main__":
    unittest.main()
