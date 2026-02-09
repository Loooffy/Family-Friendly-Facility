# Hasura Migrations

此目錄包含 Hasura 的 SQL migrations。

## 執行 Migrations

### 本地開發

```bash
cd hasura
hasura migrate apply \
  --endpoint https://your-project.hasura.app \
  --admin-secret YOUR_ADMIN_SECRET \
  --database-name default
```

### 透過 CI/CD

Migrations 會在推送到 main 分支時自動執行（見 `.github/workflows/deploy-hasura.yml`）。

## 建立新的 Migration

```bash
cd hasura
hasura migrate create migration_name \
  --endpoint https://your-project.hasura.app \
  --admin-secret YOUR_ADMIN_SECRET \
  --database-name default
```

## Migration 檔案

按照順序執行以下 migration 檔案：

1. `001_create_postgis_functions.sql` - 建立 PostGIS 查詢函數（nearest_places, places_in_bounds, nearest_places_by_types, nearby_facility_stats）
2. `002_expose_custom_functions.sql` - 說明如何追蹤自訂函數（僅文件，無 SQL）
3. `003_add_location_function.sql` - 建立 add_location 函數（舊版本，已由 005 更新）
4. `004_create_complete_schema.sql` - **建立完整的資料表結構**（cities, districts, location_types, locations, facilities, location_images）
5. `005_update_add_location_function.sql` - **更新 add_location 函數**以支援新的資料結構（包含 images 陣列）
6. `006_update_postgis_functions.sql` - **更新 PostGIS 函數**以使用 geom 欄位並確保相容性

## 資料結構說明

### 支援的資料來源

- **全國親子廁所** (`全國親子廁所.json`)
  - 欄位：name, address, latitude, longitude, type, diaper, city, district
  
- **全國哺集乳室** (`全國哺集乳室.json`)
  - 欄位：name, address, latitude, longitude, type, city, district, opening_hours, note
  
- **台北市公園遊戲場** (`台北市公園遊戲場.json`)
  - 欄位：link, name, type, facilities (equipment_name, image), latitude, longitude, district, city, address
  
- **台北市國小遊戲場** (`台北市國小遊戲場.json`)
  - 欄位：location, district, address, longitude, latitude, link, facilities (equipment_name, image), type
  
- **新北市共融公園遊戲場** (`新北市共融公園遊戲場.json`)
  - 欄位：location, district, address, longitude, latitude, link, facilities (equipment_name), images (array), type

### 資料表結構

- **cities**: 縣市資料
- **districts**: 鄉鎮區資料（關聯到 cities）
- **location_types**: 地點類型（親子廁所、哺集乳室、公園、國小等）
- **locations**: 地點主資料表（包含所有地點資訊）
- **facilities**: 設施/設備資料（關聯到 locations，用於遊戲場設備）
- **location_images**: 地點圖片（關聯到 locations，支援多張圖片）
