# Hasura Cloud 設定指南

## 1. 建立 Hasura Cloud 專案

1. 前往 [Hasura Cloud](https://cloud.hasura.io)
2. 登入或註冊帳號
3. 點擊 "Create Project"
4. 選擇區域（建議選擇與 Supabase 相同的區域）
5. 等待專案建立完成

## 2. 連接 Supabase 資料庫

1. 在 Hasura Cloud 專案中，前往 "Data" → "Connect Database"
2. 選擇 "Connect Existing Database"
3. 輸入資料庫連線資訊：
   - **Database Name**: `postgres` (Supabase 預設)
   - **Connection String**: 從 Supabase Dashboard 取得連線字串
     - 格式：`postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres`
4. 點擊 "Connect Database"

## 3. 追蹤資料表

在 Hasura Console 中，前往 "Data" → "Untracked tables or views"，追蹤以下資料表：

- `cities`
- `districts`
- `location_types`
- `locations`
- `facilities`
- `location_images`

## 4. 設定關聯 (Relationships)

### City → districts (one-to-many)
- Table: `cities`
- Relationship Name: `districts`
- Type: Array Relationship
- Reference: `districts.cityId` → `cities.id`

### District → city (many-to-one)
- Table: `districts`
- Relationship Name: `city`
- Type: Object Relationship
- Reference: `districts.cityId` → `cities.id`

### District → locations (one-to-many)
- Table: `districts`
- Relationship Name: `locations`
- Type: Array Relationship
- Reference: `locations.districtId` → `districts.id`

### Location → type (many-to-one)
- Table: `locations`
- Relationship Name: `type`
- Type: Object Relationship
- Reference: `locations.typeId` → `location_types.id`

### Location → district (many-to-one)
- Table: `locations`
- Relationship Name: `district`
- Type: Object Relationship
- Reference: `locations.districtId` → `districts.id`

### Location → facilities (one-to-many)
- Table: `locations`
- Relationship Name: `facilities`
- Type: Array Relationship
- Reference: `facilities.locationId` → `locations.id`

### Location → images (one-to-many)
- Table: `locations`
- Relationship Name: `images`
- Type: Array Relationship
- Reference: `location_images.locationId` → `locations.id`

### LocationType → locations (one-to-many)
- Table: `location_types`
- Relationship Name: `locations`
- Type: Array Relationship
- Reference: `locations.typeId` → `location_types.id`

## 5. 設定權限 (Permissions)

### Query 權限（公開讀取）

為以下資料表設定 `select` 權限給 `anonymous` role：

- `cities`: 允許 select
- `districts`: 允許 select
- `location_types`: 允許 select
- `locations`: 允許 select
- `facilities`: 允許 select
- `location_images`: 允許 select

### Mutation 權限（如果需要公開寫入）

為 `locations` 資料表設定 `insert` 權限給 `anonymous` role（僅用於 `addLocation`，實際會透過 Action 處理）。

## 6. 確認 PostGIS 擴充功能

在 Supabase SQL Editor 執行：

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## 7. 更新環境變數

在專案根目錄的 `.env` 或環境變數設定中新增：

```env
HASURA_GRAPHQL_URL=https://your-project.hasura.app
HASURA_GRAPHQL_ADMIN_SECRET=your-admin-secret
```

## 8. 使用 Hasura CLI（可選）

如果需要使用 CLI 管理 metadata：

```bash
# 安裝 Hasura CLI
npm install -g hasura-cli

# 初始化（如果尚未初始化）
cd hasura
hasura init

# 匯出 metadata
hasura metadata export

# 應用 metadata
hasura metadata apply
```
