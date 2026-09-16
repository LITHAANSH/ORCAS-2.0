# Requirements Document

## Introduction

This requirements document specifies the conversion of ORCA from its current hybrid DEMO/LIVE implementation into a genuinely live-data-driven marine intelligence system with proper data provenance and safety guarantees. ORCA is a marine safety application for Indian fishers that must NEVER fabricate official warnings, PFZ advisories, or oceanographic data. The risk engine remains deterministic - LLMs cannot calculate physical risk.

## Glossary

- **ORCA**: Ocean Risk and Condition Advisor - the marine intelligence system
- **DEMO_Mode**: Operational mode serving cached, clearly-labeled scenario data for offline demonstrations
- **LIVE_Mode**: Operational mode calling real marine/weather APIs with proper provenance tracking
- **Provider**: A data source module that fetches specific types of marine/weather data
- **Open_Meteo**: Public keyless weather and marine forecast API (currently integrated)
- **Copernicus**: Copernicus Marine Service - European marine data service for ocean currents and chlorophyll
- **INCOIS**: Indian National Centre for Ocean Information Services - official PFZ advisory source
- **IMD**: India Meteorological Department - official cyclone warning source
- **PFZ**: Potential Fishing Zone - areas with likelihood of fish aggregation
- **Agent**: A specialist component that processes specific data types (weather, ocean, risk, etc.)
- **Risk_Engine**: Deterministic weighted-factor model that calculates marine safety risk scores
- **Planner**: Central orchestrator that manages agent execution and response assembly
- **Provenance**: Metadata tracking data source, validity time, and operational mode
- **SST**: Sea Surface Temperature
- **CAP**: Common Alerting Protocol - standard format for emergency alerts
- **GIS**: Geographic Information System - static boundary and geometry data
- **NRT**: Near Real Time - satellite data available within hours of observation
- **NaN**: Not a Number - missing or invalid data value

## Requirements

### Requirement 1: Provider Architecture

**User Story:** As a developer, I want a clean provider architecture, so that data sources can be integrated, tested, and maintained independently.

#### Acceptance Criteria

1. THE ORCA_System SHALL create a providers module directory at `backend/app/data/providers/` containing an `__init__.py` file
2. THE ORCA_System SHALL define a base provider interface specifying fetch methods that return data dictionaries with keys: data, metadata, and timestamp
3. THE ORCA_System SHALL implement `backend/app/data/providers/open_meteo.py` containing methods for weather forecast retrieval and marine forecast retrieval
4. THE ORCA_System SHALL implement `backend/app/data/providers/copernicus.py` containing methods for ocean current data retrieval and chlorophyll concentration retrieval
5. THE ORCA_System SHALL implement `backend/app/data/providers/incois.py` containing a method for official PFZ advisory retrieval
6. THE ORCA_System SHALL implement `backend/app/data/providers/imd.py` containing a method for official cyclone warning retrieval
7. IF a provider encounters a network timeout exceeding 30 seconds, THEN THE Provider SHALL return None
8. IF a provider receives an HTTP response with status code 400 or greater, THEN THE Provider SHALL return None
9. IF a provider receives a response that fails data validation, THEN THE Provider SHALL return None
10. WHEN a provider successfully retrieves data, THE Provider SHALL return a dictionary containing a metadata field with nested fields: source (string), valid_time (ISO 8601 timestamp), and mode (string)

### Requirement 2: Copernicus Marine Integration

**User Story:** As a fisher, I want accurate ocean current and chlorophyll data from satellite observations, so that I can make informed decisions about sea conditions and fishing grounds.

#### Acceptance Criteria

1. THE Copernicus_Provider SHALL fetch near-real-time ocean surface current data from Copernicus Marine Service where near-real-time means data available within 24 hours of observation
2. THE Copernicus_Provider SHALL fetch near-real-time chlorophyll-a concentration data from Copernicus Marine Service where near-real-time means data available within 24 hours of observation
3. WHEN Copernicus_Provider receives satellite pixels with missing data flags, THE Copernicus_Provider SHALL return None for current speed and direction
4. WHEN Copernicus_Provider receives land pixels, THE Copernicus_Provider SHALL return None for current speed and direction
5. WHEN Copernicus_Provider receives NaN values, THE Copernicus_Provider SHALL return None for current speed and direction
6. THE Copernicus_Provider SHALL convert U/V current components to speed in meters per second and direction in degrees clockwise from true north
7. THE Copernicus_Provider SHALL cache current data responses for 1800 seconds from the response timestamp
8. THE Copernicus_Provider SHALL cache chlorophyll data responses for 86400 seconds from the response timestamp
9. WHEN Copernicus_Provider successfully retrieves data, THE Copernicus_Provider SHALL return a dictionary containing source (string), valid_time (ISO 8601 timestamp), and mode set to LIVE
10. WHEN Copernicus_Provider connection times out after 30 seconds, THE Copernicus_Provider SHALL return None and set mode to UNAVAILABLE

