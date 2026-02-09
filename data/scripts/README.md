# 資料處理腳本

此目錄包含所有資料處理和解析腳本，已從 `scripts/utils/` 遷移並轉換為 Python。

## 模組說明

### parse_address.py
地址解析工具，包含：
- `parse_city_and_district()` - 從地址中解析都市和區域
- `normalize_city_name()` - 標準化都市名稱
- `normalize_district_name()` - 標準化區域名稱

### parse_nursing_rooms.py
解析哺集乳室 CSV 資料
- `parse_nursing_rooms_data()` - 解析 CSV 檔案

### parse_playgrounds.py
解析遊戲場資料（CSV 和 JSON）
- `parse_playgrounds_csv()` - 解析 CSV 檔案
- `parse_taipei_playgrounds_json()` - 解析台北市遊戲場 JSON
- `twd97_to_wgs84()` - TWD97 座標轉換為 WGS84

### parse_toilets.py
解析親子廁所 JSON 資料
- `parse_toilets_data()` - 解析 JSON 檔案

### scrape_new_taipei_parks.py
爬取新北市共融特色公園資料
- `parse_new_taipei_parks_html()` - 從 HTML 檔案解析
- `parse_new_taipei_parks_csv()` - 從 CSV 檔案解析
- `parse_park_detail_page()` - 解析詳細公園頁面
- `save_to_csv()` - 儲存為 CSV

### process_pdf_playgrounds.py
PDF 處理工具
- `extract_facilities_from_pdf_text()` - 從 PDF 文字提取設施資訊
- `extract_images_from_pdf()` - 從 PDF 提取圖片
- `process_pdf_file()` - 處理單個 PDF 檔案

## 使用方式

### 安裝依賴

```bash
cd data
uv sync
# 或
pip install -r requirements.txt
```

### 在 Python 中使用

```python
from scripts.parse_nursing_rooms import parse_nursing_rooms_data
from scripts.parse_playgrounds import parse_playgrounds_csv
from scripts.parse_toilets import parse_toilets_data

# 解析資料
places = parse_nursing_rooms_data('path/to/file.csv', '依法設置')
```

### 從 TypeScript/Node.js 調用

如果需要從 TypeScript 腳本調用這些 Python 模組，可以使用子進程：

```typescript
import { execSync } from 'child_process';

const result = execSync('python3 -c "from scripts.parse_nursing_rooms import parse_nursing_rooms_data; ..."', {
  cwd: 'data',
  encoding: 'utf-8'
});
```

## 遷移說明

所有原本在 `scripts/utils/` 的 TypeScript 模組已轉換為 Python 並移至 `data/scripts/`：

- `parseAddress.ts` → `parse_address.py`
- `parseNursingRooms.ts` → `parse_nursing_rooms.py`
- `parsePlaygrounds.ts` → `parse_playgrounds.py`
- `parseToilets.ts` → `parse_toilets.py`
- `scrapeNewTaipeiParks.ts` → `scrape_new_taipei_parks.py`
- `processPDFPlaygrounds.ts` → `process_pdf_playgrounds.py`

## 依賴

見 `pyproject.toml`：
- `beautifulsoup4` - HTML 解析
- `lxml` - XML/HTML 處理
- `requests` - HTTP 請求
- `pdfplumber` / `PyPDF2` - PDF 處理
- `psycopg2-binary` - PostgreSQL 連接
