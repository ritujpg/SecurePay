# SecurePay local ML service

The inference API is a local development service. From the repository root, create an environment and start it with PowerShell:

```powershell
py -3.14 -m venv ml-service\.venv
ml-service\.venv\Scripts\python.exe -m pip install -r ml-service\requirements.txt
ml-service\.venv\Scripts\python.exe ml-service\app.py
```

The Flask process binds only to `127.0.0.1:5001`. The Express proxy is enabled only by the Vite development server, accepts loopback requests, and requires `ML_SERVICE_URL` to point to a loopback HTTP address. Production does not mount the proxy.

Check `http://127.0.0.1:5001/health` before using inference. Each model is loaded independently so an unavailable artifact does not prevent other models from starting. A model that failed to load returns HTTP 503; predictions are never substituted. The committed XGBoost artifact currently fails to deserialize with XGBoost 1.7.6, 2.1.4, and 3.4.1, so that endpoint remains unavailable until a valid artifact can be supplied or exported from its original training pipeline. The service reports this as `degraded` and does not fabricate a prediction.

The scikit-learn artifacts were serialized with scikit-learn 1.6.1 and emit version-compatibility warnings under the pinned runtime. Model inference tests should be run after environment setup; warnings are not evidence that the serialized models were produced with the pinned version.