### Requirement 3: INCOIS PFZ Integration

**User Story:** As a fisher, I want official INCOIS PFZ advisories, so that I receive government-verified fishing zone recommendations.

#### Acceptance Criteria

1. THE INCOIS_Provider SHALL fetch official INCOIS PFZ advisories from documented INCOIS endpoints with a connection timeout of 30 seconds
2. IF the INCOIS_Provider connection times out after 30 seconds, THEN THE INCOIS_Provider SHALL return None
3. IF the INCOIS_Provider receives a response that fails schema validation, THEN THE INCOIS_Provider SHALL return None
4. THE INCOIS_Provider SHALL transform INCOIS PFZ data to ORCA's PFZ schema containing latitude, longitude, sst_c, chlorophyll_mg_m3, and valid_from fields
5. THE PFZ_Agent SHALL apply ORCA's safety filtering to exclude zones where wave_height_m exceeds 3.0 or distance_km exceeds 150
6. WHEN displaying PFZ data, THE ORCA_System SHALL include a source field set to "INCOIS" for unfiltered zones and "INCOIS (ORCA filtered)" for zones that passed safety filters
7. THE INCOIS_Provider SHALL NOT compute PFZ zones from SST and chlorophyll data
8. WHEN INCOIS_Provider successfully retrieves data, THE INCOIS_Provider SHALL include provenance metadata with source set to "INCOIS", valid_time in ISO 8601 format, and mode set to LIVE

### Requirement 4: IMD Cyclone Warning Integration

**User Story:** As a fisher, I want official IMD cyclone warnings, so that I receive accurate severe weather alerts.

#### Acceptance Criteria

1. THE IMD_Provider SHALL fetch official cyclone and marine alert data from IMD CAP, bulletin, or track endpoints with a connection timeout of 10 seconds
2. IF the IMD_Provider connection times out after 10 seconds, THEN THE IMD_Provider SHALL return cached data if available or an empty alert list with mode set to UNAVAILABLE
3. IF the IMD_Provider receives invalid response data, THEN THE IMD_Provider SHALL return cached data if available or an empty alert list with mode set to UNAVAILABLE
4. THE IMD_Provider SHALL transform IMD data into ORCA's alert schema containing type, severity, latitude, longitude, wind_speed_kmh, pressure_hpa, issued_at, and geometry fields
5. WHEN IMD_Provider provides wind speed in knots, THE IMD_Provider SHALL convert to kilometers per hour by multiplying by 1.852
6. WHEN IMD_Provider provides pressure in millibars, THE IMD_Provider SHALL convert to hectopascals by direct numeric equivalence
7. WHEN IMD_Provider provides geometry data, THE IMD_Provider SHALL include that data in the geometry field without modification
8. WHEN IMD_Provider does not provide geometry data, THE IMD_Provider SHALL set geometry field to None
9. WHEN IMD_Provider detects a cyclone with maximum sustained wind speed exceeding 120 km/h and minimum central pressure below 990 hPa, THE IMD_Provider SHALL classify it as active
10. WHEN IMD_Provider detects no active cyclones, THE IMD_Provider SHALL return an empty alert list with mode set to LIVE
11. THE IMD_Provider SHALL poll IMD endpoints no more frequently than every 30 minutes

### Requirement 5: Mode Semantics and Provenance

**User Story:** As a system operator, I want clear provenance tracking, so that I know exactly which data sources are live and which are unavailable.

#### Acceptance Criteria

