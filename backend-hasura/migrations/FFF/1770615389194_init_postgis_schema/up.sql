-- 1. 確保開啟 PostGIS 擴充功能
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. 建立資料表
CREATE TABLE location_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "typeId" INTEGER REFERENCES location_types(id),
    address TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    -- 關鍵：新增實體地理欄位
    geom GEOGRAPHY(Point, 4326), 
    "openingHours" VARCHAR(255),
    link TEXT,
    diaper BOOLEAN DEFAULT FALSE,
    note TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- 3. 建立空間索引 (讓搜尋變快)
CREATE INDEX locations_geom_idx ON locations USING GIST (geom);

-- 4. 插入你之前的 nearest_places 函式 (已優化為使用 geom 欄位)
CREATE OR REPLACE FUNCTION nearest_places(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius INTEGER DEFAULT 5000,
  p_limit INTEGER DEFAULT 20
)
RETURNS SETOF locations AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM locations
  WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius)
  ORDER BY geom <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;