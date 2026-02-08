# 育兒友善設施地圖 App

提供使用者快速找到附近的親子設施，包括哺乳室、親子廁所、遊戲場、親子友善地點等。

## 專案結構

```
.
├── frontend/          # React + Mapbox 前端
├── backend/           # GraphQL API + Vercel Functions
├── prisma/            # Database Schema
├── scripts/           # 資料匯入腳本
└── data/              # 原始資料檔案
```

## 技術棧

- **前端**: React + Mapbox GL JS
- **後端**: Node.js + TypeScript + GraphQL (Apollo Server)
- **資料庫**: PostgreSQL + PostGIS (Supabase)
- **部署**: Vercel (Frontend + Backend Functions)

## 開發

```bash
# 安裝依賴
npm install

# 啟動開發環境
npm run dev

# 建置專案
npm run build

# 執行 Lint
npm run lint

# 執行 Type Check
npm run typecheck

# 匯入資料
npm run seed
```

## 環境變數設定

請參考各子專案的 README 檔案設定環境變數。
