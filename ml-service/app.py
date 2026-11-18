from flask import Flask, request, jsonify
import joblib
import pandas as pd
import os
import re
import math

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")


def load_artifact(path, model_name):
    try:
        return joblib.load(path)
    except Exception:
        app.logger.exception("Unable to load model artifact: %s", model_name)
        return None


def model_unavailable(model):
    return jsonify({"error": f"{model} model is unavailable"}), 503


def numeric_input(data, feature_names):
    if not isinstance(data, dict):
        return None, "A JSON object is required"

    missing = [feature for feature in feature_names if feature not in data]
    if missing:
        return None, f"Missing required features: {', '.join(missing)}"

    values = {}
    for feature in feature_names:
        value = data[feature]
        try:
            is_finite_number = (
                not isinstance(value, bool)
                and isinstance(value, (int, float))
                and math.isfinite(value)
            )
        except OverflowError:
            is_finite_number = False
        if not is_finite_number:
            return None, f"Feature '{feature}' must be a finite number"
        values[feature] = value
    if "log_amount" in values:
        if values["log_amount"] < 0:
            return None, "Feature 'log_amount' must represent a non-negative transaction amount"
        if values["log_amount"] > math.log1p(1_000_000):
            return None, "Feature 'log_amount' exceeds the supported transaction limit"
        history_features = [
            feature for feature in feature_names if feature.startswith("log_") and feature != "log_amount"
        ]
        if any(values[feature] < 0 for feature in history_features):
            return None, "Transaction history features must be non-negative"
        type_features = [feature for feature in feature_names if feature.startswith("type_")]
        if any(values[feature] not in (0, 1) for feature in type_features):
            return None, "Transaction type features must be binary"
        if len(type_features) and sum(values[feature] for feature in type_features) != 1:
            return None, "Exactly one transaction type must be selected"
    return pd.DataFrame([values], columns=feature_names), None


# ==========================================
# TEXT PREPROCESSING
# ==========================================

def clean_text(text):
    text = str(text).lower()

    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)

    # Replace URLs with a common token
    text = re.sub(
        r'https?://\S+|www\.\S+',
        ' URLTOKEN ',
        text
    )

    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)

    return text.strip()


# ==========================================
# LOAD RANDOM FOREST MODEL
# ==========================================

RF_MODEL_PATH = os.path.join(MODELS_DIR, "paysim_random_forest_v2.joblib")
rf_model_data = load_artifact(RF_MODEL_PATH, "Random Forest")
rf_model = rf_model_data.get("model") if isinstance(rf_model_data, dict) else None
rf_feature_names = rf_model_data.get("feature_names", []) if isinstance(rf_model_data, dict) else []
rf_decision_threshold = rf_model_data.get("decision_threshold") if isinstance(rf_model_data, dict) else None


# ==========================================
# LOAD ISOLATION FOREST MODEL
# ==========================================

IF_MODEL_PATH = os.path.join(MODELS_DIR, "paysim_isolation_forest_v2.joblib")
if_model_data = load_artifact(IF_MODEL_PATH, "Isolation Forest")
if_model = if_model_data.get("model") if isinstance(if_model_data, dict) else None
if_feature_names = if_model_data.get("feature_names", []) if isinstance(if_model_data, dict) else []
if_decision_threshold = if_model_data.get("decision_threshold") if isinstance(if_model_data, dict) else None


# ==========================================
# LOAD BANKING SMS MODEL
# ==========================================

SMS_MODEL_PATH = os.path.join(MODELS_DIR, "banking_sms_detector.pkl")
sms_model = load_artifact(SMS_MODEL_PATH, "Banking SMS Detector")


# ==========================================
# LOAD PHISHING DETECTOR
# ==========================================

PHISHING_MODEL_PATH = os.path.join(MODELS_DIR, "phishing_detector.pkl")
phishing_model = load_artifact(PHISHING_MODEL_PATH, "Phishing Detector")

# ==========================================
# LOAD XGBOOST TRANSACTION RISK MODEL
# ==========================================

XGBOOST_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "paysim_xgboost_v2.joblib"
)

