"""
Dërgo një raport test për të provokuar event.
"""

import requests
import time

# Prit që WebSocket të lidhet
time.sleep(2)

# Dërgo raportin
response = requests.post(
    "http://localhost:8000/api/v1/reports",
    json={
        "report_type": "symptom",
        "symptoms": ["fever", "cough", "fatigue"],
        "severity": 3,
        "district": "Qendra",
        "age_range": "30-44",
    },
)

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")