1. WHILE the ORCA_DATA_MODE environment variable equals DEMO, THE ORCA_System SHALL fetch all data from demo_store
2. WHILE the ORCA_DATA_MODE environment variable equals LIVE, THE ORCA_System SHALL attempt connections to external provider APIs with a 30-second timeout per provider
3. IF a provider connection times out after 30 seconds in LIVE mode, THEN THE ORCA_System SHALL set that provider's status to UNAVAILABLE
4. IF a provider returns an HTTP error code 400 or greater in LIVE mode, THEN THE ORCA_System SHALL set that provider's status to UNAVAILABLE
5. IF a provider returns invalid data in LIVE mode, THEN THE ORCA_System SHALL set that provider's status to UNAVAILABLE
6. THE ORCA_System SHALL NOT substitute demo_store values when a provider status is UNAVAILABLE and mode is LIVE
7. WHEN mode is LIVE and one or more providers have status UNAVAILABLE, THE ORCA_System SHALL set global mode to PARTIAL_LIVE
8. FOR ALL agent responses, THE ORCA_System SHALL include a provenance object containing source (string), valid_time (ISO 8601 timestamp), and status (LIVE, UNAVAILABLE, DEMO, or STATIC)
9. THE ORCA_System SHALL include a sources dictionary in the final response mapping weather, waves, currents, chlorophyll, pfz, cyclone, and gis to their respective statuses
10. THE ORCA_System SHALL set global mode to LIVE only when all required providers for the requested operation return status LIVE

### Requirement 6: Ocean Agent Updates

**User Story:** As a developer, I want the Ocean Agent to use live Copernicus data, so that ocean conditions reflect current satellite observations.

#### Acceptance Criteria

1. WHEN the data mode configuration equals LIVE, THE Ocean_Agent SHALL invoke Copernicus_Provider for ocean surface current data
2. WHEN the data mode configuration equals LIVE, THE Ocean_Agent SHALL invoke Copernicus_Provider for chlorophyll concentration data
3. WHEN the data mode configuration equals LIVE, THE Ocean_Agent SHALL invoke Open_Meteo_Provider for wave height, wave period, and SST data
4. IF Copernicus_Provider does not respond within 10 seconds, THEN THE Ocean_Agent SHALL mark currents as UNAVAILABLE
5. IF Copernicus_Provider returns None for currents, THEN THE Ocean_Agent SHALL include an error message "Copernicus surface current data unavailable" in the unavailable field
6. IF Copernicus_Provider returns None for chlorophyll, THEN THE Ocean_Agent SHALL include an error message "Copernicus chlorophyll data unavailable" in the unavailable field
7. IF both Copernicus_Provider and Open_Meteo_Provider return None, THEN THE Ocean_Agent SHALL return an error result with ok set to false
8. THE Ocean_Agent SHALL populate its result with a provenance object containing source, valid_time, and mode fields from each provider

### Requirement 7: PFZ Agent Updates

**User Story:** As a developer, I want the PFZ Agent to use official INCOIS data, so that fishing zone recommendations come from authoritative sources.

#### Acceptance Criteria

1. WHILE LIVE_Mode is active, WHEN the PFZ_Agent requests PFZ advisories, THE PFZ_Agent SHALL fetch data from INCOIS_Provider with a timeout of 30 seconds
2. WHEN INCOIS_Provider request exceeds 30 seconds, THE PFZ_Agent SHALL terminate the request and return an error message indicating INCOIS service timeout
3. THE PFZ_Agent SHALL apply safety filters to INCOIS PFZ zones by excluding zones where forecasted wave height exceeds 3 meters OR wind speed exceeds 25 knots OR visibility is below 1 nautical mile
4. THE PFZ_Agent SHALL rank filtered zones in ascending order by weighted score, where score equals (distance_km × 0.5) + (wave_height_m × 2.0) - (chlorophyll_mg_per_m3 × 0.1)
5. WHEN calculating distance for zone ranking, THE PFZ_Agent SHALL measure from the user's current location to the zone centroid using great-circle distance
6. WHEN INCOIS_Provider returns no zones, THE PFZ_Agent SHALL return an empty zone list with metadata indicating zero zones available
7. IF INCOIS_Provider returns an error OR fails to respond, THEN THE PFZ_Agent SHALL return an error message indicating INCOIS data unavailable
8. THE PFZ_Agent SHALL include a source attribute in each zone record with value "INCOIS" for original zones and "INCOIS_ORCA_Filtered" for zones that passed safety filters

### Requirement 8: Cyclone Agent Updates

