# 安裝 PostGIS 擴充功能

## 問題
Prisma migration 需要 PostGIS 擴充功能，但資料庫中尚未安裝。

## 解決方案

### 方法 1: 使用 Docker（推薦）

如果您使用 Docker 運行 PostgreSQL，請使用 PostGIS 映像：

```bash
docker run --name postgres-postgis \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=family_friendly_facilities \
  -p 5432:5432 \
  -d postgis/postgis:15-3.4
```

### 方法 2: 在現有 PostgreSQL 中安裝 PostGIS

#### Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install postgresql-postgis
```

然後連接到資料庫並建立擴充功能：
```bash
psql -U postgres -d family_friendly_facilities -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

#### macOS (使用 Homebrew):
```bash
brew install postgis
```

然後連接到資料庫：
```bash
psql -U postgres -d family_friendly_facilities -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

#### Windows:
1. 下載並安裝 PostGIS for Windows: https://postgis.net/windows_downloads/
2. 連接到資料庫並執行：
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 方法 3: 使用 Supabase 或其他雲端資料庫

如果使用 Supabase，PostGIS 已經預先安裝。只需確保連線字串正確即可。

## 驗證安裝

安裝後，可以驗證 PostGIS 是否已安裝：

```sql
SELECT PostGIS_version();
```

## 執行 Migration

安裝 PostGIS 後，執行：

```bash
cd /home/loooffy/Wsl_Projects/Family-Friendly-Facilities
npx prisma migrate deploy
```

或使用開發模式：

```bash
npx prisma migrate dev
```
