import unittest

from app import app, get_model_status


TRANSACTION_FEATURES = {
    "step": 1,
    "amount": 100,
    "oldbalanceOrg": 1000,
    "newbalanceOrig": 900,
    "oldbalanceDest": 0,
    "newbalanceDest": 100,
    "orig_balance_error": 0,
    "dest_balance_error": 0,
    "type_CASH_IN": 0,
    "type_CASH_OUT": 0,
    "type_DEBIT": 0,
    "type_PAYMENT": 1,
    "type_TRANSFER": 0,
}


class ModelApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_health_reports_independent_model_availability(self):
        response = self.client.get("/health")
        status = get_model_status()

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["status"], "degraded")
        self.assertTrue(status["Random Forest"])
        self.assertTrue(status["Isolation Forest"])
        self.assertTrue(status["Banking SMS Detector"])
        self.assertTrue(status["Phishing Detector"])
        self.assertFalse(status["XGBoost Transaction Risk"])

    def test_random_forest_returns_a_real_model_prediction(self):
        response = self.client.post("/predict", json=TRANSACTION_FEATURES)

        self.assertEqual(response.status_code, 200)
        self.assertIn(response.json["result"], ["Fraudulent", "Legitimate"])
        self.assertIn(response.json["prediction"], [0, 1])

    def test_isolation_forest_returns_a_real_model_prediction(self):
        response = self.client.post("/predict-isolation", json=TRANSACTION_FEATURES)

        self.assertEqual(response.status_code, 200)
        self.assertIn(response.json["result"], ["Fraudulent", "Legitimate"])
        self.assertIn(response.json["raw_prediction"], [-1, 1])

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

    def test_xgboost_failure_is_explicit_and_never_substituted(self):
        response = self.client.post("/predict-xgboost", json={
            "step": 1,
            "amount": 100,
            "type_CASH_IN": 0,
            "type_CASH_OUT": 0,
            "type_DEBIT": 0,
            "type_PAYMENT": 1,
            "type_TRANSFER": 0,
        })

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json,
            {"error": "XGBoost Transaction Risk model is unavailable"},
        )

    def test_numeric_endpoint_rejects_non_finite_features(self):
        response = self.client.post("/predict", json={
            **TRANSACTION_FEATURES,
            "amount": float("inf"),
        })

        self.assertEqual(response.status_code, 400)
        self.assertIn("finite number", response.json["error"])

    def test_text_endpoint_rejects_empty_input(self):
        response = self.client.post("/predict-sms", json={"message": " "})

        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