**User Story:** As a developer, I want the Cyclone Agent to use official IMD data, so that severe weather alerts are authoritative and accurate.

#### Acceptance Criteria

1. WHEN the data mode configuration equals LIVE, THE Cyclone_Agent SHALL invoke IMD_Provider with a timeout of 10 seconds
2. WHEN IMD_Provider returns alert data, THE Cyclone_Agent SHALL sort alerts by severity in descending order where severe > high > moderate > low
3. WHEN IMD_Provider returns an empty alert list, THE Cyclone_Agent SHALL populate the data field with count=0 and official_warning_active=false
4. IF IMD_Provider times out or returns an error, THEN THE Cyclone_Agent SHALL return an AgentResult with ok=true, count=0, and mode=UNAVAILABLE
5. THE Cyclone_Agent SHALL preserve the official_warning field from IMD_Provider responses and include it in the AgentResult data
6. THE Cyclone_Agent SHALL populate the source field of each alert with "IMD"

### Requirement 9: Planner Mode Logic

**User Story:** As a system operator, I want accurate mode calculation, so that the system correctly reports when it is operating in live mode.

#### Acceptance Criteria

1. THE Planner SHALL extract the mode field from each AgentResult returned by weather, ocean, pfz, cyclone, and gis agents
2. IF the runtime data mode configuration equals "DEMO", THEN THE Planner SHALL set global mode to DEMO regardless of agent-returned modes
3. IF the runtime data mode configuration equals "LIVE" and all agents that returned ok=true have mode="LIVE", THEN THE Planner SHALL set global mode to LIVE
4. IF the runtime data mode configuration equals "LIVE" and one or more agents that returned ok=true have mode="DEMO" or mode="CACHE", THEN THE Planner SHALL set global mode to the most conservative mode present (DEMO takes precedence over CACHE, CACHE takes precedence over LIVE)
5. THE Planner SHALL include a sources list in the ChatResponse containing the source field from all agents where ok=true
6. THE Planner SHALL include a mode field in the ChatResponse containing one of the values "LIVE", "DEMO", or "CACHE"
7. IF any agent returns ok=false, THEN THE Planner SHALL exclude that agent's mode from global mode calculation

### Requirement 10: Risk Engine Integration

**User Story:** As a fisher, I want deterministic risk calculations, so that my safety assessment is reproducible and not subject to AI variability.

#### Acceptance Criteria

1. WHEN the Risk_Engine receives provider data, THE Risk_Engine SHALL validate that the data includes wave_height_m, wind_speed_kmh, and alert_severity fields
2. WHEN the Risk_Engine receives identical input values for wave_height_m, wind_speed_kmh, rain_probability_pct, visibility_km, current_speed_ms, and alert_severity, THE Risk_Engine SHALL return the same risk score to one decimal place
3. THE Risk_Engine SHALL output risk scores in the range 0.0 to 100.0 with precision to one decimal place
4. IF provider data is missing required fields, THEN THE Risk_Engine SHALL return an error response indicating which fields are missing
5. THE Risk_Engine SHALL log each risk calculation with inputs including wave_height_m, wind_speed_kmh, rain_probability_pct, current_speed_ms, and calculated score
6. THE Risk_Engine SHALL NOT accept LLM outputs as inputs to the weighted-factor model

### Requirement 11: Route Optimization

**User Story:** As a fisher, I want safe routes to fishing zones, so that I can reach productive areas while avoiding hazards.

#### Acceptance Criteria

1. WHEN the Route_Optimizer receives identical start position, destination position, and weather conditions, THE Route_Optimizer SHALL return the same route coordinates and estimated time within 5 seconds
2. WHEN calculating routes, THE Route_Optimizer SHALL use the PFZ zones returned by INCOIS_Provider as destination candidates
3. THE Route_Optimizer SHALL exclude route segments that pass within 2 kilometers of restricted maritime area boundaries
4. THE Route_Optimizer SHALL exclude routes that pass through zones where wave_height_m exceeds 3.0 or wind_speed_kmh exceeds 45
5. WHEN IMD_Provider returns active cyclone warnings with geometry data, THE Route_Optimizer SHALL exclude routes that intersect cyclone warning polygons
6. THE Route_Optimizer SHALL NOT invoke LLM APIs or use LLM outputs to select waypoints or compute routes
7. IF the start position is on land OR the destination position is on land, THEN THE Route_Optimizer SHALL return an error message "Invalid route: location on land"
8. THE Route_Optimizer SHALL return routes containing distance_km and estimated_time_hours fields

