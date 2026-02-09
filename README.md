# 育兒友善設施地圖 App

提供使用者快速找到附近的親子設施，包括哺乳室、親子廁所、遊戲場、親子友善地點等。

## 專案結構

```
.
├── frontend/          # React + Mapbox 前端
├── hasura/            # Hasura Migrations 和 Metadata
│   ├── migrations/    # SQL migrations (包含 PostGIS functions)
│   ├── metadata/      # Hasura metadata
│   └── config.yaml    # Hasura CLI 配置
├── prisma/            # Database Schema (保留用於 migration 參考)
├── scripts/           # 資料匯入腳本和工具
└── data/              # 原始資料檔案和處理腳本
    └── scripts/       # Python 資料處理腳本
```

## 技術棧

- **前端**: React + Mapbox GL JS + Apollo Client
- **GraphQL API**: Hasura Cloud (自動生成 CRUD API + Custom Functions)
- **資料庫**: PostgreSQL + PostGIS (Supabase)
- **部署**: 
  - Hasura Cloud (GraphQL API)
  - 任何靜態網站託管平台（前端，如 Netlify、Cloudflare Pages 等）

## 快速開始

### 使用 Docker Compose（推薦）

最簡單的方式是使用 Docker Compose 運行完整的開發環境：

#### 1. 設定環境變數

```bash
# 複製環境變數範例檔案
cp .env.docker.example .env.docker

# 編輯 .env.docker 並填入 Mapbox Token
# MAPBOX_TOKEN=your_mapbox_token_here
```

#### 2. 啟動所有服務

```bash
docker-compose up -d
```

這會啟動：
- **PostgreSQL + PostGIS** (port 5432)
- **Hasura GraphQL Engine** (port 8080)
- **Frontend** (port 3000)

#### 3. 初始化資料庫

**首次啟動時**：PostgreSQL 容器會自動執行 `hasura/migrations/` 目錄中的 SQL 檔案（包括 PostGIS functions）。

**如果資料庫已存在**（volume 未清除），需要手動執行 migrations：

```bash
# 執行 PostGIS functions migration
docker-compose exec postgres psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/001_create_postgis_functions.sql
```

或清除 volume 重新開始：

```bash
docker-compose down -v
docker-compose up -d
```

#### 4. 設定 Hasura

1. 開啟 Hasura Console: http://localhost:8080/console
2. 使用 admin secret: `myadminsecretkey`
3. 參考下方的「Hasura 設定」章節完成設定

#### 5. 匯入資料（可選）

```bash
# 設定資料庫連線
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres

# 安裝 Python 依賴
cd data && uv sync && cd ..  # 或 pip install -r data/requirements.txt

# 執行 seed script
python3 scripts/seed-pg.py  # 或 npm run seed
```

#### 6. 訪問應用程式

- **Frontend**: http://localhost:3000
- **Hasura Console**: http://localhost:8080/console
- **Hasura GraphQL**: http://localhost:8080/v1/graphql

### 本地開發（不使用 Docker）

#### 1. 前置需求

- Node.js 20+
- Python 3.8+（用於資料處理腳本）
- **資料庫**（二選一）：
  - 本地 PostgreSQL Docker container（推薦用於本地開發）
  - Supabase 專案（PostgreSQL + PostGIS）
- Hasura Cloud 專案（或本地 Hasura）
- Mapbox 帳號

**使用本地 PostgreSQL Docker container**：
```bash
# 啟動 PostgreSQL + PostGIS container
docker run -d \
  --name postgres-dev \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -p 5432:5432 \
  postgis/postgis:16-3.4

# 或使用 docker-compose（只啟動 postgres 服務）
docker-compose up -d postgres
```

#### 2. 安裝依賴

```bash
# Node.js 依賴
npm install

# Python 依賴（用於資料處理）
cd data
uv sync  # 或 pip install -r requirements.txt
cd ..
```

#### 3. 設定環境變數

**Frontend** (`frontend/.env`):
```env
# 使用本地 Hasura（推薦用於本地開發）
VITE_HASURA_GRAPHQL_URL=http://localhost:8080/v1/graphql

# 或使用 Hasura Cloud
# VITE_HASURA_GRAPHQL_URL=https://your-project.hasura.app/v1/graphql

VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

**Hasura** (`hasura/config.yaml`):
```yaml
# 使用本地 Hasura（推薦用於本地開發）
endpoint: http://localhost:8080
admin_secret: myadminsecretkey

