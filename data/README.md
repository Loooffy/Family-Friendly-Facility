# 資料解析腳本

這個目錄包含資料解析腳本，用於檢查 parse 之後的欄位是否正確。

## 目錄結構

- **TypeScript 腳本**：`parse-sample.ts` - 用於解析樣本資料
- **Python 腳本**：使用 `uv` 管理依賴
  - `scrape_taipei_playgrounds.py` - 從 HTML 提取台北市兒童遊戲場資料
  - `merge_taipei_playgrounds.py` - 合併 HTML 和 JSON 資料

## Python 腳本管理（使用 UV）

此目錄使用 [uv](https://github.com/astral-sh/uv) 來管理 Python 依賴。詳細說明請參考 [README_UV.md](./README_UV.md)。

### 快速開始

```bash
# 安裝依賴
uv sync --no-install-project

# 執行腳本
uv run scrape_taipei_playgrounds.py
uv run merge_taipei_playgrounds.py

# 或使用 Makefile
make install
make run-scrape
make run-merge
```

## 使用方法

### 前置需求

**重要：請先安裝依賴**

```bash
# 從專案根目錄執行
npm install

# 安裝專案依賴（包含 scripts 需要的依賴）
npm install
```

### 方法 1: 使用 npm 腳本（推薦）

從專案根目錄執行：

```bash
npm run parse-sample
```

### 方法 2: 使用 shell 腳本

從 data 目錄執行：

```bash
cd data
./parse-sample.sh
```

### 方法 3: 直接執行 TypeScript 腳本

從專案根目錄執行：

```bash
npm install  # 如果還沒安裝依賴
tsx data/parse-sample.ts
```

## 輸出

解析後的樣本資料會輸出到 `parsed_data/` 目錄下，每個資料來源會產生一個 JSON 檔案：

- `taipei-inclusive-playgrounds-sample.json` - 共融式遊戲場 (CSV) 樣本
- `taipei-playgrounds-sample.json` - 台北市兒童遊戲場 (JSON) 樣本
- `new-taipei-parks-sample.json` - 新北市共融特色公園 (HTML) 樣本
- `toilets-sample.json` - 親子廁所 (JSON) 樣本
- `nursing-rooms-mandatory-sample.json` - 哺集乳室-依法設置 (CSV) 樣本
- `nursing-rooms-voluntary-sample.json` - 哺集乳室-自願設置 (CSV) 樣本

每個 JSON 檔案包含：
- `description`: 資料來源說明
- `totalCount`: 總資料筆數
- `sampleSize`: 樣本筆數（預設 5 筆）
- `sample`: 樣本資料陣列

## 檢查欄位

每個樣本資料包含以下欄位：
- `name`: 場所名稱
- `address`: 地址（已移除城市和區域）
- `city`: 城市（從地址解析）
- `district`: 區域（從地址解析）
- `latitude`: 緯度
- `longitude`: 經度
- `metadata`: 其他元資料（包含原始地址 `originalAddress`）
- `source`: 資料來源
- `sourceId`: 資料來源 ID
