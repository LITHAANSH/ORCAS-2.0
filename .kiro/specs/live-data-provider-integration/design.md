# Design Document: Live Data Provider Integration

## Overview

This design transforms ORCA from a demonstration system with simulated data into a production-grade marine intelligence platform that consumes live data from authoritative sources while maintaining strict provenance tracking and safety guarantees. The system must NEVER fabricate official warnings or PFZ advisories, and must fail safely by marking data as unavailable rather than substituting demo values in LIVE mode.

### Core Principles

1. **Provenance First**: Every data point tracks its source, timestamp, and operational mode
2. **Fail Safe**: Mark data unavailable rather than substitute demo data in LIVE mode
3. **Deterministic Risk**: LLMs never compute risk scores; only the weighted-factor model with safety floors
4. **Independent Testing**: Each provider is a standalone module with clear contracts
5. **Backward Compatible**: Existing API contracts preserved; provenance added as extensions

### Key Design Decisions

**Provider Architecture**: Each external data source (Copernicus, INCOIS, IMD, Open-Meteo) is implemented as an independent module behind a common interface. This allows providers to fail independently without cascading failures.

**Mode Semantics**: 
- `LIVE`: All data from external APIs, failures marked UNAVAILABLE
- `DEMO`: All data from demo_store, for offline demonstrations
- `PARTIAL`: Mix of LIVE and UNAVAILABLE, when some providers fail
- `CACHE`: Stale but valid cached data served during provider degradation

**Caching Strategy**: Aggressive caching (10min-24hr TTLs) based on data volatility. One response contains 72 hours of hourly data, spatially rounded to ~1km grid for cache key reuse.

**Safety Overrides**: Official warnings (IMD severe cyclone, INCOIS fishermen advisory) apply deterministic score floors that cannot be overridden by model calculations or LLM outputs.

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FastAPI Backend                             │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Planner (Orchestrator)                     │  │
│  │  - Intent classification                                      │  │
│  │  - Parallel agent execution                                   │  │
│  │  - Mode calculation (LIVE/DEMO/PARTIAL)                      │  │
│  │  - Response assembly                                          │  │
│  └────┬──────────────┬──────────────┬──────────────┬────────────┘  │
│       │              │              │              │                │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐          │
│  │ Weather  │  │  Ocean   │  │   PFZ    │  │ Cyclone  │          │
│  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │             │              │              │                │
│  ┌────▼─────────────▼──────────────▼──────────────▼─────┐          │
│  │              Provider Layer                           │          │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │          │
│  │  │  Open   │  │Coperni- │  │ INCOIS  │  │   IMD   │ │          │
│  │  │  Meteo  │  │  cus    │  │Provider │  │Provider │ │          │
│  │  │Provider │  │Provider │  └─────────┘  └─────────┘ │          │
│  │  └────┬────┘  └────┬────┘                           │          │
│  └───────┼────────────┼────────────────────────────────┘          │
│          │            │                                            │
│  ┌───────▼────────────▼────────────────────────────────┐          │
│  │           Cache Layer (Thread-Safe)                 │          │
│  │  - TTL-based eviction                               │          │
│  │  - Spatial rounding (lat/lon to ~1km)              │          │
│  │  - LRU fallback when size limit reached            │          │
│  └─────────────────────────────────────────────────────┘          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────┐          │
│  │            Risk Engine (Deterministic)              │          │
│  │  - Weighted factor model                            │          │
│  │  - Safety floor overrides                           │          │
│  │  - No LLM influence on scores                       │          │
│  └─────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
         │               │              │              │
         ▼               ▼              ▼              ▼
    Open-Meteo    Copernicus    INCOIS API      IMD API
  (weather/marine)  (currents)   (PFZ bulletin)  (CAP/bulletin)
```

### Data Flow: LIVE Mode Request

```
1. User Request → Intent Agent
   ↓
2. Planner determines needed agents (weather, ocean, pfz, cyclone, gis)
   ↓
3. Parallel execution:
   Weather Agent → Open-Meteo Provider → Cache → API (if cache miss)
   Ocean Agent → Open-Meteo + Copernicus → Cache → APIs
   PFZ Agent → INCOIS Provider → Cache → API
   Cyclone Agent → IMD Provider → Cache → API
   GIS Agent → Static geospatial data (no provider)
   ↓
4. Each agent returns AgentResult with:
   - data: structured payload
   - source: provider identifier
   - mode: LIVE | UNAVAILABLE | CACHE
   - provenance: source, timestamp, confidence
   ↓
5. Risk Engine combines agent data:
   - Weighted factor calculation
   - Safety floor application (IMD warnings override)
   ↓
6. Planner calculates global mode:
   - All LIVE → mode = LIVE
   - Any UNAVAILABLE → mode = PARTIAL
   - Config = DEMO → mode = DEMO
   ↓
7. Response assembly:
   - Provenance in each data object
   - sources dict: {weather: LIVE, waves: LIVE, pfz: UNAVAILABLE, ...}
   - data_mode: LIVE | PARTIAL | DEMO
```

## Component Design

### 1. Provider Base Interface

**Location**: `backend/app/data/providers/__init__.py`

All providers implement this implicit contract:

```python
class BaseProvider(Protocol):
    """Provider interface contract."""
    
    def fetch(self, lat: float, lon: float, when: datetime) -> Optional[Dict]:
        """Fetch data for location and time.
        
        Returns:
            Dict with keys: data, metadata, timestamp
            None on any failure (timeout, invalid data, network error)
        """
        ...
```

**Common Provider Behaviors**:
- Return `None` on any failure (timeout, HTTP error, validation failure)
- Include metadata: `{source: str, valid_time: str, mode: str}`
- Log failures to stdout with format: `[ORCA][LIVE][{type}] {Provider} FAILED: {reason}`
- Use configured timeouts (30s for data, 10s for alerts)

### 2. Open-Meteo Provider (Refactored)

**Location**: `backend/app/data/providers/open_meteo.py`

Refactors existing `live_client.py` into proper provider module.

```python
class OpenMeteoProvider:
    """Weather and marine data from Open-Meteo APIs."""
    
    MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
    FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
    TIMEOUT = 30.0
    CACHE_TTL = 600.0  # 10 minutes
    
    def fetch_marine(self, lat: float, lon: float, when: datetime) -> Optional[Dict]:
        """Fetch wave height, wave period, SST.
        
        Returns:
            {
                data: {
                    wave_height_m: float,
                    wave_period_s: float,
                    sst_c: float
                },
                metadata: {
                    source: "Open-Meteo Marine",
                    valid_time: "2024-01-15T06:00:00+05:30",
                    mode: "LIVE"
                },
                timestamp: "2024-01-15T06:00:00+05:30"
            }
        """
        pass
    
    def fetch_weather(self, lat: float, lon: float, when: datetime) -> Optional[Dict]:
        """Fetch wind, rain probability, visibility, temperature.
        
        Returns:
            {
                data: {
                    temperature_c: float,
                    wind_speed_kmh: float,
                    wind_direction_deg: float,
                    rain_probability_pct: float,
                    visibility_km: float
                },
                metadata: {...},
                timestamp: "..."
            }
        """
        pass
```

**Implementation Notes**:
- Reuse existing cache infrastructure from `live_client.py`
- Keep spatial rounding (2 decimals ~1.1km) for cache keys
- Keep 3-day hourly fetch strategy
- Extract `_series()` and `_pick_hour_index()` as private methods
- Thread-safe via existing `_lock` mechanism

**Error Handling**:
```python
try:
    response = httpx.get(url, params=params, timeout=self.TIMEOUT)
    response.raise_for_status()
    hourly = response.json().get("hourly")
    if not hourly or not hourly.get("time"):
        return None
    # extract and return data
except httpx.TimeoutException:
    log("[ORCA][LIVE][MARINE] Open-Meteo TIMEOUT")
    return None