xgboost_model = load_artifact(XGBOOST_MODEL_PATH, "XGBoost Transaction Risk")
xgboost_feature_names = (
    xgboost_model.get("feature_names", [])
    if isinstance(xgboost_model, dict)
    else []
)
xgboost_decision_threshold = (
    xgboost_model.get("decision_threshold")
    if isinstance(xgboost_model, dict)
    else None
)
xgboost_model = xgboost_model.get("model") if isinstance(xgboost_model, dict) else None


def get_model_status():
    return {
        "Random Forest": rf_model is not None and bool(rf_feature_names) and rf_decision_threshold is not None,
        "Isolation Forest": if_model is not None and bool(if_feature_names) and if_decision_threshold is not None,
        "Banking SMS Detector": sms_model is not None,
        "Phishing Detector": phishing_model is not None,
        "XGBoost Transaction Risk": xgboost_model is not None and bool(xgboost_feature_names) and xgboost_decision_threshold is not None,
    }


# ==========================================
# HOME ROUTE
# ==========================================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "SecurePay ML API is running!",
        "models": get_model_status()
    })


@app.route("/health", methods=["GET"])
def health():
    models = get_model_status()
    all_available = all(models.values())
    return jsonify({
        "status": "ok" if all_available else "degraded",
        "models": models,
    }), 200 if all_available else 503


# ==========================================
# RANDOM FOREST PREDICTION
# ==========================================

@app.route("/predict", methods=["POST"])
def predict():
    try:
        if rf_model is None or not rf_feature_names:
            return model_unavailable("Random Forest")
        data = request.get_json(silent=True)
        input_df, error = numeric_input(data, rf_feature_names)
        if error:
            return jsonify({"error": error}), 400

        probabilities = rf_model.predict_proba(input_df.to_numpy())[0]
        positive_index = list(rf_model.classes_).index(1)
        model_score = float(probabilities[positive_index])
        prediction = int(model_score >= rf_decision_threshold)

        return jsonify({
            "model": "Random Forest",
            "prediction": prediction,
            "assessment": "elevated" if prediction == 1 else "lower",
            "model_score": round(model_score, 6),
            "score_type": "uncalibrated_model_score",
            "decision_threshold": round(float(rf_decision_threshold), 6),
        })

    except Exception:
        app.logger.exception("Random Forest prediction failed")
        return jsonify({"error": "Random Forest prediction failed"}), 500


# ==========================================
# ISOLATION FOREST PREDICTION
# ==========================================

@app.route("/predict-isolation", methods=["POST"])
def predict_isolation():
    try:
        if if_model is None or if_decision_threshold is None or not if_feature_names:
            return model_unavailable("Isolation Forest")
        data = request.get_json(silent=True)
        input_df, error = numeric_input(data, if_feature_names)
        if error:
            return jsonify({"error": error}), 400

        anomaly_score = -float(if_model.decision_function(input_df.to_numpy())[0])
        prediction = int(anomaly_score >= if_decision_threshold)
        raw_prediction = -1 if prediction else 1

        return jsonify({
            "model": "Isolation Forest",
            "raw_prediction": raw_prediction,
            "prediction": prediction,
            "result": "Fraudulent" if prediction == 1 else "Legitimate",
            "anomaly_score": round(anomaly_score, 6),
            "decision_threshold": round(float(if_decision_threshold), 6),
        })

    except Exception:
        app.logger.exception("Isolation Forest prediction failed")
        return jsonify({"error": "Isolation Forest prediction failed"}), 500


# ==========================================
# BANKING SMS PREDICTION
# ==========================================

