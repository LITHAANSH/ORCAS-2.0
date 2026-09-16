"""Language detection and response templates for English / Hindi / Kannada.

Two deliberate rules:
  * numeric values are NEVER localised into other numeral systems — "2.4 m"
    stays "2.4 m" in all three languages so a number can never be misread;
  * detection is script + marker based, so it works with no network and no LLM.
"""
from __future__ import annotations

import re
from typing import Dict, List

from ..schemas import Language

DEVANAGARI = re.compile(r"[ऀ-ॿ]")
KANNADA = re.compile(r"[ಀ-೿]")

HINDI_MARKERS = ["है", "सकता", "सकती", "मछली", "क्या", "नहीं", "समुद्र में",
                 "नाव", "मुझे", "कहाँ", "कहां", "रास्ता"]


def detect_language(text: str) -> Language:
    if not text:
        return "en"
    if KANNADA.search(text):
        return "kn"
    if not DEVANAGARI.search(text):
        return "en"
    hi = sum(1 for w in HINDI_MARKERS if w in text)
    return "hi" if hi else "en"


# --------------------------------------------------------------------------
# Phrase book
# --------------------------------------------------------------------------
T: Dict[str, Dict[Language, str]] = {
    "verdict_low": {
        "en": "Conditions look safe",
        "hi": "स्थिति सुरक्षित लग रही है",
        "kn": "ಪರಿಸ್ಥಿತಿಗಳು ಸುರಕ್ಷಿತವಾಗಿವೆ ಎಂದು ತೋರುತ್ತದೆ",
    },
    "verdict_moderate": {
        "en": "Go with caution",
        "hi": "सावधानी से जाएँ",
        "kn": "ಎಚ್ಚರಿಕೆಯಿಂದ ಹೋಗಿ",
    },
    "verdict_high": {
        "en": "High risk — not recommended",
        "hi": "जोखिम अधिक है — जाने की सलाह नहीं",
        "kn": "ಅಪಾಯ ಹೆಚ್ಚು — ಹೋಗುವುದು ಶಿಫಾರಸು ಮಾಡುವುದಿಲ್ಲ",
    },
    "verdict_extreme": {
        "en": "EXTREME RISK — do not go to sea",
        "hi": "अत्यधिक जोखिम — समुद्र में न जाएँ",
        "kn": "ಅತ್ಯಂತ ಅಪಾಯ — ಸಮುದ್ರಕ್ಕೆ ಹೋಗಬೇಡಿ",
    },
    "based_on": {
        "en": "Based on available data",
        "hi": "उपलब्ध आँकड़ों के आधार पर",
        "kn": "ಲಭ್ಯವಿರುವ ಮಾಹಿತಿಯ ಆಧಾರದ ಮೇಲೆ",
    },
    "risk_score": {
        "en": "Risk score",
        "hi": "जोखिम स्कोर",
        "kn": "ಅಪಾಯದ ಅಂಕ",
    },
    "why": {
        "en": "Main reasons",
        "hi": "मुख्य कारण",
        "kn": "ಮುಖ್ಯ ಕಾರಣಗಳು",
    },
    "official_warning": {
        "en": "An official warning is in force. Please follow IMD / INCOIS and Coast Guard instructions.",
        "hi": "आधिकारिक चेतावनी लागू है। कृपया IMD / INCOIS और तटरक्षक बल के निर्देशों का पालन करें।",
        "kn": "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಜಾರಿಯಲ್ಲಿದೆ. IMD / INCOIS ಮತ್ತು ಕರಾವಳಿ ರಕ್ಷಣಾ ಪಡೆಯ ಸೂಚನೆಗಳನ್ನು ಪಾಲಿಸಿ.",
    },
    "improves_at": {
        "en": "Conditions are expected to improve after {hour}:00. Ask me again then.",
        "hi": "{hour}:00 बजे के बाद स्थिति सुधरने की संभावना है। तब दोबारा पूछें।",
        "kn": "{hour}:00 ನಂತರ ಪರಿಸ್ಥಿತಿ ಸುಧಾರಿಸುವ ಸಾಧ್ಯತೆಯಿದೆ. ಆಗ ಮತ್ತೆ ಕೇಳಿ.",
    },
    "no_improvement": {
        "en": "Conditions are not expected to improve today.",
        "hi": "आज स्थिति सुधरने की संभावना नहीं है।",
        "kn": "ಇಂದು ಪರಿಸ್ಥಿತಿ ಸುಧಾರಿಸುವ ಸಾಧ್ಯತೆಯಿಲ್ಲ.",
    },
    "pfz_intro": {
        "en": "Nearest potential fishing zones",
        "hi": "निकटतम संभावित मत्स्य क्षेत्र",
        "kn": "ಹತ್ತಿರದ ಸಂಭಾವ್ಯ ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶಗಳು",
    },
    "pfz_note": {
        "en": "A potential fishing zone is a scientifically likely area — it is not a guarantee of fish.",
        "hi": "संभावित मत्स्य क्षेत्र वैज्ञानिक रूप से संभावित क्षेत्र है — मछली की गारंटी नहीं।",
        "kn": "ಸಂಭಾವ್ಯ ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶವು ವೈಜ್ಞಾನಿಕ ಅಂದಾಜಿನ ಪ್ರದೇಶ — ಮೀನು ಸಿಗುವ ಖಾತರಿ ಇಲ್ಲ.",
    },
    "route_intro": {
        "en": "Safest route",
        "hi": "सबसे सुरक्षित रास्ता",
        "kn": "ಅತ್ಯಂತ ಸುರಕ್ಷಿತ ಮಾರ್ಗ",
    },
    "route_detail": {
        "en": "{distance} km, about {eta}, avoiding restricted areas.",
        "hi": "{distance} किमी, लगभग {eta}, प्रतिबंधित क्षेत्रों से बचते हुए।",
        "kn": "{distance} ಕಿಮೀ, ಅಂದಾಜು {eta}, ನಿರ್ಬಂಧಿತ ಪ್ರದೇಶಗಳನ್ನು ತಪ್ಪಿಸಿ.",
    },
    "geofence_warn": {
        "en": "WARNING: {zone} is {distance} km away.",
        "hi": "चेतावनी: {zone} {distance} किमी दूर है।",
        "kn": "ಎಚ್ಚರಿಕೆ: {zone} {distance} ಕಿಮೀ ದೂರದಲ್ಲಿದೆ.",
    },
    "geofence_inside": {
        "en": "ALERT: you are inside {zone}. Leave the area immediately.",
        "hi": "अलर्ट: आप {zone} के भीतर हैं। तुरंत क्षेत्र छोड़ें।",
        "kn": "ಎಚ್ಚರಿಕೆ: ನೀವು {zone} ಒಳಗಿದ್ದೀರಿ. ತಕ್ಷಣ ಪ್ರದೇಶದಿಂದ ಹೊರಬನ್ನಿ.",
    },
    "sources": {
        "en": "Sources",
        "hi": "स्रोत",
        "kn": "ಮೂಲಗಳು",
    },
    "updated": {
        "en": "Updated",
        "hi": "अपडेट",
        "kn": "ನವೀಕರಣ",
    },
    "demo_mode": {
        "en": "Demo / simulated data — not a live government feed.",
        "hi": "डेमो / नकली आँकड़े — यह सरकारी लाइव फ़ीड नहीं है।",
        "kn": "ಡೆಮೊ / ಅನುಕರಿಸಿದ ಮಾಹಿತಿ — ಇದು ಸರ್ಕಾರಿ ನೇರ ಮೂಲವಲ್ಲ.",
    },
    "unavailable": {
        "en": "Ocean forecast unavailable for this location.",
        "hi": "इस स्थान के लिए समुद्री पूर्वानुमान उपलब्ध नहीं है।",
        "kn": "ಈ ಸ್ಥಳಕ್ಕೆ ಸಮುದ್ರದ ಮುನ್ಸೂಚನೆ ಲಭ್ಯವಿಲ್ಲ.",
    },
    "hours": {"en": "h", "hi": "घं", "kn": "ಗಂ"},
    "minutes": {"en": "min", "hi": "मि", "kn": "ನಿಮಿಷ"},
    "disclaimer": {
        "en": "ORCA is a decision-support tool. It does not replace official marine "
              "advisories or Coast Guard instructions.",
        "hi": "ORCA एक निर्णय-सहायक उपकरण है। यह आधिकारिक समुद्री सलाह या तटरक्षक "
              "निर्देशों का विकल्प नहीं है।",
          "kn": "ORCA ಒಂದು ನಿರ್ಧಾರ ಸಹಾಯಕ ಸಾಧನ. ಇದು ಅಧಿಕೃತ ಸಮುದ್ರ ಸಲಹೆಗಳು ಅಥವಾ ಕರಾವಳಿ ರಕ್ಷಣಾ ಪಡೆಯ ಸೂಚನೆಗಳಿಗೆ ಪರ್ಯಾಯವಲ್ಲ.",
    },
}