# 或使用 Hasura Cloud
# endpoint: https://your-project.hasura.app
# admin_secret: ${HASURA_GRAPHQL_ADMIN_SECRET}
```

**資料匯入腳本**:
```env
# 使用本地 Docker PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres

# 或使用 Supabase
# DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
```

#### 4. 設定 Hasura Cloud（或本地 Hasura）

**使用 Hasura Cloud**：
1. 前往 [Hasura Cloud](https://cloud.hasura.io) 建立專案
2. 連接 Supabase 資料庫或本地 PostgreSQL
3. 參考下方的「Hasura 設定」章節完成設定

**使用本地 Hasura**（推薦用於本地開發）：
```bash
# 使用 docker-compose 啟動 Hasura
docker-compose up -d hasura

# Hasura Console: http://localhost:8080/console
# Admin secret: myadminsecretkey
```

#### 5. 執行資料庫 Migrations

**使用 Hasura CLI**：
```bash
# 執行 PostGIS 函數 migration
cd hasura

# 使用本地 Hasura
hasura migrate apply \
  --endpoint http://localhost:8080 \
  --admin-secret myadminsecretkey \
  --database-name default

# 或使用 Hasura Cloud
# hasura migrate apply \
#   --endpoint https://your-project.hasura.app \
#   --admin-secret YOUR_ADMIN_SECRET \
#   --database-name default
```

**或直接在資料庫中執行**：
- 本地 PostgreSQL：`docker-compose exec postgres psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/001_create_postgis_functions.sql`
- Supabase：在 Supabase SQL Editor 中執行 `hasura/migrations/` 目錄中的所有 SQL 檔案

#### 6. 匯入資料（可選）

```bash
# 使用 PostgreSQL-based seed script (Python 版本)
# 確保已安裝 Python 依賴
cd data
uv sync  # 或 pip install -r requirements.txt
cd ..

# 設定資料庫連線並執行
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"
python3 scripts/seed-pg.py
npm run seed
```

#### 7. 啟動開發伺服器

```bash
# 從專案根目錄
npm run dev --workspace=frontend
```

- Frontend: http://localhost:3000
- Hasura GraphQL: https://your-project.hasura.app/v1/graphql

## Hasura 設定

### 1. 追蹤資料表

在 Hasura Console 中：

1. 前往 **Data** → **Tables**
2. 點擊 **Track All** 來追蹤所有資料表
3. 或手動追蹤需要的資料表：
   - `locations`
   - `location_types`
   - `districts`
   - `cities`
   - `facilities`
   - `location_images`

### 2. 設定 Relationships

#### locations 表的 Relationships

1. **type** (Object Relationship)
   - From: `locations.typeId` → `location_types.id`

2. **district** (Object Relationship)
   - From: `locations.districtId` → `districts.id`

3. **facilities** (Array Relationship)
   - From: `locations.id` → `facilities.locationId`

4. **images** (Array Relationship)
   - From: `locations.id` → `location_images.locationId`

#### districts 表的 Relationships

1. **city** (Object Relationship)
   - From: `districts.cityId` → `cities.id`

### 3. 追蹤 PostgreSQL Functions

在 Hasura Console 中：

1. 前往 **Data** → **Functions**
2. 追蹤以下函數：
   - `nearest_places(p_lat double precision, p_lng double precision, p_type_id integer, p_radius integer, p_limit integer)`
   - `places_in_bounds(p_type_id integer, p_north double precision, p_south double precision, p_east double precision, p_west double precision)`
   - `nearest_places_by_types(p_lat double precision, p_lng double precision, p_type_ids integer[], p_radius integer, p_limit integer)`
   - `nearby_facility_stats(p_lat double precision, p_lng double precision, p_radius integer)`
   - `add_location(p_name varchar, p_address text, p_lat decimal, p_lng decimal, p_type_id integer, p_district_id integer, p_opening_hours varchar, p_link text, p_diaper boolean, p_note text, p_facilities jsonb)`

3. 為每個函數設定權限（允許 `anonymous` role 執行）

### 4. 設定權限

在 Hasura Console 中為每個資料表設定 `anonymous` role 的權限：

#### locations 表
- **select**: 允許所有欄位
- **insert**: 允許所有欄位（如果需要）
- **update**: 根據需求設定
- **delete**: 根據需求設定

#### 其他資料表
- **select**: 允許所有欄位（用於關聯查詢）

### 5. 使用 GraphQL Queries

#### 查詢最近的地點

```graphql
query {
  nearest_places(
    args: {
      p_lat: 25.0330
      p_lng: 121.5654
      p_type_id: 1
      p_radius: 5000
      p_limit: 20
    }
  ) {
    id
    name
    address
    latitude
    longitude
    distance
  }
}
```

#### 查詢範圍內的地點（使用關聯）

```graphql
query {
  locations(
    where: {
      latitude: { _gte: 25.0, _lte: 25.1 }
      longitude: { _gte: 121.5, _lte: 121.6 }
    }
  ) {
    id
    name
    address
    type {
      id
      name
    }
    district {
      id
      name
      city {
        id
        name
      }
    }
    facilities {
      id
      equipmentName
      imageUrl
    }
  }
}
```

#### 新增地點

```graphql
mutation {
  add_location(
    args: {
      p_name: "測試地點"
      p_address: "臺北市信義區信義路五段7號"
      p_lat: 25.0330
      p_lng: 121.5654
      p_type_id: 1
      p_diaper: true
    }
  ) {
    id
    name
    success
    message
  }
}
```

## 開發

### 常用指令

```bash
# 啟動開發環境（Docker）
docker-compose up -d