### Requirement 12: Configuration Management

**User Story:** As a system operator, I want environment-based configuration, so that I can control operational mode and provider credentials.

#### Acceptance Criteria

1. WHEN the ORCA backend starts, THE ORCA_System SHALL read the ORCA_DATA_MODE environment variable before initializing agents
2. THE ORCA_System SHALL accept ORCA_DATA_MODE values of "LIVE" or "DEMO" regardless of case
3. IF ORCA_DATA_MODE contains a value other than LIVE or DEMO, THEN THE ORCA_System SHALL log a warning and default to DEMO
4. THE ORCA_System SHALL read COPERNICUS_USERNAME and COPERNICUS_PASSWORD environment variables for Copernicus Marine Service authentication
5. IF Copernicus credentials are missing when mode is LIVE, THEN THE Copernicus_Provider SHALL return UNAVAILABLE status with an error message indicating missing credentials
6. IF Copernicus authentication fails with valid credentials, THEN THE Copernicus_Provider SHALL return UNAVAILABLE status with an error message indicating authentication failure
7. WHEN data mode is DEMO, THE ORCA_System SHALL serve all data from demo_store without attempting external provider connections
8. THE ORCA_System SHALL NOT include COPERNICUS_USERNAME or COPERNICUS_PASSWORD in any committed configuration file, log file, or error message
9. WHEN ORCA_DATA_MODE is not set, THE ORCA_System SHALL default to DEMO mode

### Requirement 13: API Response Format

**User Story:** As a frontend developer, I want consistent API responses, so that the UI continues to function without major changes.

#### Acceptance Criteria

1. THE ORCA_System SHALL preserve the following API endpoint paths: /api/chat, /api/fishing, /api/forecast, /api/routes, /api/map, /api/emergency_route, /api/sos, /api/alerts
2. THE ORCA_System SHALL preserve the existing request parameter names and types for all endpoints
3. THE ORCA_System SHALL add a sources field to all API responses containing a dictionary mapping data type strings to status strings
4. THE ORCA_System SHALL set sources dictionary keys to: weather, waves, currents, chlorophyll, pfz, cyclone, gis
5. THE ORCA_System SHALL set sources dictionary values to one of: LIVE, UNAVAILABLE, DEMO, STATIC
6. THE ORCA_System SHALL add a data_mode field to all API responses with value LIVE, DEMO, or PARTIAL
7. WHEN all required providers return LIVE status, THE ORCA_System SHALL set data_mode to LIVE
8. WHEN any required provider returns UNAVAILABLE status, THE ORCA_System SHALL set data_mode to PARTIAL
9. WHEN ORCA_DATA_MODE equals DEMO, THE ORCA_System SHALL set data_mode to DEMO
10. THE ORCA_System SHALL include provenance metadata (source, valid_time, mode) in existing agent result objects
11. THE ORCA_System SHALL NOT remove or rename existing API response fields

### Requirement 14: Logging and Observability

**User Story:** As a system operator, I want clear provider status logging, so that I can diagnose data source issues quickly.

#### Acceptance Criteria

1. WHEN a provider successfully returns data, THE ORCA_System SHALL write to stdout a log message with format: [ORCA][LIVE][{DATA_TYPE}] {Provider} OK at {timestamp}
2. WHEN a provider fails to return data, THE ORCA_System SHALL write to stdout a log message with format: [ORCA][LIVE][{DATA_TYPE}] {Provider} FAILED at {timestamp}: {error_reason}
3. WHEN a provider returns UNAVAILABLE status, THE ORCA_System SHALL include that status in the response metadata field
4. WHEN the ORCA backend starts in LIVE mode, THE ORCA_System SHALL write to stdout a log message: [ORCA] Starting in LIVE mode
5. FOR ALL incoming requests, THE ORCA_System SHALL log which providers returned LIVE, UNAVAILABLE, DEMO, or STATIC status

### Requirement 15: Testing Strategy

**User Story:** As a developer, I want comprehensive tests, so that I can verify live data integration works correctly.

#### Acceptance Criteria

