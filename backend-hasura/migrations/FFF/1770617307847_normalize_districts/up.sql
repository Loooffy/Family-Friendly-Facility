-- Normalize Districts Migration
-- 正規化鄉鎮市區資料
-- 1. 統一城市名稱（「台」→「臺」）
-- 2. 插入所有正規化的鄉鎮市區資料
-- 3. 更新現有資料以使用正規化的城市和鄉鎮市區

-- ============================================================================
-- PART 1: Normalize city names (統一城市名稱)
-- ============================================================================

-- 1.1 確保「臺」版本的城市存在（如果只有「台」版本，先創建「臺」版本）
INSERT INTO cities (name) VALUES
    ('臺北市'),
    ('臺中市'),
    ('臺南市'),
    ('臺東縣')
ON CONFLICT (name) DO NOTHING;

-- 1.2 合併重複的城市（將「台北市」合併到「臺北市」，依此類推）
-- 先更新 districts 的 cityId，將它們指向正規化的城市
UPDATE districts d
SET "cityId" = (
    SELECT id FROM cities 
    WHERE name = CASE 
        WHEN (SELECT name FROM cities WHERE id = d."cityId") = '台北市' THEN '臺北市'
        WHEN (SELECT name FROM cities WHERE id = d."cityId") = '台中市' THEN '臺中市'
        WHEN (SELECT name FROM cities WHERE id = d."cityId") = '台南市' THEN '臺南市'
        WHEN (SELECT name FROM cities WHERE id = d."cityId") = '台東縣' THEN '臺東縣'
        ELSE (SELECT name FROM cities WHERE id = d."cityId")
    END
)
WHERE EXISTS (
    SELECT 1 FROM cities c 
    WHERE c.id = d."cityId" 
    AND c.name IN ('台北市', '台中市', '台南市', '台東縣')
);

-- 1.3 刪除重複的城市（保留「臺」版本）
-- 注意：這會在 districts 的 cityId 更新後執行
DELETE FROM cities 
WHERE name IN ('台北市', '台中市', '台南市', '台東縣')
AND EXISTS (
    SELECT 1 FROM cities c2 
    WHERE c2.name = REPLACE(cities.name, '台', '臺')
    AND c2.id != cities.id
);

-- 1.3 更新「桃園縣」為「桃園市」（已升格為直轄市）
UPDATE cities SET name = '桃園市' WHERE name = '桃園縣';

-- 更新相關的 districts 和 locations
UPDATE districts d
SET "cityId" = (SELECT id FROM cities WHERE name = '桃園市')
WHERE EXISTS (
    SELECT 1 FROM cities c 
    WHERE c.id = d."cityId" AND c.name = '桃園縣'
);

-- 刪除舊的「桃園縣」
DELETE FROM cities WHERE name = '桃園縣';

-- ============================================================================
-- PART 2: Insert normalized districts (插入正規化的鄉鎮市區)
-- ============================================================================

-- 2.1 確保所有城市都存在（使用正規化後的名稱）
INSERT INTO cities (name) VALUES
    ('臺北市'),
    ('新北市'),
    ('桃園市'),
    ('臺中市'),
    ('臺南市'),
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
    ('澎湖縣'),
    ('金門縣'),
    ('連江縣')
ON CONFLICT (name) DO NOTHING;

