#!/usr/bin/env python3
"""
整合全國依法設置和自願設置哺集乳室 JSON 檔案
並加上 type 欄位區分來源
"""
import json
from pathlib import Path


def merge_nursing_rooms():
    """整合兩個哺集乳室 JSON 檔案"""
    base_dir = Path(__file__).parent
    cleaned_dir = base_dir / "cleaned_data"

    # 讀取依法設置的資料
    mandatory_path = cleaned_dir / "全國依法設置哺集乳室.json"
    with open(mandatory_path, "r", encoding="utf-8") as f:
        mandatory_data = json.load(f)

    # 讀取自願設置的資料
    voluntary_path = cleaned_dir / "全國自願設置哺集乳室.json"
    with open(voluntary_path, "r", encoding="utf-8") as f:
        voluntary_data = json.load(f)

    # 更新依法設置資料的 type
    for item in mandatory_data["data"]:
        item["type"] = "依法設置哺集乳室"

    # 更新自願設置資料的 type
    for item in voluntary_data["data"]:
        item["type"] = "自願設置哺集乳室"

    # 合併資料
    merged_data = mandatory_data["data"] + voluntary_data["data"]

    # 建立最終 JSON 結構
    result = {"total_count": len(merged_data), "data": merged_data}

    # 輸出檔案
    output_path = cleaned_dir / "全國哺集乳室.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"✓ 依法設置：{len(mandatory_data['data'])} 筆")
    print(f"✓ 自願設置：{len(voluntary_data['data'])} 筆")
    print(f"✓ 合計：{len(merged_data)} 筆")
    print(f"✓ 輸出檔案：{output_path}")


if __name__ == "__main__":
    merge_nursing_rooms()
