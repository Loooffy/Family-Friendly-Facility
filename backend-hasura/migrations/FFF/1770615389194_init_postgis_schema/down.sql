DROP FUNCTION IF EXISTS nearest_places;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS location_types;
-- 注意：通常不建議在 down 裡面 DROP EXTENSION postgis，因為可能有其他地方在使用