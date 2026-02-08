#!/bin/bash

# 設定 PostGIS Docker 容器的腳本
# 這個腳本會幫助您從標準 PostgreSQL 遷移到 PostGIS 容器

set -e

CONTAINER_NAME="family-friendly-postgres"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="password"
POSTGRES_DB="family_friendly_facilities"
PORT="5432"

echo "🚀 設定 PostGIS Docker 容器..."

# 檢查是否已有同名容器在運行
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "⚠️  發現現有容器: ${CONTAINER_NAME}"
    read -p "是否要停止並刪除現有容器？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "停止並刪除現有容器..."
        docker stop ${CONTAINER_NAME} 2>/dev/null || true
        docker rm ${CONTAINER_NAME} 2>/dev/null || true
    else
        echo "❌ 取消操作"
        exit 1
    fi
fi

# 啟動 PostGIS 容器
echo "📦 啟動 PostGIS 容器..."
docker run -d \
  --name ${CONTAINER_NAME} \
  -e POSTGRES_USER=${POSTGRES_USER} \
  -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD} \
  -e POSTGRES_DB=${POSTGRES_DB} \
  -p ${PORT}:5432 \
  -v family-friendly-postgres-data:/var/lib/postgresql/data \
  postgis/postgis:15-3.4

echo "⏳ 等待 PostgreSQL 啟動..."
sleep 5

# 等待 PostgreSQL 準備就緒
until docker exec ${CONTAINER_NAME} pg_isready -U ${POSTGRES_USER} > /dev/null 2>&1; do
    echo "等待 PostgreSQL 準備就緒..."
    sleep 2
done

echo "✅ PostGIS 容器已啟動！"
echo ""
echo "📋 容器資訊："
echo "   容器名稱: ${CONTAINER_NAME}"
echo "   資料庫: ${POSTGRES_DB}"
echo "   用戶: ${POSTGRES_USER}"
echo "   密碼: ${POSTGRES_PASSWORD}"
echo "   連接埠: ${PORT}"
echo ""
echo "🔗 連線字串："
echo "   postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${PORT}/${POSTGRES_DB}?schema=public"
echo ""
echo "📝 下一步："
echo "   1. 確認 prisma/.env 中的 DATABASE_URL 設定正確"
echo "   2. 執行: npx prisma migrate deploy"
echo "   或執行: npx prisma migrate dev"