except httpx.HTTPStatusError as e:
    log(f"[ORCA][LIVE][MARINE] Open-Meteo HTTP {e.response.status_code}")
    return None
except Exception as e:
    log(f"[ORCA][LIVE][MARINE] Open-Meteo ERROR: {e}")
    return None
```

### 3. Copernicus Marine Provider

**Location**: `backend/app/data/providers/copernicus.py`

Fetches satellite-derived ocean currents and chlorophyll concentration.

```python
class CopernicusProvider:
    """Ocean currents and chlorophyll from Copernicus Marine Service."""
    
    # NRT (Near Real Time) products - available within 24h of observation
    CURRENT_PRODUCT = "cmems_mod_glo_phy_anfc_0.083deg_PT1H-m"  # global ocean physics
    CHLOROPHYLL_PRODUCT = "cmems_obs_glo_bgc_phy_my_l4_P1D"     # daily L4 chlorophyll
    
    BASE_URL = "https://nrt.cmems-du.eu/motu-web/Motu"
    TIMEOUT = 30.0
    CACHE_TTL_CURRENT = 1800.0      # 30 minutes (NRT data changes hourly)
    CACHE_TTL_CHLOROPHYLL = 86400.0  # 24 hours (daily product)
    
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self._client = httpx.Client(timeout=self.TIMEOUT, auth=(username, password))
    
    def fetch_current(self, lat: float, lon: float, when: datetime) -> Optional[Dict]:
        """Fetch surface current (U/V components) from NRT analysis.
        
        Returns:
            {
                data: {
                    current_speed_ms: float,     # computed from U,V
                    current_direction_deg: float # 0-360, clockwise from N
                },
                metadata: {
                    source: "Copernicus Marine Service",
                    valid_time: "2024-01-15T06:00:00+05:30",
                    mode: "LIVE"
                },
                timestamp: "..."
            }
            
            Returns None if:
            - Pixel is on land
            - Pixel has missing data flag
            - Values are NaN
            - Network/auth failure
        """
        pass
    
    def fetch_chlorophyll(self, lat: float, lon: float, when: datetime) -> Optional[Dict]:
        """Fetch chlorophyll-a concentration from satellite L4 product.
        
        Returns:
            {
                data: {
                    chlorophyll_mg_m3: float
                },
                metadata: {...},
                timestamp: "..."
            }
        """
        pass
    
    def _convert_uv_to_speed_direction(self, u: float, v: float) -> Tuple[float, float]:
        """Convert U/V current components to speed (m/s) and direction (deg).
        
        Direction: 0° = north, 90° = east, 180° = south, 270° = west
        (oceanographic convention)
        """
        speed = math.sqrt(u**2 + v**2)
        direction = (270 - math.degrees(math.atan2(v, u))) % 360
        return speed, direction
```

**API Call Pattern** (MOTU Protocol):
```python
params = {
    "action": "describeProduct",
    "service": "GLOBAL_ANALYSISFORECAST_PHY_001_024-TDS",
    "product": self.CURRENT_PRODUCT,
    "longitude": lon,
    "latitude": lat,
    "time": when.isoformat(),
    "depth": 0.0,  # surface only
    "variable": ["uo", "vo"]  # eastward, northward velocity
}
```

**Credential Management**:
```python
# Read from environment variables
COPERNICUS_USERNAME = os.getenv("COPERNICUS_USERNAME")
COPERNICUS_PASSWORD = os.getenv("COPERNICUS_PASSWORD")

if not COPERNICUS_USERNAME or not COPERNICUS_PASSWORD:
    # Provider remains uninitialized, returns UNAVAILABLE for all requests
    log("[ORCA] Copernicus credentials missing - provider disabled")
```

**Missing Data Handling**:
```python
# Copernicus returns NaN or missing-data flags for:
# - Land pixels
# - Cloud-covered areas (chlorophyll)
# - Data gaps in NRT processing

if value is None or math.isnan(value) or value < -900:  # common missing flag
    log(f"[ORCA][LIVE][CURRENT] Copernicus missing data at ({lat}, {lon})")
    return None
```

### 4. INCOIS PFZ Provider

**Location**: `backend/app/data/providers/incois.py`

Fetches official Potential Fishing Zone advisories.

```python
class INCOISProvider:
    """Official PFZ advisories from INCOIS."""
    
    # Bulletin endpoint - district-wise PFZ advisories issued twice weekly
    BULLETIN_URL = "https://incois.gov.in/portal/osf/pfz_bulletin.jsp"
    API_URL = "https://incois.gov.in/portal/api/pfz/zones"  # if documented API exists
    
    TIMEOUT = 30.0
    CACHE_TTL = 21600.0  # 6 hours (bulletins issued twice daily)
    
    def fetch_pfz_zones(self, lat: float, lon: float, when: datetime) -> Optional[Dict]:
        """Fetch official PFZ zones from INCOIS bulletin.
        
        NOTE: INCOIS provides advisories, not raw SST/chlorophyll data.
        We fetch their computed zones, not compute our own.
        
        Returns:
            {
                data: {
                    zones: [
                        {
                            latitude: float,
                            longitude: float,
                            sst_c: float,
                            chlorophyll_mg_m3: float,
                            valid_from: "2024-01-15T00:00:00+05:30",
                            valid_until: "2024-01-16T23:59:59+05:30",
                            district: "Mumbai",
                            advisory_number: "PFZ-12/2024"
                        },
                        ...
                    ]
                },
                metadata: {
                    source: "INCOIS",
                    valid_time: "2024-01-15T00:00:00+05:30",
                    mode: "LIVE",
                    bulletin_issue_time: "2024-01-15T08:00:00+05:30"
                },
                timestamp: "..."
            }
        """
        pass
    
    def _parse_bulletin(self, html: str) -> List[Dict]:
        """Extract PFZ zones from INCOIS bulletin HTML.
        
        Bulletin format (as of 2024):
        - District-wise sections
        - Coordinates in degrees/minutes
        - SST and chlorophyll values
        - Validity period
        """
        pass
    
    def _nearest_district(self, lat: float, lon: float) -> str:
        """Map coordinates to INCOIS district for bulletin lookup."""
        # INCOIS districts: Mumbai, Goa, Kerala, Tamil Nadu, Andhra Pradesh, 
        # Odisha, West Bengal, Gujarat, Lakshadweep, Andaman & Nicobar
        pass
```

**Data Schema Transformation**:

INCOIS provides: `{district, zone_id, lat_deg, lat_min, lon_deg, lon_min, sst, chl, date}`

ORCA needs: `{latitude, longitude, sst_c, chlorophyll_mg_m3, valid_from, valid_until}`

```python
def _transform_zone(self, raw: Dict) -> Dict:
    """Convert INCOIS bulletin format to ORCA schema."""
    latitude = raw["lat_deg"] + raw["lat_min"] / 60.0
    longitude = raw["lon_deg"] + raw["lon_min"] / 60.0
    
    return {
        "latitude": round(latitude, 4),
        "longitude": round(longitude, 4),
        "sst_c": float(raw["sst"]),
        "chlorophyll_mg_m3": float(raw["chl"]),
        "valid_from": f"{raw['date']}T00:00:00+05:30",
        "valid_until": f"{raw['date']}T23:59:59+05:30",
        "district": raw["district"],
        "advisory_number": raw["bulletin_id"],
        "source": "INCOIS"
    }
```

**Fallback Strategy**:
```python
# If documented API doesn't exist yet, parse bulletin HTML
# Include disclaimer in design that integration depends on INCOIS providing:
# 1. Documented public API, OR
# 2. Structured bulletin format (JSON/XML), OR
# 3. Data-sharing arrangement

