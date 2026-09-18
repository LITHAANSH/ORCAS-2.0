export type Language = "en" | "hi" | "kn";
export type IntentMode = "OFFLINE" | "AI";
export type DataMode = "LIVE" | "DEMO" | "CACHE";
export type RiskCategory = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

export interface Location {
  name: string;
  latitude: number;
  longitude: number;
  state?: string | null;
}

export interface Intent {
  intent: string;
  activity: string;
  location: Location | null;
  location_text: string;
  date: string | null;
  time: string | null;
  language: Language;
  raw_query: string;
  needs: string[];
  missing: string[];
  intent_source: "KEYWORD_OFFLINE" | "GROQ_LLM";
}

export interface RiskFactor {
  key: string;
  label: string;
  factor: number;
  weight: number;
  contribution: number;
  detail: string;
}

export interface RiskAssessment {
  score: number;
  category: RiskCategory;
  factors: RiskFactor[];
  overrides: string[];
  official_warning: boolean;
  go: boolean;
  window?: string | null;
  sources: string[];
  generated_at: string;
  mode: DataMode;
}

export interface PFZZone {
  rank: number;
  latitude: number;
  longitude: number;
  distance_km: number;
  bearing: string;
  sst_c: number | null;
  chlorophyll_mg_m3: number | null;
  wave_height_m: number | null;
  confidence: number;
  rationale: string;
  source: string;
  timestamp: string;
}

export interface RouteLeg {
  latitude: number;
  longitude: number;
}

export interface RouteOption {
  name: string;
  kind: "safest" | "shortest" | "alternate";
  legs: RouteLeg[];
  distance_km: number;
  eta_minutes: number;
  risk_score: number;
  risk_category: RiskCategory;
  penalties: Record<string, number>;
  recommended: boolean;
  notes: string;
}

