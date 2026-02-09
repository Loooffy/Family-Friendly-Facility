-- Expose PostgreSQL Functions as Hasura Custom Functions
-- These functions can be queried directly through Hasura GraphQL API

-- Note: After running this migration, you need to track these functions in Hasura Console:
-- 1. Go to Data -> Functions
-- 2. Track each function
-- 3. Configure permissions for anonymous role

-- Function: nearest_places
-- Already exists from 001_create_postgis_functions.sql
-- Track this function in Hasura Console to expose it as a GraphQL query

-- Function: places_in_bounds
-- Already exists from 001_create_postgis_functions.sql
-- Track this function in Hasura Console to expose it as a GraphQL query

-- Function: nearest_places_by_types
-- Already exists from 001_create_postgis_functions.sql
-- Track this function in Hasura Console to expose it as a GraphQL query

-- Function: nearby_facility_stats
-- Already exists from 001_create_postgis_functions.sql
-- Track this function in Hasura Console to expose it as a GraphQL query

-- Function: add_location
-- Created in 003_add_location_function.sql
-- This function handles adding a new location with optional address parsing and facility creation
-- Track this function in Hasura Console to expose it as a GraphQL mutation
