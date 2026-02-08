# 專案狀態

## ✅ 已完成項目

### 1. 專案結構
- [x] Mono-repo 結構設定 (npm workspaces)
- [x] 根目錄 package.json 與 scripts
- [x] .gitignore 設定
- [x] README 文件

### 2. 資料庫 (Prisma + PostgreSQL + PostGIS)
- [x] Prisma schema 定義
- [x] PostGIS 支援 (透過 raw SQL queries)
- [x] Migration 檔案
- [x] 資料表結構：
  - `places` - 地點表
  - `facility_types` - 設施類型表
  - `place_facilities` - 地點與設施關聯表

### 3. 後端 (GraphQL API)
- [x] GraphQL Schema 定義
- [x] Apollo Server 設定
- [x] Resolvers 實作：
  - `nearestPlaces` - 查詢最近的設施
  - `placesInBounds` - 查詢地圖範圍內的設施
  - `nearestPlacesByFacilities` - 多設施類型查詢
  - `place` - 單一地點詳細資訊
  - `nearbyFacilityStats` - 附近設施統計
  - `facilityTypes` - 所有設施類型
  - `addPlace` - 新增地點 (使用者回報)
- [x] PostGIS 空間查詢整合
- [x] Vercel Serverless Function 設定
- [ ] 確保 schema 與現有資料的對應正確 2026/1/28 TODO

### 4. 前端 (React + Mapbox)
- [x] React + Vite 專案設定
- [x] Apollo Client 設定
- [x] Mapbox GL JS 整合
- [x] 地圖組件 (`Map.tsx`)
- [x] 設施篩選器 (`FacilityFilter.tsx`)
- [x] 地點彈出視窗 (`PlacePopup.tsx`)
- [x] 新增地點表單 (`AddPlaceForm.tsx`)
- [x] GraphQL Queries 定義

### 5. 資料匯入腳本
- [x] 解析 `全國公廁建檔資料.json` (親子廁所)
- [x] 解析 `全國依法設置哺集乳室名單.csv`
- [x] 解析 `全國自願設置哺集乳室名單.csv`
- [x] 解析 `台北市共融式遊戲場.csv`
- [x] 解析 `台北市兒童遊戲場.json`
- [x] 解析 `新北市共融_特色公園.html` (基礎解析器)
- [x] 統一的資料匯入腳本 (`seed.ts`)

### 6. CI/CD
- [x] GitHub Actions CI 工作流程
- [x] Lint & Type Check
- [x] Backend 測試 (PostGIS Docker)
- [x] Build 流程
- [x] Vercel 自動部署
- [x] 資料庫 Migration 自動部署

## 🔄 待改進項目

### 1. 功能增強
- [ ] Marker Clustering 完整實作 (目前有基礎架構)
- [ ] 使用者認證 (Supabase Auth)
- [ ] 地點回報審核流程
- [ ] 地點評分/評論功能
- [ ] 路線規劃功能
- [ ] 離線地圖支援

### 2. 資料處理
- [ ] 哺集乳室地址 Geocoding (目前缺少座標的項目)
- [x] 新北市公園資料完整爬蟲實作
- [ ] 資料驗證與清理 2026/1/28 TODO
- [ ] 定期資料更新機制

### 3. 效能優化
- [ ] GraphQL Query 快取
- [ ] 地圖視窗查詢防抖 (Debounce)
- [ ] 圖片優化與 CDN
- [ ] Edge Function 快取

### 4. 測試
- [ ] Backend Unit Tests
- [ ] Frontend Component Tests
- [ ] E2E Tests (Cypress/Playwright)
- [ ] GraphQL API Tests

### 5. 文件
- [ ] API 文件 (GraphQL Schema 文件)
- [ ] 使用者指南
- [ ] 開發者貢獻指南

## 📝 使用說明

### 本地開發

1. **安裝依賴**
   ```bash
   npm install
   ```

2. **設定環境變數**
   - 複製 `backend/.env.example` 為 `backend/.env`
   - 複製 `frontend/.env.example` 為 `frontend/.env`
   - 填入資料庫連線字串和 Mapbox Token

3. **設定資料庫**
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate deploy
   npm run seed
   ```

4. **啟動開發伺服器**
   ```bash
   npm run dev
   ```

### 部署

請參考 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🐛 已知問題

1. **哺集乳室座標缺失**: 大部分哺集乳室資料缺少座標，需要 Geocoding 服務
2. **新北市公園解析**: HTML 解析器需要根據實際 HTML 結構調整
3. **Marker Clustering**: 目前使用 Supercluster，但尚未完整整合到地圖顯示

## 📚 技術文件

- [部署指南](./DEPLOYMENT.md)
- [Prisma Schema](./prisma/README.md)
- [Backend API](./backend/README.md)
- [Frontend](./frontend/README.md)
- [CI/CD](./.github/workflows/README.md)