1. WHEN running tests in DEMO mode, THE Test SHALL verify all agents return ok=true and mode=DEMO
2. WHEN running tests with Open_Meteo weather provider, THE Test SHALL verify returned data includes wind_speed_kmh and data_mode equals LIVE
3. WHEN running tests with Open_Meteo marine provider, THE Test SHALL verify returned data includes wave_height_m and source field equals "Open-Meteo Marine"
4. WHEN running tests with Copernicus current provider, THE Test SHALL verify returned data includes current_speed_ms or status equals UNAVAILABLE
5. WHEN running tests with Copernicus chlorophyll provider, THE Test SHALL verify returned data includes chlorophyll_mg_m3 or status equals UNAVAILABLE
6. WHEN running tests with INCOIS PFZ provider, THE Test SHALL verify returned zones include latitude and longitude or status equals UNAVAILABLE
7. WHEN running tests with IMD alert provider, THE Test SHALL verify returned alerts include severity or count equals 0
8. WHEN simulating provider timeout, THE Test SHALL verify the agent returns UNAVAILABLE status within 35 seconds
9. WHEN simulating missing satellite pixels, THE Test SHALL verify Copernicus_Provider returns None for affected parameters
10. WHEN simulating no active cyclone, THE Test SHALL verify IMD_Provider returns an empty alert list with mode=LIVE
11. WHEN testing route calculation, THE Test SHALL verify output routes have destination coordinates matching INCOIS PFZ zone coordinates
12. WHEN testing route calculation with restricted zones, THE Test SHALL verify no route segment passes within 2 km of restricted boundaries
13. WHEN testing risk calculation with live inputs, THE Test SHALL verify the output score is between 0.0 and 100.0
14. WHEN data_mode equals LIVE, THE Test SHALL fail if any returned value has source field equal to "DEMO" or "demo_store"

### Requirement 16: Parser and Data Format Handling

**User Story:** As a developer, I want robust parsing of provider data formats, so that ORCA can reliably consume external APIs.

#### Acceptance Criteria

1. WHEN Copernicus_Parser receives a netCDF or JSON response containing required fields, THE Copernicus_Parser SHALL extract current_speed_ms, current_direction_deg, and chlorophyll_mg_m3 values
2. WHEN INCOIS_Parser receives a response containing required PFZ fields, THE INCOIS_Parser SHALL extract latitude, longitude, sst_c, and chlorophyll_mg_m3 values
3. WHEN IMD_Parser receives a CAP or bulletin response containing required alert fields, THE IMD_Parser SHALL extract type, severity, latitude, longitude, and wind_speed_kmh values
4. WHEN Pretty_Printer receives a valid provider response, THE Pretty_Printer SHALL format it as JSON with 2-space indentation
5. WHEN a parser successfully parses data, formats it with Pretty_Printer, and parses the formatted output again, THE second parse result SHALL contain the same data values as the first parse result
6. IF a parser receives input exceeding 10 MB, THEN THE Parser SHALL return None and log a size limit error
7. IF a parser does not complete within 5 seconds, THEN THE Parser SHALL terminate and return None
8. WHEN provider data is missing required fields, THE Parser SHALL return None
9. WHEN provider data contains fields with incorrect types, THE Parser SHALL return None
10. WHEN parser returns None, THE Parser SHALL log the parsing failure with provider name and error reason
11. WHEN provider data format changes and causes parsing to fail, THE Parser SHALL return None and log the format change detection

### Requirement 17: Cache Management

**User Story:** As a system operator, I want intelligent caching, so that ORCA minimizes API calls while maintaining data freshness.

#### Acceptance Criteria

1. WHEN Open_Meteo_Provider receives a successful response, THE ORCA_System SHALL store that response in cache with a TTL of 600 seconds
2. WHEN Copernicus_Provider receives a successful current data response, THE ORCA_System SHALL store that response in cache with a TTL of 1800 seconds
3. WHEN Copernicus_Provider receives a successful chlorophyll data response, THE ORCA_System SHALL store that response in cache with a TTL of 86400 seconds
4. WHEN INCOIS_Provider receives a successful PFZ advisory response, THE ORCA_System SHALL store that response in cache with a TTL of 21600 seconds
5. WHEN IMD_Provider receives a successful alert response, THE ORCA_System SHALL store that response in cache with a TTL of 1800 seconds
6. WHEN data mode switches from LIVE to DEMO, THE ORCA_System SHALL immediately delete all cached provider responses
7. WHEN data mode switches from DEMO to LIVE, THE ORCA_System SHALL immediately delete all cached provider responses
8. THE ORCA_System SHALL limit total cache size to 256 MB by evicting least-recently-used entries when the size limit is reached
9. THE ORCA_System SHALL use cache keys composed of provider name, latitude rounded to 2 decimal places, and longitude rounded to 2 decimal places
10. IF a provider fails, THEN THE ORCA_System SHALL return cached data if available and cache age is less than TTL plus 300 seconds

