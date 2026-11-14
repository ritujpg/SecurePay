
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import os

app = Flask(__name__)
CORS(app)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")


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
# HOME ROUTE
# ==========================================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "SecurePay ML API is running!",
        "models": ["Random Forest", "Isolation Forest"]
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

        # Apply the scaler used during training
        scaled_input = if_scaler.transform(input_df)

        # Isolation Forest: -1 = anomaly, 1 = normal
        raw_prediction = int(
            if_model.predict(scaled_input)[0]
        )

        # Convert to SecurePay's common prediction format
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
# RUN FLASK SERVER
# ==========================================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
