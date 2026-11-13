
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import os

app = Flask(__name__)
CORS(app)

# Load trained Random Forest model
MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "models",
    "random_forest_fraud_model.pkl"
)

model_data = joblib.load(MODEL_PATH)

model = model_data["model"]
feature_names = model_data["feature_names"]

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "SecurePay ML API is running!"})


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({"error": "Invalid input data"}), 400

        # Check for missing features
        missing = [f for f in feature_names if f not in data]

        if missing:
            return jsonify({
                "error": "Missing features",
                "features": missing
            }), 400

        # Arrange input features in the model's expected order
        input_df = pd.DataFrame([
            {f: data[f] for f in feature_names}
        ])

        # Convert values to numeric
        input_df = input_df.apply(pd.to_numeric, errors="raise")

        # Predict fraud
        prediction = int(model.predict(input_df)[0])

        return jsonify({
            "prediction": prediction,
            "result": "Fraudulent" if prediction == 1 else "Legitimate"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