# 本地開發
npm run dev --workspace=frontend

# 建置專案
npm run build --workspace=frontend

# 執行 Lint
npm run lint

# 執行 Type Check
npm run typecheck

# 匯入資料
export DATABASE_URL="postgresql://..."
python3 scripts/seed-pg.py  # 或 npm run seed
```

### Docker 常用指令

```bash
# 查看日誌
docker-compose logs -f

# 停止服務
docker-compose stop

# 停止並移除容器
docker-compose down

# 停止並移除容器與 volumes（清除資料）
docker-compose down -v

# 重建服務
docker-compose build frontend
docker-compose up -d --build frontend

# 進入容器
docker-compose exec postgres psql -U postgres -d postgres
docker-compose exec frontend sh
```

## 部署到生產環境

### 前置需求

1. **Supabase 專案**
   - 建立新的 Supabase 專案
   - 取得資料庫連線字串
   - 確保已啟用 PostGIS 擴充功能

2. **Hasura Cloud 專案**
   - 建立 [Hasura Cloud](https://cloud.hasura.io) 專案
   - 連接 Supabase PostgreSQL 資料庫
   - 取得 Hasura GraphQL endpoint 和 admin secret

3. **Mapbox 帳號**
   - 建立 Mapbox 帳號
   - 取得 Access Token

4. **前端部署平台**（可選）
   - 可以使用任何支援靜態網站部署的平台
   - 例如：Netlify、Cloudflare Pages、GitHub Pages、或自己的伺服器

### 1. 部署 Hasura

Hasura Cloud 會自動處理部署和擴展。確保：
- 已連接 Supabase 資料庫
- 已執行所有 migrations
- 已設定適當的權限

#### 執行資料庫 Migrations

```bash
cd hasura
hasura migrate apply \
  --endpoint https://your-project.hasura.app \
  --admin-secret YOUR_ADMIN_SECRET \
  --database-name default
```

或在 Supabase SQL Editor 中執行 `hasura/migrations/` 目錄中的所有 SQL 檔案。

#### 設定 Hasura Cloud

參考上方的「Hasura 設定」章節完成設定。

### 2. 部署前端

#### 使用 Netlify

1. 連接 GitHub repository
2. 設定建置設定：
   - Build command: `cd frontend && npm install && npm run build`
   - Publish directory: `frontend/dist`
3. 設定環境變數：
   - `VITE_HASURA_GRAPHQL_URL`: Hasura GraphQL endpoint
   - `VITE_MAPBOX_TOKEN`: Mapbox Access Token

#### 使用 Cloudflare Pages

1. 連接 GitHub repository
2. 設定建置設定：
   - Build command: `cd frontend && npm install && npm run build`
   - Build output directory: `frontend/dist`
3. 設定環境變數

#### 使用 GitHub Pages

1. 在 GitHub Actions 中建立部署 workflow
2. 建置前端並部署到 `gh-pages` 分支

#### 使用 Docker

```bash
# 建置前端映像
cd frontend
docker build -t family-friendly-frontend .

# 運行容器
docker run -p 80:80 \
  -e VITE_HASURA_GRAPHQL_URL=https://your-project.hasura.app/v1/graphql \
  -e VITE_MAPBOX_TOKEN=your_token \
  family-friendly-frontend
