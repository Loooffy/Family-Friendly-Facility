# Prisma Database Schema

## 設定

1. 複製 `.env.example` 為 `.env` 並填入你的資料庫連線字串
2. 確保 PostgreSQL 已安裝 PostGIS 擴充功能：

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## Migration

```bash
# 建立 migration
npx prisma migrate dev --name init

# 套用 migration
npx prisma migrate deploy

# 產生 Prisma Client
npx prisma generate
```

## 設施類型 (Facility Types)

預設的設施類型：

- `nursing_room` - 哺集乳室
- `family_toilet` - 親子廁所
- `playground` - 遊戲場/共融式遊戲場
- `family_friendly` - 親子友善地點