export interface GeofenceAlert {
  zone_name: string;
  zone_type: string;
  distance_km: number;
  inside: boolean;
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface Evidence {
  label: string;
  value: string;
  source: string;
  timestamp: string;
  confidence: number | null;
  mode: DataMode;
}

export interface AgentTrace {
  agent: string;
  status: "ok" | "skipped" | "failed" | "degraded";
  latency_ms: number;
  summary: string;
  source: string;
  mode: DataMode;
}

export interface MarineAlert {
  type: string;
  severity: string;
  official: boolean;
  headline: string;
  detail: string;
  source: string;
  valid_till?: string;
  location?: string;
  /** Illustrative warning geometry so the chart can draw the alert. */
  storm?: {
    latitude: number;
    longitude: number;
    radius_km: number;
    track?: { latitude: number; longitude: number; label: string }[];
  };
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  value: any;
  expected: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface DataValidationReport {
  score: number;
  max_score: number;
  rating: "Exceptional" | "High" | "Moderate" | "Degraded" | string;
  is_valid: boolean;
  checks_passed: number;
  checks_total: number;
  checks: ValidationCheck[];
  warnings: string[];
  provenance_summary: string;
}

export interface ChatResponse {
  session_id: string;
  language: Language;
  answer: string;
  intent: Intent;
  risk: RiskAssessment | null;
  pfz: PFZZone[];
  routes: RouteOption[];
  geofence: GeofenceAlert[];
  alerts: MarineAlert[];
  evidence: Evidence[];
  trace: AgentTrace[];
  suggestions: string[];
  mode: DataMode;
  disclaimer: string;
  elapsed_ms: number;
  sources: Record<string, string>;
  reliability_score?: number;
  validation?: DataValidationReport;
}

export interface AuthorityRow {
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  risk_score: number;
  risk_category: RiskCategory;
  official_warning: boolean;
  wave_height_m: number | null;
  wind_speed_kmh: number | null;
  headline: string | null;
}

export interface AuthorityDashboard {
  generated_at: string;
  summary: Record<string, number>;
  locations: AuthorityRow[];
}

export interface ZoneFeature {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    zone_type: string;
    severity: string;
    note: string;
  };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface PositionCheck {
  latitude: number;
  longitude: number;
  status: "clear" | "warning" | "critical";
  headline: string;
  distance_from_shore_km: number | null;
  nearest_landing_centre: string | null;
  nearest_zone_km: number | null;
  nearest_zone_name: string | null;
  inside_restricted_zone: boolean;
  geofence_alerts: GeofenceAlert[];
  official_warning_active: boolean;
  checked_at: string;
}

export interface TimelinePoint {
  hour: number;
  time: string;
  score: number;
  category: RiskCategory;
  wave_height_m: number | null;
  wind_speed_kmh: number | null;
  warning: boolean;
}

export type CatchRating = "very_good" | "good" | "fair" | "poor";

export interface FishingArea {
  id: string;
  rank: number;
  latitude: number;
  longitude: number;
  distance_km: number;
  bearing: string;
  sst_c: number | null;
  chlorophyll_mg_m3: number | null;
  wave_height_m: number | null;
  probability: number;
  value_score: number;
  rating: CatchRating;
  confidence: number;
  rationale: string;
  factors: Record<string, number>;
  /** Indicative species mix from SST/chlorophyll bands — never a promise. */
  likely_species?: string[];
  /** Best balance of odds against the run out — the one we route to. */
  recommended?: boolean;
  species_suitability?: SpeciesSuitability | null;
}

export interface SpeciesMeta {
  id: string;
  name: string;
  scientific_name: string;
  vernacular: Record<string, string>;
  optimal_sst: [number, number];
  optimal_chl: [number, number];
  typical_depth_m: [number, number];
  market_price_inr_per_kg: number;
  catch_rate_kg_hr: number;
  schooling_type: string;
  description: string;
}

export interface SpeciesSuitability {
  species_id: string;
  species_name: string;
  scientific_name: string;
  suitability: number;
  sst_score: number;
  chl_score: number;
  status: string;
  market_price: number;
}

export interface LunarInfo {
  phase_name: string;
  phase_icon: string;
  moon_age_days: number;
  illumination_pct: number;
  is_spring_tide: boolean;
  tide_cycle: string;
  solunar_rating: string;
  solunar_score: number;
}

export interface TidePoint {
  hour_offset: number;
  time: string;
  height_m: number;
}

export interface TideInfo {
  current_state: string;
  current_height_m: number;
  tidal_range_m: number;
  next_high_tide: { time: string; height_m: number };
  next_low_tide: { time: string; height_m: number };
  hourly_curve: TidePoint[];
  lunar: LunarInfo;
}

export interface MlRiskComparison {
  rule_engine: { score: number; philosophy: string };
  ml_model: {
    score: number;
    category: string;
    probability: number;
    drivers: { factor: string; value: string; impact: string }[];
    model: string;
  };
  ensemble_agreement: string;
  variance: number;
}

export interface ForecastDay {
  day_offset: number;
  date: string;
  label: string;
  best_hour: number;
  probability: number;
  rating: CatchRating;
  wave_height_m: number;
  wind_speed_kmh: number;
  sea_state: string;
  calmer: boolean;
  official_warning: boolean;
  best_area_rank: number | null;
  best_area_distance_km: number | null;
}

export interface AvoidZone {
  name: string;
  zone_type: string;
  distance_km: number;
  window: string | null;
  active_now: boolean;
  severity: string;
}

export interface TripDuration {
  recommended_hours: number;
  travel_each_way_minutes: number;
  round_trip_hours: number;
  total_trip_hours: number;
  safe_window_hours: number;
  limited_by_weather: boolean;
  feasible: boolean;
  /** "Return before HH:MM" — the end of the safe-weather window. */
  return_by?: string;
  return_reason_wave_m?: number | null;
}

/** Planning estimates for the recommended trip — assumptions ride along. */
export interface TripEconomics {
  fuel_litres: number;
  fuel_cost_inr: number;
  catch_kg_low: number;
  catch_kg_high: number;
  revenue_inr: number;
  profit_inr: number;
  assumptions: string;
}

export interface FishingOutlook {
  location: {
    latitude: number;
    longitude: number;
    name: string;
    state: string | null;
    nearest_landing_centre: string;
    distance_from_shore_km: number;
  };
  generated_at: string;
  radius_km: number;
  safety: {
    score: number;
    category: RiskCategory;
    official_warning: boolean;
    improves_after: string | null;
    wave_height_m: number | null;
    wind_speed_kmh: number | null;
    sea_state: string | null;
  };
  areas: FishingArea[];
  target_species?: SpeciesMeta | null;
  species_catalog?: SpeciesMeta[];
  tide?: TideInfo;
  lunar?: LunarInfo;
  best_window: { from_hour: number; to_hour: number } | null;
  hourly_ranking: { hour: number; probability: number }[];
  duration: TripDuration | null;
  economics: TripEconomics | null;
  routes: RouteOption[];
  avoid: AvoidZone[];
  forecast: ForecastDay[];
  advice: string[];
  mode: DataMode;
  method: string;
  reliability_score?: number;
  validation?: DataValidationReport;
}

export interface CoastGuardStation {
  code: string;
  name: string;
  region: string;
  state: string;
  distance_km?: number;
  phone: string;
  station_lat?: number;
  station_lon?: number;
}

export interface SosGatewayStatus {
  active_provider: string;
  is_live: boolean;
  textbee_configured: boolean;
  textbee_masked_key: string;
  textbee_device_id: string;
  admin_recipients: string[];
  default_coast_guard_phone: string;
}

export interface SosResponse {
  ok: boolean;
  message: string;
  recipient?: string;
  delivered: boolean;
  provider?: string;
  provider_id?: string | null;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  nearest_coast_guard?: CoastGuardStation;
  recipients?: {
    admins: string[];
    nearest_coast_guard: CoastGuardStation;
    custom?: string | null;
    all_dispatched: string[];
  };
  sms: string;
}

export interface EmergencyRoute {
  available: boolean;
  destination: { latitude: number; longitude: number; name: string } | null;
  distance_km: number | null;
  eta_minutes: number | null;
  risk_score: number | null;
  risk_category: RiskCategory | null;
  waypoints: RouteLeg[];
  notes: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "orca";
  text: string;
  response?: ChatResponse;
}
