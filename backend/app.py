from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from url_feature_extractor import URLFeatureExtractor
from utils.google_safebrowsing import check_google_safebrowsing

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scaler = joblib.load("scaler.pkl")
booster = xgb.Booster()
booster.load_model("xgb_model.json")

FEATURE_COLUMNS = [
    "URLLength", "DomainLength", "TLDLength", "NoOfImage", "NoOfJS", "NoOfCSS", 
    "NoOfSelfRef", "NoOfExternalRef", "IsHTTPS", "HasObfuscation", "HasTitle", 
    "HasDescription", "HasSubmitButton", "HasSocialNet", "HasFavicon", 
    "HasCopyrightInfo", "popUpWindow", "Iframe", "Abnormal_URL", 
    "LetterToDigitRatio", "Redirect_0", "Redirect_1"
]

class URLInput(BaseModel):
    url: str

@app.post("/predict_url")
def predict_from_url(input_data: URLInput):
    try:
        is_malicious = check_google_safebrowsing(input_data.url)
        if is_malicious['flagged']:
            return {
                "prediction": 0,
                "result": "Phishing (Google Safe Browsing)",
                "source": "Google Safe Browsing"
            }
        extractor = URLFeatureExtractor(input_data.url)
        features = extractor.extract_model_features()

        if "error" in features:
            return {"error": features["error"]}

        input_df = pd.DataFrame([features], columns=FEATURE_COLUMNS)

        scaled_input = scaler.transform(input_df)

        dmatrix = xgb.DMatrix(scaled_input, feature_names=FEATURE_COLUMNS)
        prob = booster.predict(dmatrix)[0]
        label = int(prob >= 0.7)

        print(round(prob, 3),)

        return {
            "features": features,
            "prediction": label,
            "result": "Legitimate" if label == 1 else "Phishing"
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/")
def read_root():
    return {"message": "PhishShield API is running 🚀"}