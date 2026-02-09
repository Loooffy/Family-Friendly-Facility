-- Complete Schema Migration - Update to Latest Data Structure
-- This migration creates/updates all necessary tables and functions for the Family-Friendly Facilities database
-- Based on the latest data structure from:
-- - 全國親子廁所 (Parent-Child Toilets)
-- - 全國哺集乳室 (Nursing Rooms)
-- - 台北市公園遊戲場 (Taipei Park Playgrounds)
-- - 台北市國小遊戲場 (Taipei Elementary School Playgrounds)
-- - 新北市共融公園遊戲場 (New Taipei Inclusive Park Playgrounds)

-- ============================================================================
-- PART 1: Enable PostGIS extension and drop old functions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- Drop old function versions to avoid parameter order conflicts
DROP FUNCTION IF EXISTS nearby_facility_stats(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);
DROP FUNCTION IF EXISTS nearest_places_by_types(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER[], INTEGER, INTEGER);
DROP FUNCTION IF EXISTS places_in_bounds(INTEGER, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS places_in_bounds(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);
DROP FUNCTION IF EXISTS nearest_places(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS add_location(VARCHAR, TEXT, DECIMAL, DECIMAL, INTEGER, INTEGER, VARCHAR, TEXT, BOOLEAN, TEXT, JSONB, JSONB);
DROP FUNCTION IF EXISTS add_location(VARCHAR, DECIMAL, DECIMAL, TEXT, INTEGER, INTEGER, VARCHAR, TEXT, BOOLEAN, TEXT, JSONB, JSONB);
DROP FUNCTION IF EXISTS update_location_geom();

-- ============================================================================
-- PART 2: Create tables
-- ============================================================================

-- 2.1 Create cities table
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Ensure unique constraint on cities.name exists
DO $$ 
BEGIN
    ALTER TABLE cities ADD CONSTRAINT cities_name_key UNIQUE (name);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2.2 Create districts table
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    "cityId" INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Ensure unique constraint on districts(cityId, name) exists
DO $$ 
BEGIN
    ALTER TABLE districts ADD CONSTRAINT districts_cityId_name_key UNIQUE ("cityId", name);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2.3 Create location_types table (update if exists)
CREATE TABLE IF NOT EXISTS location_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Ensure unique constraint on location_types.name exists
DO $$ 
BEGIN
    ALTER TABLE location_types ADD CONSTRAINT location_types_name_key UNIQUE (name);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add updatedAt column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'location_types' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE location_types ADD COLUMN "updatedAt" TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- 2.4 Update locations table structure
-- First, ensure the table exists (from previous migration)
-- Then add missing columns if they don't exist

-- Add districtId column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'locations' AND column_name = 'districtId'
    ) THEN
        -- First add the column without foreign key constraint
        ALTER TABLE locations ADD COLUMN "districtId" INTEGER;
        -- Then add the foreign key constraint separately
        ALTER TABLE locations 
        ADD CONSTRAINT locations_districtId_fkey 
        FOREIGN KEY ("districtId") REFERENCES districts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add updatedAt column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'locations' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE locations ADD COLUMN "updatedAt" TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- 2.5 Create facilities table
-- Stores equipment/facility information for playgrounds
CREATE TABLE IF NOT EXISTS facilities (
    id SERIAL PRIMARY KEY,
    "locationId" INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    "equipmentName" VARCHAR(255) NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 2.6 Create location_images table
-- Stores additional images for locations (e.g., playground images)
CREATE TABLE IF NOT EXISTS location_images (
    id SERIAL PRIMARY KEY,
    "locationId" INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    "imageUrl" TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- PART 3: Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS locations_geom_idx ON locations USING GIST (geom);
CREATE INDEX IF NOT EXISTS locations_type_idx ON locations("typeId");
CREATE INDEX IF NOT EXISTS locations_district_idx ON locations("districtId");
CREATE INDEX IF NOT EXISTS locations_lat_lng_idx ON locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS districts_city_idx ON districts("cityId");
CREATE INDEX IF NOT EXISTS facilities_location_idx ON facilities("locationId");
CREATE INDEX IF NOT EXISTS location_images_location_idx ON location_images("locationId");

-- ============================================================================
-- PART 4: Create functions and triggers
-- ============================================================================

-- 4.1 Create function to update geom column when latitude/longitude changes
CREATE OR REPLACE FUNCTION update_location_geom()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    ELSE
        NEW.geom := NULL;
    END IF;
    NEW."updatedAt" := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4.2 Create trigger to automatically update geom column
DROP TRIGGER IF EXISTS trigger_update_location_geom ON locations;
CREATE TRIGGER trigger_update_location_geom
    BEFORE INSERT OR UPDATE OF latitude, longitude ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_location_geom();

-- 4.3 Create/Update add_location function with images support
CREATE OR REPLACE FUNCTION add_location(
  p_name VARCHAR(255),
  p_lat DECIMAL(10,8),
  p_lng DECIMAL(11,8),
  p_address TEXT DEFAULT NULL,
  p_type_id INTEGER DEFAULT NULL,
  p_district_id INTEGER DEFAULT NULL,
  p_opening_hours VARCHAR(255) DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_diaper BOOLEAN DEFAULT FALSE,
  p_note TEXT DEFAULT NULL,
  p_facilities JSONB DEFAULT NULL,
  p_images JSONB DEFAULT NULL
)
RETURNS TABLE(
  id INTEGER,
  name VARCHAR(255),
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_location_id INTEGER;
  v_city_name VARCHAR(50);
  v_district_name VARCHAR(50);
  v_city_id INTEGER;
  v_district_id INTEGER;
  v_facility JSONB;
  v_image TEXT;
  v_image_order INTEGER := 0;
BEGIN
  -- Parse address if provided and district_id is not given
  IF p_address IS NOT NULL AND p_district_id IS NULL THEN
    -- Extract city name (e.g., "臺北市", "台北市", "新北市")
    v_city_name := (
      SELECT CASE
        WHEN p_address ~ '^臺北市' THEN '臺北市'
        WHEN p_address ~ '^台北市' THEN '臺北市'
        WHEN p_address ~ '^新北市' THEN '新北市'
        WHEN p_address ~ '^桃園市' THEN '桃園市'
        WHEN p_address ~ '^臺中市' THEN '臺中市'
        WHEN p_address ~ '^台中市' THEN '臺中市'
        WHEN p_address ~ '^臺南市' THEN '臺南市'
        WHEN p_address ~ '^台南市' THEN '臺南市'
        WHEN p_address ~ '^高雄市' THEN '高雄市'
        WHEN p_address ~ '^基隆市' THEN '基隆市'
        WHEN p_address ~ '^新竹市' THEN '新竹市'
        WHEN p_address ~ '^嘉義市' THEN '嘉義市'
        WHEN p_address ~ '^新竹縣' THEN '新竹縣'
        WHEN p_address ~ '^苗栗縣' THEN '苗栗縣'
        WHEN p_address ~ '^彰化縣' THEN '彰化縣'
        WHEN p_address ~ '^南投縣' THEN '南投縣'
        WHEN p_address ~ '^雲林縣' THEN '雲林縣'
        WHEN p_address ~ '^嘉義縣' THEN '嘉義縣'
        WHEN p_address ~ '^屏東縣' THEN '屏東縣'
        WHEN p_address ~ '^宜蘭縣' THEN '宜蘭縣'
        WHEN p_address ~ '^花蓮縣' THEN '花蓮縣'
        WHEN p_address ~ '^臺東縣' THEN '臺東縣'
        WHEN p_address ~ '^台東縣' THEN '臺東縣'
        WHEN p_address ~ '^澎湖縣' THEN '澎湖縣'
        WHEN p_address ~ '^金門縣' THEN '金門縣'
        WHEN p_address ~ '^連江縣' THEN '連江縣'
        ELSE NULL
      END
    );

    -- Extract district name (after city name, before next space or end)
    IF v_city_name IS NOT NULL THEN
      v_district_name := (
        SELECT (regexp_match(
          substring(p_address FROM length(v_city_name) + 1),
          '^([^區市鎮鄉縣]{1,4}[區市鎮鄉縣])'
        ))[1]
      );
    END IF;

    -- Get or create city
    IF v_city_name IS NOT NULL THEN
      INSERT INTO cities (name)
      VALUES (v_city_name)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_city_id;

      -- Get or create district
      IF v_district_name IS NOT NULL THEN
        SELECT id INTO v_district_id
        FROM districts
        WHERE "cityId" = v_city_id AND name = v_district_name;

        IF v_district_id IS NULL THEN
          INSERT INTO districts ("cityId", name)
          VALUES (v_city_id, v_district_name)
          RETURNING id INTO v_district_id;
        END IF;
      END IF;
    END IF;
  ELSE
    v_district_id := p_district_id;
  END IF;

  -- Insert location
  INSERT INTO locations (
    name, address, "typeId", "districtId", latitude, longitude,
    "openingHours", link, diaper, note
  ) VALUES (
    p_name,
    p_address,
    p_type_id,
    v_district_id,
    p_lat,
    p_lng,
    p_opening_hours,
    p_link,
    COALESCE(p_diaper, FALSE),
    p_note
  )
  RETURNING id, name INTO v_location_id, p_name;

  -- Insert facilities if provided
  -- Supports both formats:
  -- 1. { "equipment_name": "...", "image": "..." } (from Taipei data)
  -- 2. { "equipmentName": "...", "imageUrl": "..." } (from existing format)
  IF p_facilities IS NOT NULL THEN
    FOR v_facility IN SELECT * FROM jsonb_array_elements(p_facilities)
    LOOP
      INSERT INTO facilities ("locationId", "equipmentName", "imageUrl")
      VALUES (
        v_location_id,
        COALESCE(
          v_facility->>'equipment_name',
          v_facility->>'equipmentName'
        ),
        COALESCE(
          v_facility->>'image',
          v_facility->>'imageUrl'
        )
      );
    END LOOP;
  END IF;

  -- Insert images if provided
  -- Supports array of image URLs: ["url1", "url2", ...]
  IF p_images IS NOT NULL THEN
    FOR v_image IN SELECT jsonb_array_elements_text(p_images)
    LOOP
      INSERT INTO location_images ("locationId", "imageUrl", "order")
      VALUES (v_location_id, v_image, v_image_order);
      v_image_order := v_image_order + 1;
    END LOOP;
  END IF;

  -- Return result
  RETURN QUERY SELECT
    v_location_id,
    p_name,
    TRUE,
    'Location added successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 4.4 Update PostGIS Functions
-- Function 1: nearest_places
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
CREATE OR REPLACE FUNCTION places_in_bounds(
  p_north DOUBLE PRECISION,
  p_south DOUBLE PRECISION,
  p_east DOUBLE PRECISION,
  p_west DOUBLE PRECISION,
  p_type_id INTEGER DEFAULT NULL
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

-- ============================================================================
-- PART 5: Insert initial data
-- ============================================================================

-- 5.1 Insert initial location types
INSERT INTO location_types (name) VALUES
    ('親子廁所'),
    ('依法設置哺集乳室'),
    ('一般公園'),
    ('特色公園'),
    ('共融公園'),
    ('國小')
ON CONFLICT (name) DO NOTHING;

-- 5.2 Insert cities
INSERT INTO cities (name) VALUES
    ('臺北市'),
    ('台北市'),
    ('新北市'),
    ('桃園市'),
    ('臺中市'),
    ('台中市'),
    ('臺南市'),
    ('台南市'),
    ('高雄市'),
    ('基隆市'),
    ('新竹市'),
    ('嘉義市'),
    ('新竹縣'),
    ('苗栗縣'),
    ('彰化縣'),
    ('南投縣'),
    ('雲林縣'),
    ('嘉義縣'),
    ('屏東縣'),
    ('宜蘭縣'),
    ('花蓮縣'),
    ('臺東縣'),
    ('台東縣'),
    ('澎湖縣'),
    ('金門縣'),
    ('連江縣')
ON CONFLICT (name) DO NOTHING;