-- 2.2 插入所有正規化的鄉鎮市區
-- 臺北市
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '臺北市'), unnest(ARRAY[
    '松山區', '大安區', '中正區', '萬華區', '大同區', '中山區',
    '文山區', '南港區', '內湖區', '士林區', '北投區', '信義區'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 新北市
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '新北市'), unnest(ARRAY[
    '新莊區', '林口區', '五股區', '蘆洲區', '三重區', '泰山區',
    '新店區', '石碇區', '深坑區', '坪林區', '烏來區', '板橋區',
    '三峽區', '鶯歌區', '樹林區', '中和區', '土城區', '瑞芳區',
    '平溪區', '雙溪區', '貢寮區', '金山區', '萬里區', '淡水區',
    '汐止區', '三芝區', '石門區', '八里區', '永和區'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 桃園市
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '桃園市'), unnest(ARRAY[
    '桃園區', '大溪區', '中壢區', '楊梅區', '蘆竹區', '大園區',
    '龜山區', '八德區', '龍潭區', '平鎮區', '新屋區', '觀音區', '復興區'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 臺中市
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '臺中市'), unnest(ARRAY[
    '中區', '東區', '南區', '西區', '北區', '西屯區', '南屯區', '北屯區',
    '豐原區', '東勢區', '大甲區', '清水區', '沙鹿區', '梧棲區', '后里區',
    '神岡區', '潭子區', '大雅區', '新社區', '石岡區', '外埔區', '大安區',
    '烏日區', '大肚區', '龍井區', '霧峰區', '太平區', '大里區', '和平區'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 臺南市
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '臺南市'), unnest(ARRAY[
    '東區', '南區', '北區', '安南區', '安平區', '中西區', '新營區', '鹽水區',
    '柳營區', '白河區', '後壁區', '東山區', '麻豆區', '下營區', '六甲區',
    '官田區', '大內區', '佳里區', '西港區', '七股區', '將軍區', '北門區',
    '學甲區', '新化區', '善化區', '新市區', '安定區', '山上區', '左鎮區',
    '仁德區', '歸仁區', '關廟區', '龍崎區', '玉井區', '楠西區', '南化區', '永康區'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 高雄市
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '高雄市'), unnest(ARRAY[
    '鹽埕區', '鼓山區', '左營區', '楠梓區', '三民區', '新興區', '前金區',
    '苓雅區', '前鎮區', '旗津區', '小港區', '鳳山區', '林園區', '大寮區',
    '大樹區', '大社區', '仁武區', '鳥松區', '岡山區', '橋頭區', '燕巢區',
    '田寮區', '阿蓮區', '路竹區', '湖內區', '茄萣區', '永安區', '彌陀區',
    '梓官區', '旗山區', '美濃區', '六龜區', '甲仙區', '杉林區', '內門區',
    '茂林區', '桃源區', '那瑪夏區'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 基隆市
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '基隆市'), unnest(ARRAY[
    '中正區', '七堵區', '暖暖區', '仁愛區', '中山區', '安樂區', '信義區'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 新竹市
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '新竹市'), unnest(ARRAY[
    '新竹市'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 嘉義市
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '嘉義市'), unnest(ARRAY[
    '朴子市', '布袋鎮', '大林鎮', '民雄鄉', '溪口鄉', '新港鄉', '六腳鄉',
    '東石鄉', '義竹鄉', '鹿草鄉', '太保市', '水上鄉', '中埔鄉', '竹崎鄉',
    '梅山鄉', '番路鄉', '大埔鄉', '阿里山鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 新竹縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '新竹縣'), unnest(ARRAY[
    '竹東鎮', '關西鎮', '新埔鎮', '竹北市', '湖口鄉', '橫山鄉', '新豐鄉',
    '芎林鄉', '寶山鄉', '北埔鄉', '峨眉鄉', '尖石鄉', '五峰鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 苗栗縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '苗栗縣'), unnest(ARRAY[
    '苗栗市', '苑裡鎮', '通霄鎮', '公館鄉', '銅鑼鄉', '三義鄉', '西湖鄉',
    '頭屋鄉', '竹南鎮', '頭份市', '造橋鄉', '後龍鎮', '三灣鄉', '南庄鄉',
    '大湖鄉', '卓蘭鎮', '獅潭鄉', '泰安鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 彰化縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '彰化縣'), unnest(ARRAY[
    '彰化市', '鹿港鎮', '和美鎮', '北斗鎮', '員林市', '溪湖鎮', '田中鎮',
    '二林鎮', '線西鄉', '伸港鄉', '福興鄉', '秀水鄉', '花壇鄉', '芬園鄉',
    '大村鄉', '埔鹽鄉', '埔心鄉', '永靖鄉', '社頭鄉', '二水鄉', '田尾鄉',
    '埤頭鄉', '芳苑鄉', '大城鄉', '竹塘鄉', '溪州鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 南投縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '南投縣'), unnest(ARRAY[
    '南投市', '埔里鎮', '草屯鎮', '竹山鎮', '集集鎮', '名間鄉', '鹿谷鄉',
    '中寮鄉', '魚池鄉', '國姓鄉', '水里鄉', '信義鄉', '仁愛鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 雲林縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '雲林縣'), unnest(ARRAY[
    '斗六市', '斗南鎮', '虎尾鎮', '西螺鎮', '土庫鎮', '北港鎮', '古坑鄉',
    '大埤鄉', '莿桐鄉', '林內鄉', '二崙鄉', '崙背鄉', '麥寮鄉', '東勢鄉',
    '褒忠鄉', '臺西鄉', '元長鄉', '四湖鄉', '口湖鄉', '水林鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 嘉義縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '嘉義縣'), unnest(ARRAY[
    '朴子市', '布袋鎮', '大林鎮', '民雄鄉', '溪口鄉', '新港鄉', '六腳鄉',
    '東石鄉', '義竹鄉', '鹿草鄉', '太保市', '水上鄉', '中埔鄉', '竹崎鄉',
    '梅山鄉', '番路鄉', '大埔鄉', '阿里山鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 屏東縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '屏東縣'), unnest(ARRAY[
    '屏東市', '潮州鎮', '東港鎮', '恆春鎮', '萬丹鄉', '長治鄉', '麟洛鄉',
    '九如鄉', '里港鄉', '鹽埔鄉', '高樹鄉', '萬巒鄉', '內埔鄉', '竹田鄉',
    '新埤鄉', '枋寮鄉', '新園鄉', '崁頂鄉', '林邊鄉', '南州鄉', '佳冬鄉',
    '琉球鄉', '車城鄉', '滿州鄉', '枋山鄉', '三地門鄉', '霧臺鄉', '瑪家鄉',
    '泰武鄉', '來義鄉', '春日鄉', '獅子鄉', '牡丹鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 宜蘭縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '宜蘭縣'), unnest(ARRAY[
    '宜蘭市', '頭城鎮', '礁溪鄉', '壯圍鄉', '員山鄉', '羅東鎮', '五結鄉',
    '冬山鄉', '蘇澳鎮', '三星鄉', '大同鄉', '南澳鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 花蓮縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '花蓮縣'), unnest(ARRAY[
    '花蓮市', '光復鄉', '玉里鎮', '新城鄉', '吉安鄉', '壽豐鄉', '鳳林鎮',
    '豐濱鄉', '瑞穗鄉', '富里鄉', '秀林鄉', '萬榮鄉', '卓溪鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 臺東縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '臺東縣'), unnest(ARRAY[
    '臺東市', '成功鎮', '關山鎮', '卑南鄉', '大武鄉', '太麻里鄉', '東河鄉',
    '長濱鄉', '鹿野鄉', '池上鄉', '綠島鄉', '延平鄉', '海端鄉', '達仁鄉',
    '金峰鄉', '蘭嶼鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 澎湖縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '澎湖縣'), unnest(ARRAY[
    '馬公市', '湖西鄉', '白沙鄉', '西嶼鄉', '望安鄉', '七美鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 金門縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '金門縣'), unnest(ARRAY[
    '金湖鎮', '金沙鎮', '金城鎮', '金寧鄉', '烈嶼鄉', '烏坵鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- 連江縣
INSERT INTO districts ("cityId", name)
SELECT (SELECT id FROM cities WHERE name = '連江縣'), unnest(ARRAY[
    '南竿鄉', '北竿鄉', '莒光鄉', '東引鄉'
])
ON CONFLICT ("cityId", name) DO NOTHING;

-- ============================================================================
-- PART 3: Update existing locations to use normalized districts
-- ============================================================================

-- 3.1 對於 districtId 為 NULL 的 locations，嘗試從地址中解析並設定 districtId
-- 注意：這只會更新 districtId 為 NULL 的 locations
-- 已經有 districtId 的 locations 會透過 districts 的 cityId 更新自動保持正確

-- 使用 add_location 函數的邏輯來解析地址並更新 districtId
-- 這裡我們創建一個臨時函數來處理這個更新
DO $$
DECLARE
    v_location RECORD;
    v_city_name VARCHAR(50);
    v_district_name VARCHAR(50);
    v_city_id INTEGER;
    v_district_id INTEGER;
BEGIN
    FOR v_location IN 
        SELECT id, address FROM locations 
        WHERE "districtId" IS NULL AND address IS NOT NULL
    LOOP
        -- 提取城市名稱（正規化後）
        v_city_name := CASE
            WHEN v_location.address ~ '^臺北市' OR v_location.address ~ '^台北市' THEN '臺北市'
            WHEN v_location.address ~ '^新北市' THEN '新北市'
            WHEN v_location.address ~ '^桃園市' OR v_location.address ~ '^桃園縣' THEN '桃園市'
            WHEN v_location.address ~ '^臺中市' OR v_location.address ~ '^台中市' THEN '臺中市'
            WHEN v_location.address ~ '^臺南市' OR v_location.address ~ '^台南市' THEN '臺南市'
            WHEN v_location.address ~ '^高雄市' THEN '高雄市'
            WHEN v_location.address ~ '^基隆市' THEN '基隆市'
            WHEN v_location.address ~ '^新竹市' THEN '新竹市'
            WHEN v_location.address ~ '^嘉義市' THEN '嘉義市'
            WHEN v_location.address ~ '^新竹縣' THEN '新竹縣'
            WHEN v_location.address ~ '^苗栗縣' THEN '苗栗縣'
            WHEN v_location.address ~ '^彰化縣' THEN '彰化縣'
            WHEN v_location.address ~ '^南投縣' THEN '南投縣'
            WHEN v_location.address ~ '^雲林縣' THEN '雲林縣'
            WHEN v_location.address ~ '^嘉義縣' THEN '嘉義縣'
            WHEN v_location.address ~ '^屏東縣' THEN '屏東縣'
            WHEN v_location.address ~ '^宜蘭縣' THEN '宜蘭縣'
            WHEN v_location.address ~ '^花蓮縣' THEN '花蓮縣'
            WHEN v_location.address ~ '^臺東縣' OR v_location.address ~ '^台東縣' THEN '臺東縣'
            WHEN v_location.address ~ '^澎湖縣' THEN '澎湖縣'
            WHEN v_location.address ~ '^金門縣' THEN '金門縣'
            WHEN v_location.address ~ '^連江縣' THEN '連江縣'
            ELSE NULL
        END;

        -- 如果找到城市，提取區域名稱
        IF v_city_name IS NOT NULL THEN
            SELECT id INTO v_city_id FROM cities WHERE name = v_city_name;
            
            IF v_city_id IS NOT NULL THEN
                -- 提取區域名稱
                v_district_name := (
                    SELECT (regexp_match(
                        substring(v_location.address FROM 
                            CASE 
                                WHEN v_location.address ~ '^臺北市' OR v_location.address ~ '^台北市' THEN 4
                                WHEN v_location.address ~ '^新北市' THEN 4
                                WHEN v_location.address ~ '^桃園市' OR v_location.address ~ '^桃園縣' THEN 4
                                WHEN v_location.address ~ '^臺中市' OR v_location.address ~ '^台中市' THEN 4
                                WHEN v_location.address ~ '^臺南市' OR v_location.address ~ '^台南市' THEN 4
                                WHEN v_location.address ~ '^高雄市' THEN 4
                                WHEN v_location.address ~ '^基隆市' THEN 4
                                WHEN v_location.address ~ '^新竹市' THEN 4
                                WHEN v_location.address ~ '^嘉義市' THEN 4
                                WHEN v_location.address ~ '^新竹縣' THEN 4
                                WHEN v_location.address ~ '^苗栗縣' THEN 4
                                WHEN v_location.address ~ '^彰化縣' THEN 4
                                WHEN v_location.address ~ '^南投縣' THEN 4
                                WHEN v_location.address ~ '^雲林縣' THEN 4
                                WHEN v_location.address ~ '^嘉義縣' THEN 4
                                WHEN v_location.address ~ '^屏東縣' THEN 4
                                WHEN v_location.address ~ '^宜蘭縣' THEN 4
                                WHEN v_location.address ~ '^花蓮縣' THEN 4
                                WHEN v_location.address ~ '^臺東縣' OR v_location.address ~ '^台東縣' THEN 4
                                WHEN v_location.address ~ '^澎湖縣' THEN 4
                                WHEN v_location.address ~ '^金門縣' THEN 4
                                WHEN v_location.address ~ '^連江縣' THEN 4
                                ELSE 0
                            END + 1),
                        '^([^區市鎮鄉縣]{1,4}[區市鎮鄉縣])'
                    ))[1]
                );

                -- 如果找到區域名稱，查找對應的 districtId
                IF v_district_name IS NOT NULL THEN
                    SELECT id INTO v_district_id 
                    FROM districts 
                    WHERE "cityId" = v_city_id AND name = v_district_name;

                    -- 更新 location 的 districtId
                    IF v_district_id IS NOT NULL THEN
                        UPDATE locations 
                        SET "districtId" = v_district_id 
                        WHERE id = v_location.id;
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- PART 4: Clean up orphaned districts (清理孤立的鄉鎮市區)
-- ============================================================================

-- 刪除沒有關聯任何 locations 的 districts（可選，根據需求決定是否執行）
-- DELETE FROM districts d
-- WHERE NOT EXISTS (
--     SELECT 1 FROM locations l WHERE l."districtId" = d.id
-- )
-- AND d."createdAt" < NOW() - INTERVAL '1 day';
