# GitHub Actions Workflows

## CI/CD Pipeline (`ci.yml`)

自動執行於：
- Push 到 `main` 或 `develop` 分支
- 開啟 Pull Request 到 `main` 或 `develop` 分支

工作流程：
1. **Lint & Type Check**: 執行 ESLint 和 TypeScript 類型檢查
2. **Test Backend**: 在 Docker PostGIS 容器中測試後端
3. **Build**: 建置前端和後端
4. **Deploy**: 部署到 Vercel (僅限 main 分支)

## Database Migrations (`deploy-database.yml`)

自動執行於：
- Push 到 `main` 分支且 `prisma/` 目錄有變更

工作流程：
- 部署 Prisma migrations 到 Supabase 生產資料庫

## 需要的 Secrets

在 GitHub Repository Settings > Secrets 中設定：

- `VERCEL_TOKEN`: Vercel API Token
- `VERCEL_ORG_ID`: Vercel Organization ID
- `VERCEL_PROJECT_ID`: Vercel Project ID
- `DATABASE_URL`: Supabase 資料庫連線字串
- `VITE_GRAPHQL_URL`: GraphQL API URL (用於建置)
- `VITE_MAPBOX_TOKEN`: Mapbox Token (用於建置)
