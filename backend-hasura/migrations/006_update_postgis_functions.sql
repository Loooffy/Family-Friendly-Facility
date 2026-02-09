-- Update PostGIS Functions to ensure compatibility with new schema
-- These functions are already compatible, but we ensure they work with the updated schema

-- Function 1: nearest_places
-- Returns locations within a radius, ordered by distance
-- Note: Facilities and images can be queried via Hasura relationships
CREATE OR REPLACE FUNCTION nearest_places(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_type_id INTEGER DEFAULT NULL,
  p_radius INTEGER DEFAULT 5000,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id INTEGER,
  name VARCHAR(255),
  type_id INTEGER,
  district_id INTEGER,
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  opening_hours VARCHAR(255),
  link TEXT,
  diaper BOOLEAN,
  note TEXT,
  created_at TIMESTAMP,
  distance DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l."typeId" as type_id,
    l."districtId" as district_id,
    l.address,
    l.latitude,
    l.longitude,
    l."openingHours" as opening_hours,
    l.link,
    l.diaper,
    l.note,
    l."createdAt" as created_at,
    ST_Distance(
      COALESCE(l.geom, ST_MakePoint(l.longitude, l.latitude)::geography),
      ST_MakePoint(p_lng, p_lat)::geography
    ) AS distance
  FROM locations l
  WHERE l.latitude IS NOT NULL 
    AND l.longitude IS NOT NULL
    AND (p_type_id IS NULL OR l."typeId" = p_type_id)
    AND ST_DWithin(
      COALESCE(l.geom, ST_MakePoint(l.longitude, l.latitude)::geography),
      ST_MakePoint(p_lng, p_lat)::geography,
      p_radius
    )
  ORDER BY distance
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function 2: places_in_bounds
-- Returns locations within a bounding box
CREATE OR REPLACE FUNCTION places_in_bounds(
  p_type_id INTEGER DEFAULT NULL,
  p_north DOUBLE PRECISION,
  p_south DOUBLE PRECISION,
  p_east DOUBLE PRECISION,
  p_west DOUBLE PRECISION
)
RETURNS TABLE(
  id INTEGER,
  name VARCHAR(255),
  type_id INTEGER,
  district_id INTEGER,
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  opening_hours VARCHAR(255),
  link TEXT,
  diaper BOOLEAN,
  note TEXT,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    l.id,
    l.name,
    l."typeId" as type_id,
    l."districtId" as district_id,
    l.address,
    l.latitude,
    l.longitude,
    l."openingHours" as opening_hours,
    l.link,
    l.diaper,
    l.note,
    l."createdAt" as created_at
  FROM locations l
  WHERE l.latitude IS NOT NULL 
    AND l.longitude IS NOT NULL
    AND (p_type_id IS NULL OR l."typeId" = p_type_id)
    AND l.longitude BETWEEN p_west AND p_east
    AND l.latitude BETWEEN p_south AND p_north
    AND ST_Within(
      COALESCE(l.geom, ST_MakePoint(l.longitude, l.latitude)::geography),
      ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function 3: nearest_places_by_types
-- Returns locations matching any of the specified types, ordered by distance
CREATE OR REPLACE FUNCTION nearest_places_by_types(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_type_ids INTEGER[],
  p_radius INTEGER DEFAULT 5000,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id INTEGER,
  name VARCHAR(255),
  type_id INTEGER,
  district_id INTEGER,
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  opening_hours VARCHAR(255),
  link TEXT,
  diaper BOOLEAN,
  note TEXT,
  created_at TIMESTAMP,
  distance DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    l.id,
    l.name,
    l."typeId" as type_id,
    l."districtId" as district_id,
    l.address,
    l.latitude,
    l.longitude,
    l."openingHours" as opening_hours,
    l.link,
    l.diaper,
    l.note,
    l."createdAt" as created_at,
    MIN(ST_Distance(
      COALESCE(l.geom, ST_MakePoint(l.longitude, l.latitude)::geography),
      ST_MakePoint(p_lng, p_lat)::geography
    )) OVER (PARTITION BY l.id) AS distance
  FROM locations l
  WHERE l.latitude IS NOT NULL 
    AND l.longitude IS NOT NULL
    AND l."typeId" = ANY(p_type_ids)
    AND ST_DWithin(
      COALESCE(l.geom, ST_MakePoint(l.longitude, l.latitude)::geography),
      ST_MakePoint(p_lng, p_lat)::geography,
      p_radius
    )
  GROUP BY l.id, l.name, l."typeId", l."districtId", l.address, 
           l.latitude, l.longitude, l."openingHours", l.link, 
           l.diaper, l.note, l."createdAt"
  ORDER BY distance
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function 4: nearby_facility_stats
-- Returns statistics about nearby facilities grouped by type
CREATE OR REPLACE FUNCTION nearby_facility_stats(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius INTEGER DEFAULT 5000
)
RETURNS TABLE(
  type_id INTEGER,
  type_name VARCHAR(50),
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lt.id AS type_id,
    lt.name AS type_name,
    COUNT(DISTINCT l.id)::BIGINT AS count
  FROM locations l
  INNER JOIN location_types lt ON lt.id = l."typeId"
  WHERE l.latitude IS NOT NULL 
    AND l.longitude IS NOT NULL
    AND ST_DWithin(
      COALESCE(l.geom, ST_MakePoint(l.longitude, l.latitude)::geography),
      ST_MakePoint(p_lng, p_lat)::geography,
      p_radius
    )
  GROUP BY lt.id, lt.name
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql STABLE;