# For hackathon/demo: Use Open-Meteo SST + Copernicus chlorophyll with
# ORCA's existing zone computation, but label as "ORCA-computed" not "INCOIS"
```

### 5. IMD Cyclone Provider

**Location**: `backend/app/data/providers/imd.py`

Fetches official cyclone warnings and marine alerts.

```python
class IMDProvider:
    """Official cyclone warnings and marine alerts from IMD."""
    
    # IMD provides multiple endpoints:
    CAP_FEED_URL = "https://imd.gov.in/cap/alerts"  # Common Alerting Protocol
    BULLETIN_URL = "https://imd.gov.in/weather/cyclone"
    TRACK_URL = "https://imd.gov.in/track/current"
    
    TIMEOUT = 10.0  # Alerts are urgent - shorter timeout
    CACHE_TTL = 1800.0  # 30 minutes (alerts change infrequently but are critical)
    POLL_INTERVAL = 1800.0  # Don't poll more than once per 30 min
    
    def fetch_alerts(self, lat: float, lon: float, when: datetime) -> Optional[Dict]:
        """Fetch active cyclone warnings and fishermen advisories.
        
        Returns:
            {
                data: {
                    alerts: [
                        {
                            type: "cyclone_warning" | "fishermen_warning" | "high_wave_alert",
                            severity: "severe" | "high" | "moderate" | "low",
                            headline: str,
                            detail: str,
                            latitude: float,  # storm center
                            longitude: float,
                            wind_speed_kmh: float,
                            pressure_hpa: float,
                            issued_at: "2024-01-15T08:00:00+05:30",
                            geometry: {...},  # CAP polygon if available
                            official: true,
                            source: "IMD"
                        },
                        ...
                    ],
                    count: int,
                    official_warning_active: bool
                },
                metadata: {
                    source: "IMD",
                    valid_time: "...",
                    mode: "LIVE"
                },
                timestamp: "..."
            }
        """
        pass
    
    def _parse_cap_alert(self, cap_xml: str) -> List[Dict]:
        """Parse CAP (Common Alerting Protocol) XML feed."""
        # CAP provides: <alert><info><severity>, <certainty>, <headline>, 
        #                <description>, <area><polygon>
        pass
    
    def _classify_severity(self, wind_kmh: float, pressure_hpa: float) -> str:
        """Classify cyclone severity from wind speed and pressure.
        
        IMD Classification:
        - Depression: wind < 51 km/h
        - Deep Depression: 51-61 km/h
        - Cyclonic Storm: 62-88 km/h
        - Severe Cyclonic Storm: 89-117 km/h (our "high")
        - Very Severe: 118-167 km/h (our "severe")
        - Extremely Severe: 168-221 km/h (our "severe")
        - Super Cyclone: > 222 km/h (our "severe")
        """
        if wind_kmh >= 118 or pressure_hpa < 990:
            return "severe"
        elif wind_kmh >= 89 or pressure_hpa < 996:
            return "high"
        elif wind_kmh >= 62:
            return "moderate"
        else:
            return "low"
    
    def _is_alert_active(self, alert: Dict) -> bool:
        """Check if cyclone is active based on wind/pressure thresholds."""
        wind = alert.get("wind_speed_kmh", 0)
        pressure = alert.get("pressure_hpa", 1013)
        return wind > 120 and pressure < 990
    
    def _convert_units(self, alert: Dict) -> Dict:
        """Convert IMD units to ORCA standard units.
        
        - Wind: knots → km/h (multiply by 1.852)
        - Pressure: mb → hPa (1:1 equivalence)
        """
        if "wind_speed_kt" in alert:
            alert["wind_speed_kmh"] = round(alert["wind_speed_kt"] * 1.852, 1)
        if "pressure_mb" in alert:
            alert["pressure_hpa"] = alert["pressure_mb"]
        return alert
```

**Fishermen Warning Detection**:
```python
def _extract_fishermen_warning(self, bulletin_text: str) -> Optional[Dict]:
    """Extract fishermen advisory from IMD bulletin text.
    
    Looks for phrases:
    - "Fishermen are advised not to venture"
    - "Fishermen advised to return to coast"
    - "Sea condition rough to very rough"
    """
    keywords = [
        "fishermen advised not to venture",
        "fishermen are advised to return",
        "advised not to venture into"
    ]
    
    if any(kw in bulletin_text.lower() for kw in keywords):
        return {
            "type": "fishermen_warning",
            "severity": "moderate",  # default for fishermen advisory
            "headline": "Fishermen advised not to venture into the sea",
            "detail": self._extract_warning_detail(bulletin_text),
            "official": True,
            "source": "IMD"
        }
    return None
```

**Alert Polygon Processing**:
```python
def _parse_geometry(self, cap_area: dict) -> Optional[Dict]:
    """Extract warning area geometry from CAP alert.
    
    CAP provides polygon as space-separated lat,lon pairs:
    "19.5,72.8 19.8,73.0 20.0,72.5 19.5,72.8"
    
    Convert to GeoJSON-like structure for frontend rendering.
    """
    polygon_str = cap_area.get("polygon", "")
    if not polygon_str:
        return None
    
    try:
        points = []
        for pair in polygon_str.strip().split():
            lat, lon = map(float, pair.split(","))
            points.append([lon, lat])  # GeoJSON uses [lon, lat] order
        
        return {
            "type": "Polygon",
            "coordinates": [points]
        }
    except Exception as e:
        log(f"[ORCA][IMD] Failed to parse CAP polygon: {e}")
        return None
```

## Data Models

### Provider Response Schema

```python
class ProviderResponse(BaseModel):
    """Standard response envelope from all providers."""
    
    data: Dict[str, Any]  # Provider-specific payload
    metadata: ProviderMetadata
    timestamp: str  # ISO 8601 with timezone
    
class ProviderMetadata(BaseModel):
    """Provenance metadata attached to every provider response."""
    
    source: str  # "Open-Meteo", "Copernicus Marine Service", "INCOIS", "IMD"
    valid_time: str  # ISO 8601 - when this data is valid for
    mode: Literal["LIVE", "CACHE", "UNAVAILABLE"]
    confidence: Optional[float] = None  # 0.0-1.0 if provider supplies it
    note: Optional[str] = None  # e.g., "NRT data - 3hr delay"
```

### Extended AgentResult Schema

```python
class AgentResult(BaseModel):
    """Extended with provenance and mode tracking."""
    
    agent: str
    ok: bool = True
    location: Optional[Location] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    measurements: Dict[str, Measurement] = Field(default_factory=dict)
    
    # Provenance fields
    source: str = "DEMO"  # Provider identifier or "DEMO"
    timestamp: str = ""   # ISO 8601
    mode: DataMode = "DEMO"  # LIVE | DEMO | CACHE | UNAVAILABLE
    
    # Status fields
    unavailable: List[str] = Field(default_factory=list)  # Missing parameters
    confidence: Optional[float] = None
    latency_ms: Optional[int] = None
    error: Optional[str] = None
```

### Cache Entry Schema

```python
@dataclass
class CacheEntry:
    """In-memory cache entry for provider responses."""
    
    key: CacheKey  # (provider, lat_rounded, lon_rounded)
    data: Optional[Dict]  # Hourly series or alert list
    expires_at: float  # monotonic timestamp
    created_at: float
    size_bytes: int  # For LRU eviction
    
@dataclass
class CacheKey:
    """Composite cache key."""
    
    provider: str  # "open_meteo_marine", "copernicus_current", etc.
    lat: float  # Rounded to 2 decimals (~1.1 km)
    lon: float  # Rounded to 2 decimals
    
    def __hash__(self):
        return hash((self.provider, self.lat, self.lon))
```

### API Response Extensions

```python
class ChatResponse(BaseModel):
    """Extended with provenance tracking."""
    
    # ... existing fields ...
    
    # NEW: Global mode indicator
    mode: DataMode = "DEMO"  # LIVE | PARTIAL | DEMO
    
    # NEW: Per-data-type source status
    sources: Dict[str, str] = Field(default_factory=dict)
    # Example: {
    #   "weather": "LIVE",
    #   "waves": "LIVE",
    #   "currents": "UNAVAILABLE",
    #   "chlorophyll": "CACHE",
    #   "pfz": "UNAVAILABLE",
    #   "cyclone": "LIVE",
    #   "gis": "STATIC"
    # }
    
    disclaimer: str = ""  # DEMO disclaimer or provider limitations