@app.route("/predict-sms", methods=["POST"])
def predict_sms():
    try:
        if sms_model is None:
            return model_unavailable("Banking SMS Detector")
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({"error": "Invalid input data"}), 400

        message = data.get("message")

        if not isinstance(message, str) or not message.strip():
            return jsonify({
                "error": "Please provide a valid SMS message"
            }), 400
        if len(message) > 10000:
            return jsonify({"error": "Message must be 10,000 characters or fewer"}), 400

        cleaned_message = clean_text(message)

        prediction = str(
            sms_model.predict([cleaned_message])[0]
        )

        probabilities = sms_model.predict_proba(
            [cleaned_message]
        )[0]

        class_probabilities = {
            str(label): round(float(probability) * 100, 2)
            for label, probability in zip(
                sms_model.classes_,
                probabilities
            )
        }

        if "Phishing" not in class_probabilities:
            raise ValueError("Banking SMS model is missing the Phishing class")
        phishing_probability = class_probabilities["Phishing"]

        if phishing_probability >= 70:
            risk_level = "Phishing"
        elif phishing_probability >= 35:
            risk_level = "Suspicious"
        else:
            risk_level = "Safe"

        return jsonify({
            "model": "Banking SMS Detector",
            "prediction": prediction,
            "risk_level": risk_level,
            "phishing_risk_score": phishing_probability,
            "probabilities": class_probabilities
        })

    except Exception:
        app.logger.exception("Banking SMS prediction failed")
        return jsonify({"error": "Banking SMS prediction failed"}), 500


# ==========================================
# PHISHING EMAIL / MESSAGE PREDICTION
# ==========================================

@app.route("/predict-phishing", methods=["POST"])
def predict_phishing():
    try:
        if phishing_model is None:
            return model_unavailable("Phishing Detector")
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({"error": "Invalid input data"}), 400

        message = data.get("message")

        if not isinstance(message, str) or not message.strip():
            return jsonify({
                "error": "Please provide valid email or message text"
            }), 400
        if len(message) > 10000:
            return jsonify({"error": "Message must be 10,000 characters or fewer"}), 400

        cleaned_message = clean_text(message)

        prediction = str(
            phishing_model.predict([cleaned_message])[0]
        )

        probabilities = phishing_model.predict_proba(
            [cleaned_message]
        )[0]

        class_probabilities = {
            str(label): round(float(probability) * 100, 2)
            for label, probability in zip(
                phishing_model.classes_,
                probabilities
            )
        }

        if "Phishing" not in class_probabilities:
            raise ValueError("Phishing model is missing the Phishing class")
        phishing_probability = class_probabilities["Phishing"]

        if phishing_probability >= 70:
            risk_level = "Phishing"
        elif phishing_probability >= 35:
            risk_level = "Suspicious"
        else:
            risk_level = "Safe"

        return jsonify({
            "model": "Phishing Detector",
            "prediction": prediction,
            "risk_level": risk_level,
            "phishing_risk_score": phishing_probability,
            "probabilities": class_probabilities
        })

    except Exception:
        app.logger.exception("Phishing prediction failed")
        return jsonify({"error": "Phishing prediction failed"}), 500

# ==========================================
# XGBOOST TRANSACTION RISK PREDICTION
# ==========================================

@app.route("/predict-xgboost", methods=["POST"])
def predict_xgboost():
    try:
        if xgboost_model is None or not xgboost_feature_names or xgboost_decision_threshold is None:
            return model_unavailable("XGBoost Transaction Risk")
        data = request.get_json(silent=True)
        input_df, error = numeric_input(data, xgboost_feature_names)
        if error:
            return jsonify({"error": error}), 400

        probabilities = xgboost_model.predict_proba(input_df.to_numpy())[0]

        fraud_index = list(xgboost_model.classes_).index(1)
        model_score = float(probabilities[fraud_index])
        prediction = int(model_score >= xgboost_decision_threshold)

        return jsonify({
            "model": "XGBoost Transaction Risk",
            "prediction": prediction,
            "assessment": "elevated" if prediction == 1 else "lower",
            "model_score": round(model_score, 6),
            "score_type": "uncalibrated_model_score",
            "decision_threshold": round(float(xgboost_decision_threshold), 6),
        })

    except Exception:
        app.logger.exception("XGBoost prediction failed")
        return jsonify({"error": "XGBoost prediction failed"}), 500
# ==========================================
# RUN FLASK SERVER
# ==========================================

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.environ.get("ML_SERVICE_PORT", "5001")),
        debug=False
    )