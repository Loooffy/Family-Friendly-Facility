-- Function: add_location
-- Handles adding a new location with optional address parsing and facility creation
-- This replaces the Vercel Action handler

CREATE OR REPLACE FUNCTION add_location(
  p_name VARCHAR(255),
  p_address TEXT DEFAULT NULL,
  p_lat DECIMAL(10,8),
  p_lng DECIMAL(11,8),
  p_type_id INTEGER DEFAULT NULL,
  p_district_id INTEGER DEFAULT NULL,
  p_opening_hours VARCHAR(255) DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_diaper BOOLEAN DEFAULT FALSE,
  p_note TEXT DEFAULT NULL,
  p_facilities JSONB DEFAULT NULL
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
  IF p_facilities IS NOT NULL THEN
    FOR v_facility IN SELECT * FROM jsonb_array_elements(p_facilities)
    LOOP
      INSERT INTO facilities ("locationId", "equipmentName", "imageUrl")
      VALUES (
        v_location_id,
        v_facility->>'equipmentName',
        v_facility->>'imageUrl'
      );
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