```

## Agent Integration

### Ocean Agent Integration

**Before** (current):
```python
@timed
def run(location: Location, when: datetime) -> AgentResult:
    live = live_client.fetch_marine(lat, lon, when) if live_enabled() else None
    cond = demo_store.conditions(location.name, when)
    
    if live:
        # Use live data
        wave = live["wave_height_m"]
        mode, source = "LIVE", "OPEN_METEO"
    else:
        # Fall back to demo
        wave = cond["wave"]
        mode, source = "DEMO", "DEMO"
```

**After** (with provider integration):
```python
@timed
def run(location: Location, when: datetime) -> AgentResult:
    mode_config = get_data_mode()
    unavailable = []
    
    if mode_config == "DEMO":
        # Pure DEMO mode - no provider calls
        cond = demo_store.conditions(location.name, when)
        return AgentResult(
            agent="ocean",
            data={
                "wave_height_m": cond["wave"],
                "current_speed_ms": cond["current"],
                "chlorophyll_mg_m3": cond["chl"],
                # ...
            },
            source="DEMO",
            mode="DEMO"
        )
    
    # LIVE mode - call providers
    marine_result = open_meteo_provider.fetch_marine(location.latitude, 
                                                     location.longitude, when)
    current_result = copernicus_provider.fetch_current(location.latitude,
                                                       location.longitude, when)
    chlorophyll_result = copernicus_provider.fetch_chlorophyll(location.latitude,
                                                                location.longitude, when)
    
    # Combine results
    data = {}
    sources = []
    modes = []
    
    if marine_result:
        data.update(marine_result["data"])
        sources.append(marine_result["metadata"]["source"])
        modes.append(marine_result["metadata"]["mode"])
    else:
        unavailable.append("Wave data unavailable from Open-Meteo")
    
    if current_result:
        data.update(current_result["data"])
        sources.append(current_result["metadata"]["source"])
        modes.append(current_result["metadata"]["mode"])
    else:
        unavailable.append("Current data unavailable from Copernicus")
    
    if chlorophyll_result:
        data.update(chlorophyll_result["data"])
        sources.append(chlorophyll_result["metadata"]["source"])
        modes.append(chlorophyll_result["metadata"]["mode"])
    else:
        unavailable.append("Chlorophyll data unavailable from Copernicus")
    
    # Determine aggregated mode
    if not data:
        # Total failure
        return AgentResult(agent="ocean", ok=False,
                          error="All ocean data providers unavailable",
                          mode="UNAVAILABLE")
    
    # At least one provider succeeded
    aggregated_mode = "CACHE" if "CACHE" in modes else "LIVE"
    aggregated_source = ", ".join(dict.fromkeys(sources))
    
    return AgentResult(
        agent="ocean",
        ok=True,
        location=location,
        data=data,
        unavailable=unavailable,
        source=aggregated_source,
        mode=aggregated_mode,
        timestamp=when.isoformat()
    )
```

### PFZ Agent Integration

**Key Changes**:
1. Call `INCOIS_Provider.fetch_pfz_zones()` in LIVE mode
2. Apply ORCA safety filters (wave height, distance, restricted zones)
3. Preserve INCOIS provenance with annotation for filtered zones

```python
@timed
def run(location: Location, when: datetime, count: int = 3) -> AgentResult:
    mode_config = get_data_mode()
    
    if mode_config == "DEMO":
        zones = demo_store.pfz_zones(location.latitude, location.longitude,
                                    location.name, when, count)
        return AgentResult(agent="pfz", ok=True, 
                          data={"zones": zones}, mode="DEMO")
    
    # LIVE mode - fetch from INCOIS
    incois_result = incois_provider.fetch_pfz_zones(location.latitude,
                                                    location.longitude, when)
    
    if not incois_result:
        return AgentResult(
            agent="pfz",
            ok=False,
            error="INCOIS PFZ data unavailable",
            mode="UNAVAILABLE",
            unavailable=["INCOIS service timeout or data unavailable"]
        )
    
    # Apply ORCA safety filters
    raw_zones = incois_result["data"]["zones"]
    weather = weather_agent_cache.get(location, when)  # Get from planner context
    
    safe_zones = []
    filtered_out = []
    
    for zone in raw_zones:
        # Safety criteria from requirements
        wave_at_zone = zone.get("wave_height_m") or weather.get("wave_height_m", 0)
        distance = haversine_km(
            (location.latitude, location.longitude),
            (zone["latitude"], zone["longitude"])
        )
        
        # Requirement 7.3: Exclude if wave > 3.0m OR distance > 150km
        if wave_at_zone > 3.0:
            filtered_out.append({**zone, "reason": "Wave height exceeds 3.0m"})
            continue
        if distance > 150.0:
            filtered_out.append({**zone, "reason": "Distance exceeds 150km"})
            continue
        
        # Check restricted zones
        if _blocking_zone(zone["latitude"], zone["longitude"]):
            filtered_out.append({**zone, "reason": "Inside restricted area"})
            continue
        
        # Zone passed filters
        zone["source"] = "INCOIS (ORCA filtered)"  # Req 7.6
        safe_zones.append(zone)
    
    # Rank safe zones by ORCA scoring
    safe_zones.sort(key=_score, reverse=True)
    safe_zones = safe_zones[:count]
    
    return AgentResult(
        agent="pfz",
        ok=True,
        location=location,
        data={
            "zones": safe_zones,
            "excluded_count": len(filtered_out),
            "original_count": len(raw_zones),
            "source": "INCOIS",
            "filter_note": "ORCA safety filters applied (wave height, distance, restricted zones)"
        },
        source=incois_result["metadata"]["source"],
        mode=incois_result["metadata"]["mode"],
        timestamp=incois_result["timestamp"]
    )
```

### Cyclone Agent Integration

```python
@timed
def run(location: Location, when: datetime) -> AgentResult:
    mode_config = get_data_mode()
    
    if mode_config == "DEMO":
        alerts = demo_store.alerts(location.name, when)
        return AgentResult(agent="cyclone", ok=True,
                          data={"alerts": alerts, "count": len(alerts)},
                          mode="DEMO")
    
    # LIVE mode - fetch from IMD
    imd_result = imd_provider.fetch_alerts(location.latitude,
                                          location.longitude, when)
    
    if not imd_result:
        # IMD timeout - not a critical failure, return empty alerts
        return AgentResult(
            agent="cyclone",
            ok=True,  # ok=True per requirement 8.4
            data={
                "alerts": [],
                "count": 0,
                "official_warning_active": False
            },
            mode="UNAVAILABLE",
            unavailable=["IMD alert service unavailable"]
        )
    
    alerts = imd_result["data"]["alerts"]
    
    # Sort by severity
    severity_rank = {"severe": 3, "high": 2, "moderate": 1, "low": 0}
    alerts.sort(key=lambda a: severity_rank.get(a["severity"], 0), reverse=True)
    
    official_active = any(a.get("official") for a in alerts)
    
    return AgentResult(
        agent="cyclone",
        ok=True,
        location=location,
        data={
            "alerts": alerts,
            "count": len(alerts),
            "official_warning_active": official_active,
            "highest_severity": alerts[0]["severity"] if alerts else None,
            "headline": alerts[0]["headline"] if alerts else None
        },
        source=imd_result["metadata"]["source"],
        mode=imd_result["metadata"]["mode"],
        timestamp=imd_result["timestamp"]
    )
