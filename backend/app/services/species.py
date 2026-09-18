"""Species-specific marine fisheries prediction and catch economics for Indian coastal waters.

Models physical habitat suitability (SST, chlorophyll-a upwelling index, depth, seasonal patterns)
and market economics for India's 5 key commercial coastal catches:
1. Indian Mackerel (Rastrelliger kanagurta)
2. Oil Sardine (Sardinella longiceps)
3. Silver Pomfret (Pampus argenteus)
4. Yellowfin Tuna (Thunnus albacares)
5. Hilsa (Tenualosa ilisha)
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

SPECIES_CATALOG: Dict[str, Dict] = {
    "mackerel": {
        "id": "mackerel",
        "name": "Indian Mackerel",
        "scientific_name": "Rastrelliger kanagurta",
        "vernacular": {
            "en": "Indian Mackerel",
            "hi": "बांगड़ा (Bangda)",
            "kn": "ಬಂಗುಡೆ (Bangude)",
            "mr": "बांगडा (Bangda)",
        },
        "optimal_sst": (27.0, 29.5),
        "sst_tolerance": 2.5,
        "optimal_chl": (0.8, 2.5),
        "typical_depth_m": (15, 55),
        "market_price_inr_per_kg": 180,
        "catch_rate_kg_hr": 28,
        "schooling_type": "Pelagic schooling",
        "description": "Thrives in warm, nutrient-rich coastal upwelling waters. Highly sensitive to thermal fronts.",
    },
    "sardine": {
        "id": "sardine",
        "name": "Indian Oil Sardine",
        "scientific_name": "Sardinella longiceps",
        "vernacular": {
            "en": "Oil Sardine",
            "hi": "तारली (Tarli)",
            "kn": "ಬೂತಾಯಿ (Boothai)",
            "mr": "तारली (Tarli)",
        },
        "optimal_sst": (26.5, 28.5),
        "sst_tolerance": 2.0,
        "optimal_chl": (1.4, 4.0),
        "typical_depth_m": (10, 40),
        "market_price_inr_per_kg": 140,
        "catch_rate_kg_hr": 35,
        "schooling_type": "Dense coastal pelagic",
        "description": "Plankton feeder that blooms along the Malabar and Konkan coasts during active monsoon and post-monsoon upwelling.",
    },
    "pomfret": {
        "id": "pomfret",
        "name": "Silver Pomfret",
        "scientific_name": "Pampus argenteus",
        "vernacular": {
            "en": "Silver Pomfret",
            "hi": "पापलेट (Paplet)",
            "kn": "ಮಾನಂಜಿ (Manji)",
            "mr": "पापलेट (Paplet)",
        },
        "optimal_sst": (25.5, 28.0),
        "sst_tolerance": 2.2,
        "optimal_chl": (0.6, 2.2),
        "typical_depth_m": (20, 60),
        "market_price_inr_per_kg": 480,
        "catch_rate_kg_hr": 14,
        "schooling_type": "Benthopelagic / muddy shelf",
        "description": "High-value commercial species inhabiting continental shelves and soft muddy bottoms.",
    },
    "tuna": {
        "id": "tuna",
        "name": "Yellowfin Tuna",
        "scientific_name": "Thunnus albacares",
        "vernacular": {
            "en": "Yellowfin Tuna",
            "hi": "कुपा (Kupa / Tuna)",
            "kn": "ಗೆದ್ದಾರೆ (Geddare / Kera)",
            "mr": "गेदारे (Gedare)",
        },
        "optimal_sst": (26.0, 30.0),
        "sst_tolerance": 3.0,
        "optimal_chl": (0.2, 1.2),
        "typical_depth_m": (40, 200),
        "market_price_inr_per_kg": 240,
        "catch_rate_kg_hr": 20,
        "schooling_type": "Oceanic pelagic",
        "description": "Migratory predator found along shelf breaks, seamounts, and strong thermal divergence zones.",
    },
    "hilsa": {
        "id": "hilsa",
        "name": "Hilsa Shad",
        "scientific_name": "Tenualosa ilisha",
        "vernacular": {
            "en": "Hilsa Shad",
            "hi": "हिल्सा / इलिश (Ilish)",
            "kn": "ಹಿಲ್ಸಾ (Hilsa)",
            "mr": "हिल्सा (Hilsa)",
        },
        "optimal_sst": (24.0, 28.0),
        "sst_tolerance": 2.5,
        "optimal_chl": (1.2, 3.8),
        "typical_depth_m": (5, 35),
        "market_price_inr_per_kg": 650,
        "catch_rate_kg_hr": 10,
        "schooling_type": "Anadromous estuarine/shelf",
        "description": "Renowned silver fish migrating through the Bay of Bengal, Hooghly, and coastal river plumes.",
    },
}


def list_species() -> List[Dict]:
    """Return catalog of all supported species."""
    return list(SPECIES_CATALOG.values())


def get_species(species_id: Optional[str]) -> Optional[Dict]:
    """Retrieve species metadata by id."""
    if not species_id:
        return None
    return SPECIES_CATALOG.get(species_id.lower().strip())


def calculate_species_suitability(
    species_id: str,
    sst: Optional[float],
    chlorophyll: Optional[float],
) -> Dict:
    """Calculate habitat suitability index (0.0 - 1.0) for a specific species."""
    sp = get_species(species_id)
    if not sp:
        return {"suitability": 0.5, "sst_score": 0.5, "chl_score": 0.5, "status": "Average"}

    # 1. SST Suitability
    sst_score = 0.5
    if sst is not None:
        sst_lo, sst_hi = sp["optimal_sst"]
        if sst_lo <= sst <= sst_hi:
            sst_score = 1.0
        else:
            diff = (sst_lo - sst) if sst < sst_lo else (sst - sst_hi)
            sst_score = max(0.1, 1.0 - (diff / sp["sst_tolerance"]) * 0.9)

    # 2. Chlorophyll Suitability
    chl_score = 0.5
    if chlorophyll is not None:
        chl_lo, chl_hi = sp["optimal_chl"]
        if chl_lo <= chlorophyll <= chl_hi:
            chl_score = 1.0
        elif chlorophyll < chl_lo:
            chl_score = max(0.15, chlorophyll / (chl_lo or 1.0))
        else:
            excess = chlorophyll - chl_hi
            chl_score = max(0.3, 1.0 - (excess / 3.0) * 0.6)

    # Weighted composite suitability
    suitability = round(sst_score * 0.55 + chl_score * 0.45, 2)
    if suitability >= 0.8:
        status = "Optimal Habitat"
    elif suitability >= 0.55:
        status = "Favourable"
    elif suitability >= 0.35:
        status = "Moderate"
    else:
        status = "Poor Conditions"

    return {
        "species_id": sp["id"],
        "species_name": sp["name"],
        "scientific_name": sp["scientific_name"],
        "suitability": suitability,
        "sst_score": round(sst_score, 2),
        "chl_score": round(chl_score, 2),
        "status": status,
        "market_price": sp["market_price_inr_per_kg"],
    }


def adjust_trip_economics(
    base_economics: Dict,
    species_id: Optional[str],
) -> Dict:
    """Adjust catch value and expected profit when a target species is selected."""
    sp = get_species(species_id)
    if not sp:
        return base_economics

    adjusted = dict(base_economics)
    price_per_kg = sp["market_price_inr_per_kg"]

    # Typical catch weight adjusted for species productivity
    catch_kg = base_economics.get("catch_kg", 55)
    adjusted["target_species"] = {
        "id": sp["id"],
        "name": sp["name"],
        "price_per_kg": price_per_kg,
    }
    adjusted["price_per_kg"] = price_per_kg
    adjusted["revenue_inr"] = int(catch_kg * price_per_kg)
    adjusted["gross_revenue_inr"] = adjusted["revenue_inr"]
    fuel = base_economics.get("fuel_cost_inr", 750)
    adjusted["profit_inr"] = int(adjusted["revenue_inr"] - fuel)
    adjusted["net_profit_inr"] = adjusted["profit_inr"]
    desc = (
        f"Targeting {sp['name']} @ ₹{price_per_kg}/kg | "
        f"Estimate: {catch_kg} kg catch, ₹{adjusted['profit_inr']} net profit"
    )
    adjusted["assumption"] = desc
    adjusted["assumptions"] = desc
    return adjusted
