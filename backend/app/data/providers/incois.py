import math
import threading
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import httpx
from shapely.geometry import shape, Point
from shapely.ops import nearest_points

from ...schemas import ProviderMetadata, ProviderResponse, PFZZone
from . import BaseProvider

class INCOISProvider(BaseProvider):
    """Official PFZ advisories from INCOIS via WFS."""

    # We must use www.incois.gov.in as incois.gov.in without www returns 403
    WFS_URL = "https://www.incois.gov.in/geoserver/PFZ_Automation/ows"
    TIMEOUT = 30.0
    CACHE_TTL = 21600.0  # 6 hours

    def __init__(self):
        self._cache = {}
        self._lock = threading.Lock()
        self._client = httpx.Client(timeout=self.TIMEOUT)

    def _calculate_bearing(self, p1: Point, p2: Point) -> str:
        """Calculate compass bearing from p1 to p2."""
        lat1, lon1 = math.radians(p1.y), math.radians(p1.x)
        lat2, lon2 = math.radians(p2.y), math.radians(p2.x)
        
        dlon = lon2 - lon1
        y = math.sin(dlon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        
        brng = math.degrees(math.atan2(y, x))
        brng = (brng + 360) % 360
        
        dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        ix = int((brng + 22.5) / 45.0) % 8
        return dirs[ix]

    def _calculate_distance_km(self, p1: Point, p2: Point) -> float:
        """Calculate haversine distance in km between two points."""
        R = 6371.0 # Earth radius in km
        lat1, lon1 = math.radians(p1.y), math.radians(p1.x)
        lat2, lon2 = math.radians(p2.y), math.radians(p2.x)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def fetch_pfz_zones(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        """Fetch official PFZ zones from INCOIS WFS and compute spatial relations."""
        params = {
            "service": "WFS",
            "version": "1.1.0",
            "request": "GetFeature",
            "typeName": "PFZ_Automation:pfzlines",
            "outputFormat": "application/json"
        }
        
        # Check cache
        cache_key = "pfz_wfs"
        now = time.time()
        
        with self._lock:
            if cache_key in self._cache:
                data, ts = self._cache[cache_key]
                if now - ts < self.CACHE_TTL:
                    return self._process_geojson(data, lat, lon)

        try:
            resp = self._client.get(self.WFS_URL, params=params)
            resp.raise_for_status()
            geojson = resp.json()
            
            with self._lock:
                self._cache[cache_key] = (geojson, now)
                
            return self._process_geojson(geojson, lat, lon)
        except Exception as e:
            print(f"[ORCA][LIVE][PFZ] Failed to fetch INCOIS WFS: {e}")
            return None

    def _process_geojson(self, geojson: Dict, lat: float, lon: float) -> ProviderResponse:
        boat_pt = Point(lon, lat)
        zones = []
        
        for idx, feature in enumerate(geojson.get("features", [])):
            geom = feature.get("geometry")
            props = feature.get("properties", {})
            if not geom or geom["type"] != "MultiLineString":
                continue
                
            try:
                s_geom = shape(geom)
                # Find nearest point on the PFZ MultiLineString to the boat
                p_boat, p_nearest = nearest_points(boat_pt, s_geom)
                
                dist_km = self._calculate_distance_km(boat_pt, p_nearest)
                bearing = self._calculate_bearing(boat_pt, p_nearest)
                
                state = props.get("State_Name", "Unknown")
                uid = props.get("UID", f"PFZ_{idx}")
                
                # We map the closest point on the line as the target lat/lon
                zones.append({
                    "rank": idx + 1,
                    "latitude": p_nearest.y,
                    "longitude": p_nearest.x,
                    "distance_km": round(dist_km, 2),
                    "bearing": bearing,
                    "confidence": 1.0,
                    "rationale": f"{state} (UID: {uid})",
                    "source": "INCOIS_WFS",
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                })
            except Exception as e:
                print(f"[ORCA][PFZ] Error processing geometry: {e}")
                continue
                
        # Sort by distance
        zones.sort(key=lambda x: x["distance_km"])
        # Update rank after sorting
        for i, z in enumerate(zones):
            z["rank"] = i + 1
            
        return ProviderResponse(
            data={"zones": zones},
            metadata=ProviderMetadata(
                source="INCOIS_WFS",
                valid_time=datetime.utcnow().isoformat(),
                mode="LIVE",
                confidence=1.0,
                note="PFZ geometries are official. Distance/bearing are ORCA-derived safety filters."
            ),
            timestamp=datetime.utcnow().isoformat()
        )

    def fetch(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        return self.fetch_pfz_zones(lat, lon, when)

incois_provider = INCOISProvider()
