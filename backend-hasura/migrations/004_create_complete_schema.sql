-- Complete Schema Migration
-- This migration creates all necessary tables for the Family-Friendly Facilities database
-- Based on the latest data structure from:
-- - 全國親子廁所 (Parent-Child Toilets)
-- - 全國哺集乳室 (Nursing Rooms)
-- - 台北市公園遊戲場 (Taipei Park Playgrounds)
-- - 台北市國小遊戲場 (Taipei Elementary School Playgrounds)
-- - 新北市共融公園遊戲場 (New Taipei Inclusive Park Playgrounds)

-- 1. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create cities table
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 3. Create districts table
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    "cityId" INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("cityId", name)
);

-- 4. Create location_types table
CREATE TABLE IF NOT EXISTS location_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 5. Create locations table
-- Supports all location types: toilets, nursing rooms, playgrounds, etc.
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "typeId" INTEGER REFERENCES location_types(id) ON DELETE SET NULL,
    "districtId" INTEGER REFERENCES districts(id) ON DELETE SET NULL,
    address TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    -- PostGIS geography column for spatial queries
    geom GEOGRAPHY(Point, 4326),
    "openingHours" VARCHAR(255),
    link TEXT,
    diaper BOOLEAN DEFAULT FALSE,
    note TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 6. Create facilities table
-- Stores equipment/facility information for playgrounds
CREATE TABLE IF NOT EXISTS facilities (
    id SERIAL PRIMARY KEY,
    "locationId" INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    "equipmentName" VARCHAR(255) NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 7. Create location_images table
-- Stores additional images for locations (e.g., playground images)
CREATE TABLE IF NOT EXISTS location_images (
    id SERIAL PRIMARY KEY,
    "locationId" INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    "imageUrl" TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS locations_geom_idx ON locations USING GIST (geom);
CREATE INDEX IF NOT EXISTS locations_type_idx ON locations("typeId");
CREATE INDEX IF NOT EXISTS locations_district_idx ON locations("districtId");
CREATE INDEX IF NOT EXISTS locations_lat_lng_idx ON locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS districts_city_idx ON districts("cityId");
CREATE INDEX IF NOT EXISTS facilities_location_idx ON facilities("locationId");
CREATE INDEX IF NOT EXISTS location_images_location_idx ON location_images("locationId");

-- 9. Create function to update geom column when latitude/longitude changes
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

-- 10. Create trigger to automatically update geom column
DROP TRIGGER IF EXISTS trigger_update_location_geom ON locations;
CREATE TRIGGER trigger_update_location_geom
    BEFORE INSERT OR UPDATE OF latitude, longitude ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_location_geom();

-- 11. Insert initial location types based on data structure
INSERT INTO location_types (name) VALUES
    ('親子廁所'),
    ('依法設置哺集乳室'),
    ('一般公園'),
    ('特色公園'),
    ('共融公園'),
    ('國小')
ON CONFLICT (name) DO NOTHING;

-- 12. Insert cities from 台灣縣市鄉鎮.json
-- Note: This is a basic set, you may need to add more cities based on your data
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
