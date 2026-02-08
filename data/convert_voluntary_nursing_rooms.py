#!/usr/bin/env python3
"""
將全國自願設置哺集乳室 CSV 轉換為 JSON 格式
過濾掉營業時間或注意事項中包含「員工」關鍵字的資料
"""
import csv
import json
from pathlib import Path


def build_address(row):
    """組合地址欄位"""
    parts = []
    if row.get("縣市"):
        parts.append(row["縣市"])
    if row.get("鄉/鎮/市/區"):
        parts.append(row["鄉/鎮/市/區"])
    if row.get("村/里"):
        parts.append(row["村/里"])
    if row.get("大道/路/街/地區"):
        parts.append(row["大道/路/街/地區"])
    if row.get("段"):
        parts.append(f"{row['段']}段")
    if row.get("巷/弄/衖"):
        parts.append(row["巷/弄/衖"])
    if row.get("號"):
        # CSV 中的「號」欄位已經包含「號」字，直接使用
        parts.append(row["號"])
    if row.get("樓（之~）"):
        parts.append(row["樓（之~）"])

    return "".join(parts)


def convert_csv_to_json(csv_path, output_path):
    """將 CSV 轉換為 JSON，過濾掉營業時間或注意事項中包含「員工」的資料"""
    data_list = []
    filtered_count = 0

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        # 使用 utf-8-sig 自動處理 BOM
        # 直接使用 DictReader 讓它自動處理多行欄位（用引號包起來的欄位）
        reader = csv.DictReader(f)

        for row in reader:
            # 跳過空行或沒有場所名稱的資料
            if not row.get("場所名稱") or not row["場所名稱"].strip():
                continue

            # 檢查營業時間或注意事項是否包含「員工」關鍵字
            opening_hours = row.get("開放時間", "")
            note = row.get("注意事項", "")

            if (opening_hours and "員工" in opening_hours) or (note and "員工" in note):
                filtered_count += 1
                continue

            # 組合地址
            address = build_address(row)

            # 建立資料物件
            item = {
                "name": row["場所名稱"].strip(),
                "address": address,
                "latitude": None,  # CSV 沒有經緯度資料
                "longitude": None,  # CSV 沒有經緯度資料
                "type": "哺集乳室",
                "city": row.get("縣市", "").strip() if row.get("縣市") else "",
                "district": (
                    row.get("鄉/鎮/市/區", "").strip() if row.get("鄉/鎮/市/區") else ""
                ),
                "opening_hours": (
                    opening_hours.strip() if opening_hours and opening_hours.strip() else None
                ),
                "note": (
                    row.get("注意事項", "").strip()
                    if row.get("注意事項") and row.get("注意事項").strip()
                    else None
                ),
            }

            data_list.append(item)

    # 建立最終 JSON 結構
    result = {"total_count": len(data_list), "data": data_list}

    # 寫入 JSON 檔案
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"✓ 成功轉換 {len(data_list)} 筆資料")
    print(f"✓ 過濾掉 {filtered_count} 筆營業時間或注意事項中包含「員工」關鍵字的資料")
    print(f"✓ 輸出檔案：{output_path}")


if __name__ == "__main__":
    # 設定路徑
    base_dir = Path(__file__).parent
    csv_path = base_dir / "source_data" / "全國自願設置哺集乳室名單(截至115年1月).csv"
    output_path = base_dir / "cleaned_data" / "全國自願設置哺集乳室.json"

    # 確保輸出目錄存在
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # 執行轉換
    convert_csv_to_json(csv_path, output_path)
