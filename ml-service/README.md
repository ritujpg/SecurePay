# SecurePay local ML service

The inference API is a local development service. From the repository root, create an environment and start it with PowerShell:

```powershell
py -3.14 -m venv ml-service\.venv
ml-service\.venv\Scripts\python.exe -m pip install -r ml-service\requirements.txt
ml-service\.venv\Scripts\python.exe ml-service\app.py
```

The Flask process binds only to `127.0.0.1:5001`. The Express proxy is enabled only by the Vite development server, accepts loopback requests, and requires `ML_SERVICE_URL` to point to a loopback HTTP address. Production does not mount the proxy.

Check `http://127.0.0.1:5001/health` before using inference. Each model is loaded independently so an unavailable artifact does not prevent other models from starting. A model that failed to load returns HTTP 503; predictions are never substituted.

The existing Random Forest, Isolation Forest, and XGBoost artifacts are preserved. The service uses separately versioned PaySim v2 models:

```powershell
ml-service\.venv\Scripts\python.exe ml-service\training\train_fraud.py
```

The training pipeline uses chronological 60/10/10/20 train/calibration/threshold-validation/test periods. Its eight inputs are log amount, prior sender transaction count, prior sender/beneficiary transaction count, and PaySim transaction-type indicators. Same-step activity is excluded because PaySim has no within-step ordering. SecurePay counts sent transaction attempts regardless of outcome, since PaySim has no transaction-status field. On both sides, only activity in strictly earlier hour buckets is included.

PaySim simulation steps and SecurePay UTC-hour buckets have no known epoch alignment, so the hourly history windows are approximate. Hour-of-day is excluded rather than mapped speculatively. Random Forest uses positive rows plus at most 100 negatives per positive, without additional class weighting; XGBoost uses `scale_pos_weight=1`. Isotonic calibration is fitted on the separate chronological calibration period for diagnostic comparison only. The API returns an uncalibrated model score and validation-selected threshold, not a fraud probability. Calibration diagnostics on validation and final test periods do not make SecurePay/UPI risk calibrated. PaySim is synthetic and a successful holdout score does not establish real-world performance. The payment UI labels the signal experimental and advisory; it does not authorize, block, or verify a real bank payment.
