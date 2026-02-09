-- Rollback Migration - Remove all schema changes
-- This migration removes all tables, functions, triggers, and indexes created in up.sql
-- Note: PostGIS extension is NOT dropped as it may be used by other parts of the system

-- ============================================================================
-- PART 1: Drop functions
-- ============================================================================

DROP FUNCTION IF EXISTS nearby_facility_stats(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);
DROP FUNCTION IF EXISTS nearest_places_by_types(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER[], INTEGER, INTEGER);
DROP FUNCTION IF EXISTS places_in_bounds(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);
DROP FUNCTION IF EXISTS nearest_places(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS add_location(VARCHAR, DECIMAL, DECIMAL, TEXT, INTEGER, INTEGER, VARCHAR, TEXT, BOOLEAN, TEXT, JSONB, JSONB);
DROP FUNCTION IF EXISTS update_location_geom();

-- ============================================================================
-- PART 2: Drop triggers
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_location_geom ON locations;

-- ============================================================================
-- PART 3: Drop indexes
-- ============================================================================

DROP INDEX IF EXISTS location_images_location_idx;
DROP INDEX IF EXISTS facilities_location_idx;
DROP INDEX IF EXISTS districts_city_idx;
DROP INDEX IF EXISTS locations_lat_lng_idx;
DROP INDEX IF EXISTS locations_district_idx;
DROP INDEX IF EXISTS locations_type_idx;
DROP INDEX IF EXISTS locations_geom_idx;

-- ============================================================================
-- PART 4: Drop tables (in reverse dependency order)
-- ============================================================================

DROP TABLE IF EXISTS location_images CASCADE;
DROP TABLE IF EXISTS facilities CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS location_types CASCADE;
DROP TABLE IF EXISTS districts CASCADE;
DROP TABLE IF EXISTS cities CASCADE;

-- Note: PostGIS extension is intentionally NOT dropped
-- DROP EXTENSION IF EXISTS postgis;
