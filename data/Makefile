.PHONY: help install run-scrape run-scrape-web run-scrape-web-list run-merge clean

help:
	@echo "可用的命令："
	@echo "  make install              - 安裝依賴"
	@echo "  make run-scrape           - 從本地 HTML 檔案提取資料"
	@echo "  make run-scrape-web       - 從網頁平行爬取所有資料（包含圖片）"
	@echo "  make run-scrape-web-list  - 從網頁平行爬取清單資料（不包含圖片）"
	@echo "  make run-merge           - 執行資料合併腳本"
	@echo "  make clean               - 清理虛擬環境"

install:
	uv sync --no-install-project

run-scrape:
	uv run scrape_taipei_playgrounds.py --mode file

run-scrape-web:
	uv run scrape_taipei_playgrounds.py --mode web --max-workers 10

run-scrape-web-list:
	uv run scrape_taipei_playgrounds.py --mode web-list-only --max-workers 10

run-merge:
	uv run merge_taipei_playgrounds.py

clean:
	rm -rf .venv
	rm -rf __pycache__
	find . -type d -name __pycache__ -exec rm -r {} +
	find . -type f -name "*.pyc" -delete