```

## Mode Management

### Mode Calculation Logic

**Planner Mode Determination**:

```python
def calculate_global_mode(config_mode: str, agent_results: List[AgentResult]) -> str:
    """Calculate global mode from config and agent results.
    
    Requirements 9.2-9.7:
    - Config = DEMO → always DEMO
    - All agents LIVE → LIVE
    - Any UNAVAILABLE → PARTIAL (most conservative mode present)
    """
    if config_mode == "DEMO":
        return "DEMO"
    
    # Collect modes from successful agents
    modes = [r.mode for r in agent_results if r.ok]
    
    if not modes:
        return "UNAVAILABLE"  # Total failure
    
    # Check for any non-LIVE modes
    if "UNAVAILABLE" in modes or "DEMO" in modes:
        return "PARTIAL"
    if "CACHE" in modes:
        return "PARTIAL"
    
    # All modes are LIVE
    return "LIVE"
```

**Per-Data-Type Source Tracking**:

```python
def build_sources_dict(agent_results: List[AgentResult]) -> Dict[str, str]:
    """Build sources dictionary mapping data types to their status.
    
    Requirements 13.3-13.5:
    sources = {
        "weather": "LIVE" | "UNAVAILABLE" | "DEMO" | "CACHE",
        "waves": ...,
        "currents": ...,
        "chlorophyll": ...,
        "pfz": ...,
        "cyclone": ...,
        "gis": "STATIC"  # GIS data never changes
    }
    """
    sources = {}
    
    for result in agent_results:
        if result.agent == "weather":
            sources["weather"] = result.mode
        elif result.agent == "ocean":
            # Ocean agent provides multiple data types
            if "wave_height_m" in result.data:
                sources["waves"] = result.mode
            if "current_speed_ms" in result.data:
                sources["currents"] = result.mode
            if "chlorophyll_mg_m3" in result.data:
                sources["chlorophyll"] = result.mode
        elif result.agent == "pfz":
            sources["pfz"] = result.mode
        elif result.agent == "cyclone":
            sources["cyclone"] = result.mode
        elif result.agent == "gis":
            sources["gis"] = "STATIC"
    
    # Mark missing data types as UNAVAILABLE
    for key in ["weather", "waves", "currents", "chlorophyll", "pfz", "cyclone"]:
        if key not in sources:
            sources[key] = "UNAVAILABLE"
    
    return sources
```

**Mode Transition Handling**:

```python
def set_data_mode(mode: str) -> str:
    """Set runtime data mode and clear caches.
    
    Requirement 17.6-17.7: Clear cache on mode switch.
    """
    mode = (mode or "").strip().upper()
    if mode not in ("LIVE", "DEMO"):
        raise ValueError("mode must be LIVE or DEMO")
    
    old_mode = _RUNTIME["data_mode"]
    _RUNTIME["data_mode"] = mode
    
    if old_mode != mode:
        # Mode switched - clear all cached provider data
        open_meteo_provider.clear_cache()
        copernicus_provider.clear_cache()
        incois_provider.clear_cache()
        imd_provider.clear_cache()
        
        log(f"[ORCA] Mode switched from {old_mode} to {mode}, caches cleared")
    
    return mode
```

## Caching Strategy

### Cache Implementation

**Location**: `backend/app/data/cache.py`

```python
class ProviderCache:
    """Thread-safe cache for provider responses with TTL and LRU eviction."""
    
    MAX_SIZE_MB = 256
    MAX_ENTRIES = 1024
    
    def __init__(self):
        self._cache: Dict[CacheKey, CacheEntry] = {}
        self._lock = threading.Lock()
        self._size_bytes = 0
    
    def get(self, provider: str, lat: float, lon: float) -> Optional[Dict]:
        """Retrieve cached data if not expired.
        
        Requirement 17.9: Spatial rounding to 2 decimals (~1.1km).
        """
        key = CacheKey(
            provider=provider,
            lat=round(lat, 2),
            lon=round(lon, 2)
        )
        
        now = time.monotonic()
        
        with self._lock:
            entry = self._cache.get(key)
            if entry and entry.expires_at > now:
                return entry.data
            elif entry:
                # Expired - remove
                self._cache.pop(key)
                self._size_bytes -= entry.size_bytes
        
        return None
    
    def put(self, provider: str, lat: float, lon: float, 
            data: Optional[Dict], ttl: float) -> None:
        """Store data with TTL-based expiration.
        
        Requirements 17.1-17.5: Provider-specific TTLs.
        Requirement 17.8: LRU eviction when size limit reached.
        """
        key = CacheKey(provider, round(lat, 2), round(lon, 2))
        
        # Estimate size
        size = len(str(data).encode()) if data else 0
        
        now = time.monotonic()
        entry = CacheEntry(
            key=key,
            data=data,
            expires_at=now + ttl,
            created_at=now,
            size_bytes=size
        )
        
        with self._lock:
            # Check size limit
            while (self._size_bytes + size > self.MAX_SIZE_MB * 1024 * 1024 or
                   len(self._cache) >= self.MAX_ENTRIES):
                # Evict oldest entry
                if not self._cache:
                    break
                oldest_key = min(self._cache.keys(), 
                               key=lambda k: self._cache[k].created_at)
                oldest = self._cache.pop(oldest_key)
                self._size_bytes -= oldest.size_bytes
            
            # Store new entry
            old_entry = self._cache.get(key)
            if old_entry:
                self._size_bytes -= old_entry.size_bytes
            
            self._cache[key] = entry
            self._size_bytes += size
    
    def clear(self) -> None:
        """Clear all cached entries."""
        with self._lock:
            self._cache.clear()
            self._size_bytes = 0
```

### TTL Configuration by Provider

```python
# backend/app/config.py

CACHE_TTLS = {
    "open_meteo_marine": 600.0,      # 10 min (forecast changes slowly)
    "open_meteo_weather": 600.0,     # 10 min
    "copernicus_current": 1800.0,    # 30 min (NRT hourly updates)
    "copernicus_chlorophyll": 86400.0,  # 24 hr (daily product)
    "incois_pfz": 21600.0,           # 6 hr (bulletins twice daily)
    "imd_alerts": 1800.0,            # 30 min (critical but stable)
}

# Graceful degradation: serve stale cache for short period after TTL
CACHE_GRACE_PERIOD = 300.0  # 5 minutes
```

### Cache Key Generation

```python
def cache_key_for_location(provider: str, lat: float, lon: float) -> CacheKey:
    """Generate cache key with spatial rounding.
    
    Requirement 17.9: Round to 2 decimals (~1.1 km at equator).
    This means dragging a boat around one bay reuses the same forecast.
    """
    return CacheKey(
        provider=provider,
        lat=round(lat, 2),
        lon=round(lon, 2)
    )

# Examples:
# (19.123456, 72.987654) → (19.12, 72.99)
# (19.126789, 72.989012) → (19.13, 72.99)  # same cache entry
# Geographic distance: ~1.1 km at this latitude
```

## Error Handling

### Provider Failure Scenarios

**Scenario 1: Network Timeout**

```python
# Provider code:
try:
    response = httpx.get(url, timeout=30.0)
except httpx.TimeoutException:
    log("[ORCA][LIVE][MARINE] Open-Meteo TIMEOUT after 30s")
    return None

# Agent code:
marine_result = provider.fetch_marine(lat, lon, when)
if not marine_result:
    unavailable.append("Wave data unavailable (provider timeout)")
    # Continue with other providers
```

**Scenario 2: HTTP Error (4xx, 5xx)**

```python
try:
    response = httpx.get(url, timeout=30.0)
    response.raise_for_status()
except httpx.HTTPStatusError as e:
    log(f"[ORCA][LIVE][MARINE] Open-Meteo HTTP {e.response.status_code}")
    return None
```

**Scenario 3: Invalid Response Data**

```python
try:
    data = response.json()
    hourly = data.get("hourly")
    if not hourly or not hourly.get("time"):
        log("[ORCA][LIVE][MARINE] Open-Meteo invalid response structure")
        return None
