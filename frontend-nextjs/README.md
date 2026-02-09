# Frontend - React + Mapbox

## 設定

1. 複製 `.env.example` 為 `.env` 並填入：
   - `VITE_GRAPHQL_URL`: GraphQL API 網址
   - `VITE_MAPBOX_TOKEN`: Mapbox Access Token (從 [mapbox.com](https://mapbox.com) 取得)

2. 安裝依賴：`npm install`

## 開發

```bash
npm run dev
```

應用程式會在 `http://localhost:3000` 啟動。

## 建置

```bash
npm run build
```

建置檔案會輸出到 `dist/` 目錄。
