import unittest

from app import app, get_model_status


TRANSACTION_FEATURES = {
    "log_amount": 4.61512051684126,
    "log_sender_history_count": 0,
    "log_beneficiary_history_count": 0,
    "type_CASH_IN": 0,
    "type_CASH_OUT": 0,
    "type_DEBIT": 0,
    "type_PAYMENT": 0,
    "type_TRANSFER": 1,
}


class ModelApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_health_reports_independent_model_availability(self):
        response = self.client.get("/health")
        status = get_model_status()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "ok")
        self.assertTrue(status["Random Forest"])
        self.assertTrue(status["Isolation Forest"])
        self.assertTrue(status["Banking SMS Detector"])
        self.assertTrue(status["Phishing Detector"])
        self.assertTrue(status["XGBoost Transaction Risk"])

    def test_random_forest_returns_a_real_model_prediction(self):
        response = self.client.post("/predict", json=TRANSACTION_FEATURES)

        self.assertEqual(response.status_code, 200)
        self.assertIn(response.json["assessment"], ["elevated", "lower"])
        self.assertIn(response.json["prediction"], [0, 1])
        self.assertGreaterEqual(response.json["model_score"], 0)
        self.assertLessEqual(response.json["model_score"], 1)
        self.assertEqual(response.json["score_type"], "uncalibrated_model_score")
        self.assertNotIn("fraud_probability", response.json)
        self.assertGreaterEqual(response.json["decision_threshold"], 0)

    def test_random_forest_accepts_valid_first_time_and_repeated_recipient_features(self):
        first_time = self.client.post("/predict", json=TRANSACTION_FEATURES)
        repeated = self.client.post("/predict", json={
            **TRANSACTION_FEATURES,
            "log_sender_history_count": 2.397895273,
            "log_beneficiary_history_count": 1.791759469,
        })

        self.assertEqual(first_time.status_code, 200)
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(first_time.json["score_type"], "uncalibrated_model_score")
        self.assertEqual(repeated.json["score_type"], "uncalibrated_model_score")

    def test_random_forest_validates_payment_feature_ranges(self):
        invalid_features = [
            {**TRANSACTION_FEATURES, "log_amount": -0.01},
            {**TRANSACTION_FEATURES, "log_amount": 20},
            {**TRANSACTION_FEATURES, "log_sender_history_count": -1},
            {**TRANSACTION_FEATURES, "type_TRANSFER": 2},
            {**TRANSACTION_FEATURES, "type_TRANSFER": 0},
        ]

        for features in invalid_features:
            with self.subTest(features=features):
                response = self.client.post("/predict", json=features)
                self.assertEqual(response.status_code, 400)
                self.assertIn("error", response.json)

    def test_zero_amount_feature_is_valid_but_negative_and_extreme_are_not(self):
        zero_amount = self.client.post("/predict", json={
            **TRANSACTION_FEATURES,
            "log_amount": 0,
        })
        negative_amount = self.client.post("/predict", json={
            **TRANSACTION_FEATURES,
            "log_amount": -1,
        })
        extreme_amount = self.client.post("/predict", json={
            **TRANSACTION_FEATURES,
            "log_amount": 1000,
        })

        self.assertEqual(zero_amount.status_code, 200)
        self.assertEqual(negative_amount.status_code, 400)
        self.assertEqual(extreme_amount.status_code, 400)

    def test_isolation_forest_returns_a_real_model_prediction(self):
        response = self.client.post("/predict-isolation", json=TRANSACTION_FEATURES)

        self.assertEqual(response.status_code, 200)
        self.assertIn(response.json["result"], ["Fraudulent", "Legitimate"])
        self.assertIn(response.json["raw_prediction"], [-1, 1])
        self.assertIn("anomaly_score", response.json)

    def test_sms_detector_returns_model_probabilities(self):
        response = self.client.post(
            "/predict-sms",
            json={"message": "Your bank account has been credited"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["model"], "Banking SMS Detector")
        self.assertIn(response.json["risk_level"], ["Phishing", "Suspicious", "Safe"])
        self.assertIn("Phishing", response.json["probabilities"])

    def test_phishing_detector_returns_model_probabilities(self):
        response = self.client.post(
            "/predict-phishing",
            json={"message": "Please review this account security notification"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["model"], "Phishing Detector")
        self.assertIn(response.json["risk_level"], ["Phishing", "Suspicious", "Safe"])
        self.assertIn("Phishing", response.json["probabilities"])

    def test_retrained_xgboost_returns_a_model_prediction(self):
        response = self.client.post("/predict-xgboost", json={
            **TRANSACTION_FEATURES,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["model"], "XGBoost Transaction Risk")
        self.assertIn(response.json["prediction"], [0, 1])
        self.assertGreaterEqual(response.json["model_score"], 0)
        self.assertLessEqual(response.json["model_score"], 1)
        self.assertEqual(response.json["score_type"], "uncalibrated_model_score")
        self.assertNotIn("fraud_probability", response.json)
        self.assertGreaterEqual(response.json["decision_threshold"], 0)

    def test_numeric_endpoint_rejects_non_finite_features(self):
        response = self.client.post("/predict", json={
            **TRANSACTION_FEATURES,
            "log_amount": float("inf"),
        })

        self.assertEqual(response.status_code, 400)
        self.assertIn("finite number", response.json["error"])

    def test_text_endpoint_rejects_empty_input(self):
        response = self.client.post("/predict-sms", json={"message": " "})

        self.assertEqual(response.status_code, 400)

    def test_text_endpoints_reject_unexpected_input_types(self):
        for endpoint in ("/predict-sms", "/predict-phishing"):
            with self.subTest(endpoint=endpoint):
                response = self.client.post(endpoint, json={"message": ["not", "text"]})
                self.assertEqual(response.status_code, 400)

    def test_malformed_json_is_rejected_without_internal_error_details(self):
        for endpoint in ("/predict", "/predict-xgboost", "/predict-isolation"):
            with self.subTest(endpoint=endpoint):
                response = self.client.post(
                    endpoint,
                    data="{",
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(set(response.json), {"error"})

    def test_xgboost_and_isolation_forest_reject_invalid_numeric_input(self):
        for endpoint in ("/predict-xgboost", "/predict-isolation"):
            with self.subTest(endpoint=endpoint):
                response = self.client.post(endpoint, json={
                    **TRANSACTION_FEATURES,
                    "log_amount": -1,
                })
                self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