except json.JSONDecodeError:
    log("[ORCA][LIVE][MARINE] Open-Meteo invalid JSON")
    return None
```

**Scenario 4: Missing Satellite Data (Copernicus)**

```python
# Copernicus returns NaN for land pixels, cloud cover, data gaps
value = data.get("uo")  # eastward current component
if value is None or math.isnan(value) or value < -900:
    log(f"[ORCA][LIVE][CURRENT] Copernicus missing data at ({lat}, {lon})")
    return None
```

### Graceful Degradation

**Critical vs Non-Critical Providers**:

```python
# Requirement 18.2-18.3: Provider classification
CRITICAL_PROVIDERS = ["open_meteo", "imd"]  # Essential for risk calculation
NON_CRITICAL_PROVIDERS = ["copernicus", "incois"]  # Enhance but not required

def handle_provider_failure(provider: str, agent: str) -> str:
    """Determine how to handle provider failure.
    
    Returns: "FAIL_REQUEST" | "MARK_UNAVAILABLE"
    """
    if provider in CRITICAL_PROVIDERS:
        # Can still proceed if we have demo fallback for other agents
        # But mark this agent's data as unavailable
        return "MARK_UNAVAILABLE"
    else:
        # Non-critical - continue request with degraded data
        return "MARK_UNAVAILABLE"
```

**Stale Cache Fallback**:

```python
def get_with_grace_period(provider: str, lat: float, lon: float) -> Optional[Dict]:
    """Requirement 17.10: Serve stale cache if provider fails.
    
    If provider times out and cache is expired but within grace period,
    serve the stale data with mode=CACHE.
    """
    now = time.monotonic()
    key = cache_key_for_location(provider, lat, lon)
    
    with _lock:
        entry = _cache.get(key)
        if not entry:
            return None
        
        if entry.expires_at > now:
            # Fresh cache
            return entry.data
        
        if entry.expires_at + CACHE_GRACE_PERIOD > now:
            # Expired but within grace period
            log(f"[ORCA][CACHE] Serving stale {provider} data (age: {now - entry.created_at:.0f}s)")
            return {
                **entry.data,
                "metadata": {
                    **entry.data["metadata"],
                    "mode": "CACHE",
                    "note": "Stale cached data due to provider unavailability"
                }
            }
    
    return None
```

**Total Failure Response**:

```python
# Requirement 18.7: Return HTTP 503 if all critical providers fail
def handle_total_failure() -> JSONResponse:
    """All critical providers unavailable."""
    return JSONResponse(
        status_code=503,
        content={
            "error": "Marine data services unavailable",
            "detail": "All critical weather and ocean data providers are currently unreachable",
            "retry_after": 60,  # seconds
            "mode": "UNAVAILABLE"
        }
    )
```

## Security

### Credential Management

**Environment Variables**:

```bash
# .env (NOT committed to repository)
ORCA_DATA_MODE=LIVE
COPERNICUS_USERNAME=your_username
COPERNICUS_PASSWORD=your_password
ORCA_LIVE_TIMEOUT=30.0
```

**Configuration Loading**:

```python
# backend/app/config.py

COPERNICUS_USERNAME = os.getenv("COPERNICUS_USERNAME", "")
COPERNICUS_PASSWORD = os.getenv("COPERNICUS_PASSWORD", "")

# Requirement 12.8: Never log credentials
def mask_credentials(text: str) -> str:
    """Redact credentials from log messages."""
    if COPERNICUS_PASSWORD and COPERNICUS_PASSWORD in text:
        text = text.replace(COPERNICUS_PASSWORD, "***REDACTED***")
    return text

def log(message: str) -> None:
    """Log with credential masking."""
    print(mask_credentials(message), flush=True)
```

**Provider Initialization**:

```python
# Requirement 12.5: Handle missing credentials gracefully
def init_copernicus_provider() -> Optional[CopernicusProvider]:
    """Initialize Copernicus provider if credentials available."""
    username = os.getenv("COPERNICUS_USERNAME")
    password = os.getenv("COPERNICUS_PASSWORD")
    
    if not username or not password:
        log("[ORCA] Copernicus credentials missing - provider disabled")
        return None
    
    try:
        provider = CopernicusProvider(username, password)
        # Test credentials with ping request
        test_result = provider._test_auth()
        if not test_result:
            log("[ORCA] Copernicus authentication failed - provider disabled")
            return None
        return provider
    except Exception as e:
        log(f"[ORCA] Copernicus provider initialization failed: {e}")
        return None
```

### Secure Communication

**HTTPS Enforcement**:

```python
# All provider endpoints must use HTTPS
ALLOWED_SCHEMES = ["https"]

def validate_url(url: str) -> bool:
    """Ensure provider URLs use secure transport."""
    from urllib.parse import urlparse
    scheme = urlparse(url).scheme
    if scheme not in ALLOWED_SCHEMES:
        raise ValueError(f"Insecure URL scheme: {scheme}. Only HTTPS allowed.")
    return True