### Requirement 18: Error Handling and Graceful Degradation

**User Story:** As a fisher, I want the system to continue operating when some data sources fail, so that I still receive useful information.

#### Acceptance Criteria

1. WHEN a provider that is classified as non-critical fails with a timeout or network error, THE ORCA_System SHALL continue request processing with available data from other providers
2. THE ORCA_System SHALL classify Copernicus_Provider and INCOIS_Provider as non-critical
3. THE ORCA_System SHALL classify Open_Meteo_Provider and IMD_Provider as critical
4. WHEN Copernicus_Provider fails after 30 seconds, THE Ocean_Agent SHALL set currents and chlorophyll fields to None and include status=UNAVAILABLE in provenance
5. WHEN INCOIS_Provider fails after 30 seconds, THE PFZ_Agent SHALL return an empty zones list and include an error message "INCOIS PFZ data unavailable"
6. WHEN IMD_Provider fails after 10 seconds, THE Cyclone_Agent SHALL return count=0 and include a warning message "IMD alert service unavailable"
7. WHEN all critical providers fail, THE ORCA_System SHALL return an HTTP 503 response with message "Marine data services unavailable"
8. THE ORCA_System SHALL include a provenance object in responses listing each data type with its status: LIVE, UNAVAILABLE, DEMO, or STATIC

### Requirement 19: Safety Data Validation

**User Story:** As a fisher, I want validated safety-critical data, so that I can trust risk assessments for my safety decisions.

#### Acceptance Criteria

1. WHEN wave_height_m is outside the range 0.0 to 20.0, THE ORCA_System SHALL exclude wave height from risk score calculation
2. WHEN wind_speed_kmh is outside the range 0.0 to 250.0, THE ORCA_System SHALL exclude wind speed from risk score calculation
3. WHEN current_speed_ms is outside the range 0.0 to 5.0, THE ORCA_System SHALL exclude current speed from risk score calculation
4. WHEN latitude is outside the range -90.0 to 90.0, THE ORCA_System SHALL exclude that location from route calculations
5. WHEN longitude is outside the range -180.0 to 180.0, THE ORCA_System SHALL exclude that location from route calculations
6. WHEN a safety-critical value fails validation, THE ORCA_System SHALL include an unavailability indicator for that parameter in the response
7. WHEN a safety-critical value fails validation, THE ORCA_System SHALL log a validation failure message to stdout containing parameter name, received value, and valid range
8. IF all safety-critical parameters fail validation, THEN THE Risk_Engine SHALL return an error response "Insufficient valid data for risk assessment"

### Requirement 20: Official Warning Priority

**User Story:** As a fisher, I want official warnings to override model calculations, so that government safety advisories always take precedence.

#### Acceptance Criteria

1. WHEN IMD_Provider returns an alert with warning_type field equal to "severe_cyclone", THE Risk_Engine SHALL set risk score to at least 90 regardless of weighted model output
2. WHEN IMD_Provider returns an alert with warning_type field equal to "fishermen_warning", THE Risk_Engine SHALL set risk score to at least 75 regardless of weighted model output
3. WHEN multiple warnings are active, THE Risk_Engine SHALL apply the floor value corresponding to the highest-severity warning present
4. WHEN a safety floor overrides the weighted model score, THE Risk_Engine SHALL write to stdout a log message: [ORCA][RISK] Safety floor applied: {warning_type} override from {model_score} to {final_score}
5. WHEN a safety floor overrides the weighted model score, THE Risk_Engine SHALL include a field override_reason in the response containing the warning_type that triggered the override
6. IF the Risk_Engine receives an LLM-generated risk value, THEN THE Risk_Engine SHALL ignore that value and use only the weighted model output and safety floors
7. THE Risk_Engine SHALL document in code comments that safety floor values (90 for severe_cyclone, 75 for fishermen_warning) are based on IMD warning severity definitions