```

### 3. 設定 GitHub Actions Secrets

在 GitHub Repository Settings > Secrets 設定：

- `HASURA_GRAPHQL_URL`: Hasura Cloud endpoint
- `HASURA_GRAPHQL_ADMIN_SECRET`: Hasura admin secret
- `VITE_HASURA_GRAPHQL_URL`: Hasura GraphQL endpoint（用於前端建置）
- `VITE_MAPBOX_TOKEN`: Mapbox Token（用於前端建置）

### 4. 資料匯入

#### 匯入所有資料

```bash
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"
python3 scripts/seed-pg.py  # 或 npm run seed
```

#### 個別匯入

修改 `scripts/seed-pg.py` 來選擇性匯入特定資料來源。

## 架構說明

此專案使用純 Hasura 架構，所有業務邏輯都在 PostgreSQL functions 中處理：

- **Frontend**: React + Vite + Mapbox
- **Backend**: Hasura GraphQL Engine（直接連接 PostgreSQL）
- **資料庫**: PostgreSQL + PostGIS (Supabase)
- **部署**:
  - Hasura Cloud (GraphQL API)
  - 任何靜態網站託管平台（前端）

**功能實作**:
- **查詢功能**: 使用 Hasura Custom Functions（追蹤 PostgreSQL functions）
- **新增地點**: 使用 `add_location` PostgreSQL function
- **關聯查詢**: Hasura 自動處理 relationships

**架構流程**:
```
Frontend → Hasura GraphQL → PostgreSQL Functions
```

優點：
- 更簡單的架構
- 更少的服務需要維護
- Hasura 自動處理關聯查詢
- 更好的效能（減少網路跳躍）

所有業務邏輯都在 PostgreSQL functions 中處理，不需要額外的 serverless functions。

## 主要功能

1. **地圖瀏覽**: 使用 Mapbox 顯示設施位置
2. **附近搜尋**: 根據位置和半徑搜尋附近設施
3. **範圍查詢**: 查詢指定範圍內的設施
4. **設施統計**: 顯示附近各類型設施的數量
5. **新增地點**: 支援新增新的設施地點（包含地址解析）

## 資料來源

- 全國依法設置哺集乳室名單
- 全國自願設置哺集乳室名單
- 全國公廁建檔資料
- 台北市國小遊戲場資料
- 新北市共融公園資料

## 疑難排解

### PostgreSQL 無法啟動（Docker）

```bash
# 檢查 logs
docker-compose logs postgres

# 清除 volume 並重新啟動
docker-compose down -v
docker-compose up -d
```

### Hasura 無法連線到資料庫

- 確認 PostgreSQL 已完全啟動（healthcheck 通過）
- 檢查 `HASURA_GRAPHQL_DATABASE_URL` 設定
- 確認資料庫連線字串正確

### Frontend 無法連線到 Hasura

- 確認 `VITE_HASURA_GRAPHQL_URL` 設定正確
- 檢查瀏覽器 console 是否有 CORS 錯誤
- 確認 Hasura 服務已啟動
- 檢查 Hasura CORS 設定

### PostGIS 擴充功能未啟用

在 Supabase SQL Editor 執行：

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### GraphQL API 無法連線

1. 確認 `VITE_HASURA_GRAPHQL_URL` 設定正確
2. 確認 Hasura Cloud 專案正常運行
3. 檢查 Hasura Console 中的設定
4. 確認 CORS 設定允許前端 domain

### Mapbox 地圖無法顯示

1. 確認 `VITE_MAPBOX_TOKEN` 設定正確
2. 確認 Mapbox Token 有正確的權限

### PostgreSQL Functions 無法使用

1. 確認已執行所有 migrations（包括 `003_add_location_function.sql`）
2. 在 Hasura Console 中追蹤 functions
3. 確認已設定適當的權限

### 修改程式碼後沒有更新（Docker）

- Frontend 使用 volume mounts，修改應該會自動重新載入
- 如果沒有，嘗試重啟服務：`docker-compose restart frontend`

## 資料庫 Migration

### 本地執行

```bash
cd hasura
hasura migrate create migration_name \
  --endpoint https://your-project.hasura.app \
  --admin-secret YOUR_ADMIN_SECRET \
  --database-name default
```

### 生產環境部署

```bash
cd hasura
hasura migrate apply \
  --endpoint https://your-project.hasura.app \
  --admin-secret YOUR_ADMIN_SECRET \
  --database-name default
```

或透過 GitHub Actions 自動部署（當 `hasura/migrations/` 目錄有變更時，見 `.github/workflows/deploy-hasura.yml`）。

## 授權

[您的授權資訊]