```

**Request Timeout Enforcement**:

```python
# Requirement 1.7: Maximum 30s timeout per provider
class TimeoutHTTPClient:
    """HTTP client with enforced timeouts."""
    
    def __init__(self, timeout: float = 30.0):
        self.client = httpx.Client(
            timeout=httpx.Timeout(timeout, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
        )
    
    def get(self, url: str, **kwargs) -> httpx.Response:
        """GET request with enforced timeout."""
        validate_url(url)
        return self.client.get(url, **kwargs)
```

### Input Validation

**Location Bounds Checking**:

```python
# Requirement 19.4-19.5: Validate coordinates
def validate_location(lat: float, lon: float) -> Tuple[bool, str]:
    """Validate latitude and longitude ranges."""
    if not (-90.0 <= lat <= 90.0):
        return False, f"Invalid latitude: {lat} (must be -90 to 90)"
    if not (-180.0 <= lon <= 180.0):
        return False, f"Invalid longitude: {lon} (must be -180 to 180)"
    return True, ""

# Usage in agents:
valid, error = validate_location(location.latitude, location.longitude)
if not valid:
    log(f"[ORCA][{agent}] {error}")
    return AgentResult(agent=agent, ok=False, error=error)
```

**Safety-Critical Value Validation**:

```python
# Requirement 19.1-19.3: Validate physical parameter ranges
VALID_RANGES = {
    "wave_height_m": (0.0, 20.0),
    "wind_speed_kmh": (0.0, 250.0),
    "current_speed_ms": (0.0, 5.0),
    "sst_c": (-2.0, 40.0),
    "chlorophyll_mg_m3": (0.0, 100.0),
    "rain_probability_pct": (0.0, 100.0),
}

def validate_value(param: str, value: float) -> bool:
    """Validate safety-critical parameter is in physical range.
    
    Requirement 19.6-19.7: Log validation failures.
    """
    if param not in VALID_RANGES:
        return True  # No validation for this param
    
    min_val, max_val = VALID_RANGES[param]
    if not (min_val <= value <= max_val):
        log(f"[ORCA][VALIDATION] {param}={value} outside valid range "
            f"[{min_val}, {max_val}]")
        return False
    return True
```

## API Changes

### Response Format Extensions

**Backward Compatible Changes**:

All existing fields preserved. New fields added for provenance tracking.

**Before** (current ChatResponse):
```json
{
  "session_id": "abc123",
  "language": "en",
  "answer": "...",
  "risk": {...},
  "pfz": [...],
  "mode": "DEMO",
  "disclaimer": "Demo data"
}
```

**After** (extended ChatResponse):
```json
{
  "session_id": "abc123",
  "language": "en",
  "answer": "...",
  "risk": {
    "score": 65,
    "category": "MODERATE",
    "sources": ["Open-Meteo", "Copernicus Marine Service", "IMD"],
    "mode": "LIVE"
  },
  "pfz": [
    {
      "latitude": 19.45,
      "longitude": 72.83,
      "source": "INCOIS (ORCA filtered)",
      "timestamp": "2024-01-15T06:00:00+05:30"
    }
  ],
  "mode": "PARTIAL",
  "data_mode": "PARTIAL",
  "sources": {
    "weather": "LIVE",
    "waves": "LIVE",
    "currents": "CACHE",
    "chlorophyll": "UNAVAILABLE",
    "pfz": "LIVE",
    "cyclone": "LIVE",
    "gis": "STATIC"
  },
  "disclaimer": "Currents from cached Copernicus data. Chlorophyll unavailable."
}
```

### Provenance in Evidence Objects

**Extended Evidence Schema**:

```python
class Evidence(BaseModel):
    """Evidence row with full provenance."""
    
    label: str  # e.g., "Wave height"
    value: str  # e.g., "2.3 m"
    source: str  # e.g., "Open-Meteo Marine"
    timestamp: str  # "2024-01-15T06:00:00+05:30"
    confidence: Optional[float] = None
    mode: DataMode = "DEMO"
    note: Optional[str] = None  # e.g., "NRT data - 3hr observation delay"
```

**Example Evidence List**:
```json
"evidence": [
  {
    "label": "Wave height",
    "value": "2.3 m",
    "source": "Open-Meteo Marine",
    "timestamp": "2024-01-15T06:00:00+05:30",
    "mode": "LIVE",
    "confidence": 0.88
  },
  {
    "label": "Current speed",
    "value": "0.85 m/s",
    "source": "Copernicus Marine Service",
    "timestamp": "2024-01-15T03:00:00+05:30",
    "mode": "CACHE",
    "note": "3-hour old NRT data"
  },
  {
    "label": "PFZ zones",
    "value": "3 zones identified",
    "source": "INCOIS (ORCA filtered)",
    "timestamp": "2024-01-15T00:00:00+05:30",
    "mode": "LIVE",
    "note": "Safety filters applied"
  }
]
```

## Observability

### Logging Format

**Structured Logging Pattern**:

```
[ORCA][{COMPONENT}][{DATA_TYPE}] {Provider} {STATUS}: {details}
```

**Examples**:
```
[ORCA][LIVE][MARINE] Open-Meteo OK at 2024-01-15T06:12:34+05:30
[ORCA][LIVE][CURRENT] Copernicus TIMEOUT after 30s at (19.12, 72.98)
[ORCA][LIVE][PFZ] INCOIS FAILED: HTTP 503
[ORCA][RISK] Safety floor applied: severe_cyclone override from 72 to 92
[ORCA][CACHE] Serving stale copernicus_current data (age: 2400s)
[ORCA] Mode switched from DEMO to LIVE, caches cleared
```

### Log Levels and Events

```python
# backend/app/services/logger.py

import logging
import sys

logger = logging.getLogger("orca")
logger.setLevel(logging.INFO)

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter(
    '[ORCA][%(name)s] %(message)s'
))
logger.addHandler(handler)

# Usage:
logger.info(f"[LIVE][MARINE] Open-Meteo OK at {timestamp}")
logger.warning(f"[LIVE][CURRENT] Copernicus TIMEOUT")
logger.error(f"[LIVE][PFZ] INCOIS FAILED: {error}")
```

### Monitoring Points

**Critical Events to Monitor**:

1. **Provider Health**:
   - Success rate per provider (last 100 requests)
   - Average latency per provider
   - Timeout frequency
   - Cache hit rate

2. **Mode Distribution**:
   - Percentage of requests in LIVE vs PARTIAL vs DEMO
   - Which providers fail most frequently

3. **Risk Overrides**:
   - Frequency of safety floor applications
   - Which warnings trigger overrides

4. **Cache Performance**:
   - Hit rate by provider
   - Eviction frequency
   - Average age of cached data served

**Metrics Collection**:

```python
class MetricsCollector:
    """Collect operational metrics for monitoring."""
    
    def __init__(self):
        self.provider_calls = Counter()  # provider -> count
        self.provider_failures = Counter()  # provider -> count
        self.provider_latencies = []  # (provider, latency_ms)
        self.cache_hits = Counter()  # provider -> hits
        self.cache_misses = Counter()  # provider -> misses
        self.mode_distribution = Counter()  # mode -> count
        self.safety_overrides = Counter()  # override_reason -> count
    
    def record_provider_call(self, provider: str, success: bool, latency_ms: int):
        self.provider_calls[provider] += 1
        if not success:
            self.provider_failures[provider] += 1
        self.provider_latencies.append((provider, latency_ms))
    
    def record_cache_hit(self, provider: str):
        self.cache_hits[provider] += 1
    
    def record_cache_miss(self, provider: str):
        self.cache_misses[provider] += 1
    
    def record_mode(self, mode: str):
        self.mode_distribution[mode] += 1
    
    def record_safety_override(self, reason: str):
        self.safety_overrides[reason] += 1
    
    def get_summary(self) -> Dict:
        """Get metrics summary for dashboard."""
        return {
            "provider_success_rates": {
                p: (self.provider_calls[p] - self.provider_failures[p]) / self.provider_calls[p]
                for p in self.provider_calls
            },
            "cache_hit_rates": {
                p: self.cache_hits[p] / (self.cache_hits[p] + self.cache_misses[p])
                for p in self.cache_hits
            },
            "mode_distribution": dict(self.mode_distribution),
            "safety_overrides": dict(self.safety_overrides)
        }
```

### Health Check Endpoint

**New API Endpoint**:

```python
@app.get("/api/health")
def health_check():
    """System health and provider status.
    
    Useful for:
    - Demo stage: "all providers are LIVE now"
    - Ops dashboard: monitor degradation
    - Integration tests: verify connections
    """
    provider_status = {}
    
    # Test each provider with a quick ping
    for provider_name, provider in [
        ("open_meteo", open_meteo_provider),
        ("copernicus", copernicus_provider),
        ("incois", incois_provider),
        ("imd", imd_provider)
    ]:
        try:
            # Quick test call (with short timeout)
            result = provider.health_check() if hasattr(provider, 'health_check') else None
            provider_status[provider_name] = {
                "status": "UP" if result else "DOWN",
                "latency_ms": result.get("latency_ms") if result else None
            }
        except Exception as e:
            provider_status[provider_name] = {
                "status": "DOWN",
                "error": str(e)
            }
    
    return {
        "status": "UP",
        "mode": get_data_mode(),
        "providers": provider_status,
        "cache_stats": cache.get_stats(),
        "metrics": metrics_collector.get_summary()
    }
```

## Testing Strategy

### Unit Tests

**Provider Unit Tests** (mock HTTP responses):

```python
# tests/test_providers/test_open_meteo.py

import pytest
from unittest.mock import Mock, patch
from app.data.providers.open_meteo import OpenMeteoProvider

@pytest.fixture
def mock_response():
    """Mock successful Open-Meteo response."""
    return {
        "hourly": {
            "time": ["2024-01-15T06:00", "2024-01-15T07:00"],
            "wave_height": [2.3, 2.1],
            "wave_period": [7.2, 7.4],
            "sea_surface_temperature": [28.5, 28.6]
        }
    }

def test_fetch_marine_success(mock_response):
    """Requirement 15.3: Verify wave_height_m and source."""
    provider = OpenMeteoProvider()
    
    with patch.object(provider._client, 'get') as mock_get:
        mock_get.return_value.json.return_value = mock_response
        mock_get.return_value.raise_for_status = Mock()
        
        result = provider.fetch_marine(19.12, 72.98, 
                                       datetime(2024, 1, 15, 6, 0))
        
        assert result is not None
        assert result["data"]["wave_height_m"] == 2.3
        assert result["metadata"]["source"] == "Open-Meteo Marine"
        assert result["metadata"]["mode"] == "LIVE"

