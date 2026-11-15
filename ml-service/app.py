from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import os
import re

app = Flask(__name__)
CORS(app)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")


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

RF_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "random_forest_fraud_model.pkl"
)

rf_model_data = joblib.load(RF_MODEL_PATH)
rf_model = rf_model_data["model"]
rf_feature_names = rf_model_data["feature_names"]


# ==========================================
# LOAD ISOLATION FOREST MODEL
# ==========================================

IF_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "isolation_forest_fraud_model.pkl"
)

if_model_data = joblib.load(IF_MODEL_PATH)
if_model = if_model_data["model"]
if_scaler = if_model_data["scaler"]
if_feature_names = if_model_data["feature_names"]


# ==========================================
# LOAD BANKING SMS MODEL
# ==========================================

SMS_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "banking_sms_detector.pkl"
)

sms_model = joblib.load(SMS_MODEL_PATH)


# ==========================================
# LOAD PHISHING DETECTOR
# ==========================================

PHISHING_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "phishing_detector.pkl"
)

phishing_model = joblib.load(PHISHING_MODEL_PATH)

# ==========================================
# LOAD XGBOOST TRANSACTION RISK MODEL
# ==========================================

XGBOOST_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "transaction_risk_xgboost.pkl"
)

XGBOOST_FEATURES_PATH = os.path.join(
    MODELS_DIR,
    "transaction_features.pkl"
)

xgboost_model = joblib.load(XGBOOST_MODEL_PATH)
xgboost_feature_names = joblib.load(XGBOOST_FEATURES_PATH)


# ==========================================
# HOME ROUTE
# ==========================================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "SecurePay ML API is running!",
        "models": [
            "Random Forest",
            "Isolation Forest",
            "Banking SMS Detector",
            "Phishing Detector",
             "XGBoost Transaction Risk"
        ]
    })


# ==========================================
# RANDOM FOREST PREDICTION
# ==========================================

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({"error": "Invalid input data"}), 400

        missing = [
            f for f in rf_feature_names if f not in data
        ]

        if missing:
            return jsonify({
                "error": "Missing features",
                "features": missing
            }), 400

        input_df = pd.DataFrame([
            {f: data[f] for f in rf_feature_names}
        ])

        input_df = input_df.apply(
            pd.to_numeric, errors="raise"
        )

        prediction = int(rf_model.predict(input_df)[0])

        return jsonify({
            "model": "Random Forest",
            "prediction": prediction,
            "result": "Fraudulent" if prediction == 1 else "Legitimate"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==========================================
# ISOLATION FOREST PREDICTION
# ==========================================

@app.route("/predict-isolation", methods=["POST"])
def predict_isolation():
    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({"error": "Invalid input data"}), 400

        missing = [
            f for f in if_feature_names if f not in data
        ]

        if missing:
            return jsonify({
                "error": "Missing features",
                "features": missing
            }), 400

        input_df = pd.DataFrame([
            {f: data[f] for f in if_feature_names}
        ])

        input_df = input_df.apply(
            pd.to_numeric, errors="raise"
        )

        scaled_input = if_scaler.transform(input_df)

        raw_prediction = int(
            if_model.predict(scaled_input)[0]
        )

        prediction = 1 if raw_prediction == -1 else 0

        return jsonify({
            "model": "Isolation Forest",
            "raw_prediction": raw_prediction,
            "prediction": prediction,
            "result": "Fraudulent" if prediction == 1 else "Legitimate"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==========================================
# BANKING SMS PREDICTION
# ==========================================

@app.route("/predict-sms", methods=["POST"])
def predict_sms():
    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({"error": "Invalid input data"}), 400

        message = data.get("message")

        if not isinstance(message, str) or not message.strip():
            return jsonify({
                "error": "Please provide a valid SMS message"
            }), 400

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

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==========================================
# PHISHING EMAIL / MESSAGE PREDICTION
# ==========================================

@app.route("/predict-phishing", methods=["POST"])
def predict_phishing():
    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({"error": "Invalid input data"}), 400

        message = data.get("message")

        if not isinstance(message, str) or not message.strip():
            return jsonify({
                "error": "Please provide valid email or message text"
            }), 400

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

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==========================================
# XGBOOST TRANSACTION RISK PREDICTION
# ==========================================

@app.route("/predict-xgboost", methods=["POST"])
def predict_xgboost():
    try:
        data = request.get_json()

        if not isinstance(data, dict):
            return jsonify({"error": "JSON input is required"}), 400

        missing_features = [
            feature for feature in xgboost_feature_names
            if feature not in data
        ]

        if missing_features:
            return jsonify({
                "error": "Missing required features",
                "missing_features": missing_features
            }), 400

        input_df = pd.DataFrame(
            [[data[feature] for feature in xgboost_feature_names]],
            columns=xgboost_feature_names
        )

        input_df = input_df.apply(pd.to_numeric, errors="raise")

        prediction = int(xgboost_model.predict(input_df)[0])
        probabilities = xgboost_model.predict_proba(input_df)[0]

        fraud_index = list(xgboost_model.classes_).index(1)
        legitimate_index = list(xgboost_model.classes_).index(0)

        return jsonify({
            "model": "XGBoost Transaction Risk",
            "prediction": prediction,
            "result": "Fraudulent" if prediction == 1 else "Legitimate",
            "fraud_probability": round(
                float(probabilities[fraud_index]) * 100, 2
            ),
            "legitimate_probability": round(
                float(probabilities[legitimate_index]) * 100, 2
            )
        })

    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500
# ==========================================
# RUN FLASK SERVER
# ==========================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=True
    )