SUGGESTIONS: Dict[Language, List[str]] = {
    "en": ["What about 12 PM?", "Show nearby fishing zones", "Give me the safest route",
           "Is there a cyclone nearby?"],
    "hi": ["दोपहर 12 बजे कैसा रहेगा?", "पास के मत्स्य क्षेत्र दिखाओ", "सबसे सुरक्षित रास्ता बताओ",
           "क्या आसपास कोई चक्रवात है?"],
    "kn": ["ಮಧ್ಯಾಹ್ನ 12 ಗಂಟೆಗೆ ಪರಿಸ್ಥಿತಿ ಹೇಗಿರುತ್ತದೆ?", "ಹತ್ತಿರದ ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶಗಳನ್ನು ತೋರಿಸಿ", "ಅತ್ಯಂತ ಸುರಕ್ಷಿತ ಮಾರ್ಗ ನೀಡಿ", "ಹತ್ತಿರ ಚಂಡಮಾರುತ ಇದೆಯೇ?"],
}


def t(key: str, lang: Language, **kwargs) -> str:
    template = T.get(key, {}).get(lang) or T.get(key, {}).get("en", key)
    return template.format(**kwargs) if kwargs else template


def verdict_key(category: str) -> str:
    return {"LOW": "verdict_low", "MODERATE": "verdict_moderate",
            "HIGH": "verdict_high", "EXTREME": "verdict_extreme"}[category]


def humanise_duration(minutes: int, lang: Language) -> str:
    h, m = divmod(int(minutes), 60)
    if h and m:
        return f"{h} {t('hours', lang)} {m} {t('minutes', lang)}"
    if h:
        return f"{h} {t('hours', lang)}"
    return f"{m} {t('minutes', lang)}"