def test_fetch_marine_timeout():
    """Requirement 15.8: Verify UNAVAILABLE status within 35s."""
    provider = OpenMeteoProvider()
    
    with patch.object(provider._client, 'get', 
                     side_effect=httpx.TimeoutException("Connection timeout")):
        
        start = time.time()
        result = provider.fetch_marine(19.12, 72.98,
                                       datetime(2024, 1, 15, 6, 0))
        elapsed = time.time() - start
        
        assert result is None
        assert elapsed < 35.0  # Must fail fast

def test_fetch_marine_invalid_data():
    """Requirement 15.9: Handle missing satellite pixels."""
    provider = OpenMeteoProvider()
    
    # Missing wave_height field
    invalid_response = {"hourly": {"time": ["2024-01-15T06:00"]}}
    
    with patch.object(provider._client, 'get') as mock_get:
        mock_get.return_value.json.return_value = invalid_response
        mock_get.return_value.raise_for_status = Mock()
        
        result = provider.fetch_marine(19.12, 72.98,
                                       datetime(2024, 1, 15, 6, 0))
        
        assert result is None
```

**Agent Integration Tests**:

```python
# tests/test_agents/test_ocean_agent.py

def test_ocean_agent_live_mode(mock_providers):
    """Test Ocean agent with live providers."""
    config.set_data_mode("LIVE")
    
    location = Location(name="Mumbai", latitude=19.07, longitude=72.88)
    when = datetime(2024, 1, 15, 6, 0, tzinfo=IST)
    
    result = ocean_agent.run(location, when)
    
    assert result.ok
    assert result.mode == "LIVE"
    assert "wave_height_m" in result.data
    assert result.source in ["Open-Meteo Marine", "Open-Meteo Marine, Copernicus Marine Service"]

def test_ocean_agent_partial_failure():
    """Test Ocean agent when Copernicus fails."""
    config.set_data_mode("LIVE")
    
    with patch('app.data.providers.copernicus.CopernicusProvider.fetch_current',
               return_value=None):
        
        location = Location(name="Mumbai", latitude=19.07, longitude=72.88)
        result = ocean_agent.run(location, datetime(2024, 1, 15, 6, 0, tzinfo=IST))
        
        assert result.ok  # Should still succeed with Open-Meteo data
        assert "Current data unavailable" in result.unavailable
        assert result.mode in ["LIVE", "PARTIAL"]
```

### Integration Tests

**End-to-End LIVE Mode Test**:

```python
# tests/integration/test_live_mode.py

@pytest.mark.integration
def test_live_mode_full_request():
    """Requirement 15.1-15.7: Full LIVE mode request flow."""
    config.set_data_mode("LIVE")
    
    request = ChatRequest(
        message="Is it safe to fish near Mumbai tomorrow morning?",
        latitude=19.07,
        longitude=72.88,
        language="en",
        session_id="test_session"
    )
    
    response = planner.handle(request)
    
    # Should succeed if providers are available
    assert response.intent.intent == "fishing_safety"
    assert response.mode in ["LIVE", "PARTIAL"]
    
    # Check provenance
    if response.mode == "LIVE":
        assert all(source in ["Open-Meteo", "Open-Meteo Marine", 
                             "Copernicus Marine Service", "IMD"]
                  for source in response.risk.sources)
    
    # Verify sources dict
    assert "weather" in response.sources
    assert "waves" in response.sources
    
    # Requirement 15.14: No DEMO data in LIVE mode
    for evidence in response.evidence:
        assert evidence.source != "DEMO"
        assert evidence.mode != "DEMO"
```

**Route Safety Test**:

```python
# tests/integration/test_route_safety.py

def test_route_excludes_restricted_zones():
    """Requirement 15.12: Routes avoid restricted areas."""
    location = Location(name="Mumbai", latitude=19.07, longitude=72.88)
    pfz_zones = pfz_agent.run(location, datetime.now(IST)).data["zones"]
    
    destination = pfz_zones[0]  # Top-ranked PFZ
    routes = route_agent.run(
        location, datetime.now(IST),
        destination=(destination["latitude"], destination["longitude"]),
        destination_name=f"PFZ #{destination['rank']}"
    )
    
    for route in routes.data.get("options", []):
        for leg in route["legs"]:
            # Check each waypoint is not in restricted zone
            for zone in RESTRICTED_ZONES:
                assert not point_in_polygon(
                    (leg["latitude"], leg["longitude"]),
                    zone["polygon"]
                )
```

### Property-Based Tests

**Risk Determinism**:

```python
# tests/property/test_risk_determinism.py

from hypothesis import given, strategies as st

@given(
    wave=st.floats(min_value=0.0, max_value=20.0),
    wind=st.floats(min_value=0.0, max_value=250.0),
    current=st.floats(min_value=0.0, max_value=5.0)
)
def test_risk_calculation_deterministic(wave, wind, current):
    """Requirement 10.2: Same inputs → same risk score."""
    
    result1 = risk_engine.assess(
        wave_height_m=wave,
        wind_speed_kmh=wind,
        current_speed_ms=current,
        rain_probability_pct=50.0,
        lightning=False,
        visibility_km=10.0,
        sea_state_label="moderate",
        alerts=[],
        distance_from_shore_km=25.0,
        nearest_zone_km=50.0,
        inside_zone=False,
        sources=["test"],
        mode="TEST"
    )
    
    result2 = risk_engine.assess(
        wave_height_m=wave,
        wind_speed_kmh=wind,
        current_speed_ms=current,
        rain_probability_pct=50.0,
        lightning=False,
        visibility_km=10.0,
        sea_state_label="moderate",
        alerts=[],
        distance_from_shore_km=25.0,
        nearest_zone_km=50.0,
        inside_zone=False,
        sources=["test"],
        mode="TEST"
    )
    
    assert result1.score == result2.score
    assert 0.0 <= result1.score <= 100.0
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

This section is intentionally deferred pending prework analysis of the acceptance criteria.

## Error Handling

### Comprehensive Error Scenarios

Already covered in detail in the "Error Handling" section above. Key scenarios:

1. Network timeouts → Return None, mark UNAVAILABLE
2. HTTP errors → Return None, log error
3. Invalid data → Return None, validation failed
4. Missing credentials → Provider disabled at startup
5. Cache exhaustion → LRU eviction
6. Total provider failure → HTTP 503

## Testing Strategy

### Test Coverage Requirements

1. **Unit Tests** (mock external dependencies):
   - Each provider: success, timeout, HTTP error, invalid data
   - Each agent: DEMO mode, LIVE mode, partial failure
   - Cache: TTL expiration, LRU eviction, spatial rounding
   - Risk engine: determinism, safety floors, validation

2. **Integration Tests** (hit real endpoints or staging):
   - Full request flow in LIVE mode
   - Mode calculation correctness
   - Provenance propagation
   - Route safety filters

3. **Property Tests** (hypothesis):
   - Risk score determinism
   - Cache key spatial equivalence
   - Safety override precedence

4. **Load Tests**:
   - Cache efficiency under concurrent requests
   - Provider timeout behavior
   - Thread safety of cache operations

### Test Data Strategy

**Mock Responses**:
- Save real API responses as JSON fixtures
- Use for unit test mocking
- Update when provider APIs change

**Staging Environment**:
- Separate Copernicus test account
- Rate-limited to avoid quota exhaustion
- Integration tests run nightly

**Demo Mode Tests**:
- All tests must pass in DEMO mode
- No external dependencies
- Reproducible scenarios

---

## Summary

This design provides a production-ready architecture for integrating live marine data providers into ORCA while maintaining strict provenance tracking, deterministic risk calculation, and safe failure modes. The modular provider architecture allows independent integration and testing of each data source, while the caching strategy ensures performance and resilience. The API remains backward compatible, with provenance metadata added as extensions that enable transparent data sourcing for users and operators.
