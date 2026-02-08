# Backend - GraphQL API

## 設定

1. 複製 `.env.example` 為 `.env` 並填入資料庫連線字串
2. 安裝依賴：`npm install`
3. 產生 Prisma Client：`npx prisma generate`
4. 執行 Migration：`npx prisma migrate deploy`

## 開發

```bash
npm run dev
```

GraphQL Playground 會在 `http://localhost:4000` 啟動。

## 部署到 Vercel

後端會部署為 Vercel Serverless Functions。請參考 `vercel.json` 設定。
