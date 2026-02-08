# 部署指南

## 前置需求

1. **Supabase 專案**
   - 建立新的 Supabase 專案
   - 取得資料庫連線字串
   - 確保已啟用 PostGIS 擴充功能

2. **Vercel 帳號**
   - 建立 Vercel 帳號
   - 安裝 Vercel CLI: `npm i -g vercel`

3. **Mapbox 帳號**
   - 建立 Mapbox 帳號
   - 取得 Access Token

## 本地開發設定

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

**Backend** (`backend/.env`):
```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"
PORT=4000
```

**Frontend** (`frontend/.env`):
```env
VITE_GRAPHQL_URL=http://localhost:4000/graphql
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

### 3. 設定資料庫

```bash
# 產生 Prisma Client
cd backend
npx prisma generate

# 執行 Migration
npx prisma migrate deploy

# 匯入資料
npm run seed
```

### 4. 啟動開發伺服器

```bash
# 從專案根目錄
npm run dev
```

- Frontend: http://localhost:3000
- Backend GraphQL: http://localhost:4000/graphql

## 部署到 Vercel

### 1. 連結 Vercel 專案

```bash
# 從專案根目錄
vercel
```

### 2. 設定環境變數

在 Vercel Dashboard > Settings > Environment Variables 設定：

**Backend:**
- `DATABASE_URL`: Supabase 資料庫連線字串

**Frontend:**
- `VITE_GRAPHQL_URL`: 你的 GraphQL API URL (例如: `https://your-app.vercel.app/graphql`)
- `VITE_MAPBOX_TOKEN`: Mapbox Access Token

### 3. 設定 Vercel 專案結構

Vercel 會自動偵測 `frontend/` 和 `backend/` 目錄。如果需要手動設定：

**Frontend Project:**
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

**Backend Project:**
- Root Directory: `backend`
- Build Command: `npm run build`
- Output Directory: `dist`

### 4. 設定 GitHub Actions Secrets

在 GitHub Repository Settings > Secrets 設定：

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `DATABASE_URL`
- `VITE_GRAPHQL_URL`
- `VITE_MAPBOX_TOKEN`

## 資料庫 Migration

### 本地執行

```bash
cd backend
npx prisma migrate dev --name migration_name
```

### 生產環境部署

```bash
cd backend
npx prisma migrate deploy
```

或透過 GitHub Actions 自動部署（當 `prisma/` 目錄有變更時）。

## 資料匯入

### 匯入所有資料

```bash
npm run seed --workspace=backend
```

### 個別匯入

修改 `backend/scripts/seed.ts` 來選擇性匯入特定資料來源。

## 疑難排解

### PostGIS 擴充功能未啟用

在 Supabase SQL Editor 執行：

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### GraphQL API 無法連線

1. 確認 `VITE_GRAPHQL_URL` 設定正確
2. 確認 Vercel Function 已正確部署
3. 檢查 Vercel Function Logs

### Mapbox 地圖無法顯示

1. 確認 `VITE_MAPBOX_TOKEN` 設定正確
2. 確認 Mapbox Token 有正確的權限
