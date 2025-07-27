import requests
import os
import logging
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

def check_google_safebrowsing(url: str) -> dict:
    key = os.getenv("GOOGLE_SAFE_BROWSING_KEY","")
    print("Key", key)

    if not key:
        return {
            "flagged": False,
            "details": [],
            "error": "Google Safe Browsing API key is missing or not set"
        }

    endpoint = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={key}"

    payload = {
        "client": {
            "clientId": "phishshield",
            "clientVersion": "1.0"
        },
        "threatInfo": {
            "threatTypes": [
                "MALWARE",
                "SOCIAL_ENGINEERING",
                "UNWANTED_SOFTWARE",
                "POTENTIALLY_HARMFUL_APPLICATION"
            ],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}]
        }
    }

    try:
        response = requests.post(endpoint, json=payload, timeout=5)

        if response.status_code == 200:
            result = response.json()
            if result.get("matches"):
                return {
                    "flagged": True,
                    "details": result["matches"],
                    "error": None
                }
            return {"flagged": False, "details": [], "error": None}

        return {
            "flagged": False,
            "details": [],
            "error": f"API Error {response.status_code}: {response.text}"
        }

    except requests.exceptions.RequestException as e:
        logger.error(f"Google Safe Browsing API error: {e}")
        return {"flagged": False, "details": [], "error": str(e)}
