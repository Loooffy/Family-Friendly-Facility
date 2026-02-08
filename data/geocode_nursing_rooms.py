#!/usr/bin/env python3
"""
使用 ArcGIS Geocoding API 為全國哺集乳室資料補齊經緯度座標
使用平行化處理以加速處理
"""
import json
import urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple
import requests
import time


# ArcGIS Geocoding API 端點
GEOCODE_API_URL = (
    "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"
)


def geocode_address(address: str) -> Optional[Tuple[float, float]]:
    """
    使用 ArcGIS API 將地址轉換為經緯度座標

    Args:
        address: 地址字串

    Returns:
        包含 (longitude, latitude) 的 tuple，如果失敗則返回 None
    """
    if not address or not address.strip():
        return None

    try:
        # 準備 API 請求參數
        params = {
            "SingleLine": address,
            "f": "json",
            "outSR": '{"wkid":4326}',
            "outFields": "Addr_type,Match_addr,StAddr,City",
            "maxLocations": 6,
        }

        # 發送請求
        response = requests.get(GEOCODE_API_URL, params=params, timeout=10)
        response.raise_for_status()

        data = response.json()

        # 檢查是否有候選結果
        if "candidates" not in data or not data["candidates"]:
            return None

        # 找出分數最高的候選項目
        best_candidate = max(data["candidates"], key=lambda x: x.get("score", 0))

        # 提取經緯度（注意：ArcGIS 使用 x=longitude, y=latitude）
        location = best_candidate.get("location", {})
        longitude = location.get("x")
        latitude = location.get("y")

        if longitude is not None and latitude is not None:
            return (longitude, latitude)

        return None

    except requests.exceptions.RequestException as e:
        print(f"  ⚠ API 請求錯誤 ({address[:30]}...): {e}")
        return None
    except (KeyError, ValueError, TypeError) as e:
        print(f"  ⚠ 解析錯誤 ({address[:30]}...): {e}")
        return None
    except Exception as e:
        print(f"  ⚠ 未知錯誤 ({address[:30]}...): {e}")
        return None


def process_item(
    item: Dict, index: int, total: int
) -> Tuple[int, Dict, Optional[Tuple[float, float]]]:
    """
    處理單一項目，獲取經緯度

    Args:
        item: 資料項目
        index: 項目索引
        total: 總項目數

    Returns:
        (index, item, coordinates) 的 tuple
    """
    address = item.get("address", "")

    # 如果已經有經緯度，跳過
    if item.get("latitude") is not None and item.get("longitude") is not None:
        return (index, item, None)

    # 獲取經緯度
    coordinates = geocode_address(address)

    if coordinates:
        longitude, latitude = coordinates
        item["longitude"] = longitude
        item["latitude"] = latitude
        print(
            f"  [{index+1}/{total}] ✓ {item.get('name', '')[:30]}... -> ({latitude:.6f}, {longitude:.6f})"
        )
    else:
        print(f"  [{index+1}/{total}] ✗ {item.get('name', '')[:30]}... -> 無法取得座標")

    return (index, item, coordinates)


def geocode_nursing_rooms(
    input_file: Path, max_workers: int = 10, batch_size: int = 100, save_interval: int = 50
) -> None:
    """
    為哺集乳室資料補齊經緯度座標

    Args:
        input_file: 輸入 JSON 檔案路徑
        max_workers: 平行處理的最大執行緒數
        batch_size: 每批處理的項目數（用於進度顯示）
        save_interval: 每處理多少項目就自動儲存一次（避免中斷遺失進度）
    """
    print(f"讀取檔案：{input_file}")

    # 讀取 JSON 檔案
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    items = data.get("data", [])
    total_count = len(items)

    # 找出需要處理的項目（缺少經緯度的）
    items_to_process = [
        (i, item)
        for i, item in enumerate(items)
        if item.get("latitude") is None or item.get("longitude") is None
    ]

    missing_count = len(items_to_process)
    print(f"\n總項目數：{total_count}")
    print(f"缺少經緯度的項目：{missing_count}")

    if missing_count == 0:
        print("✓ 所有項目都已有經緯度座標，無需處理")
        return

    print(f"\n開始使用 {max_workers} 個執行緒進行平行處理...")
    print(f"每處理 {save_interval} 個項目會自動儲存一次，避免中斷遺失進度")
    print("-" * 80)

    # 使用 ThreadPoolExecutor 進行平行處理
    start_time = time.time()
    processed_count = 0
    success_count = 0
    last_save_count = 0

    # 建立結果字典來追蹤已更新的項目
    updated_items = {}

    try:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # 提交所有任務
            future_to_item = {
                executor.submit(process_item, item, index, missing_count): (index, item)
                for index, item in items_to_process
            }

            # 處理完成的任務
            for future in as_completed(future_to_item):
                index, updated_item, coordinates = future.result()
                processed_count += 1

                # 更新原始資料
                items[index] = updated_item
                updated_items[index] = updated_item

                if coordinates:
                    success_count += 1

                # 定期儲存進度
                if processed_count - last_save_count >= save_interval:
                    data["total_count"] = len(items)
                    with open(input_file, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    last_save_count = processed_count
                    print(f"\n💾 已自動儲存進度（{processed_count}/{missing_count}）\n")

                # 每處理 batch_size 個項目就顯示進度
                if processed_count % batch_size == 0:
                    elapsed = time.time() - start_time
                    rate = processed_count / elapsed if elapsed > 0 else 0
                    remaining = (missing_count - processed_count) / rate if rate > 0 else 0
                    print(
                        f"\n進度：{processed_count}/{missing_count} ({processed_count*100//missing_count}%) | "
                        f"成功：{success_count} | 速率：{rate:.1f} 項/秒 | "
                        f"預估剩餘時間：{remaining:.0f} 秒\n"
                    )

    except KeyboardInterrupt:
        print("\n\n⚠ 處理被中斷，正在儲存已處理的結果...")
        data["total_count"] = len(items)
        with open(input_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✓ 已儲存 {processed_count} 筆已處理的結果")
        print("您可以重新執行腳本繼續處理剩餘項目")
        return

    elapsed_time = time.time() - start_time

    print("-" * 80)
    print(f"\n處理完成！")
    print(f"  總處理時間：{elapsed_time:.1f} 秒")
    print(f"  處理項目數：{processed_count}")
    print(f"  成功取得座標：{success_count}")
    print(f"  失敗項目數：{processed_count - success_count}")
    print(f"  平均速率：{processed_count/elapsed_time:.1f} 項/秒")

    # 更新 total_count（以防有變動）
    data["total_count"] = len(items)

    # 最終儲存
    print(f"\n儲存更新後的檔案：{input_file}")
    with open(input_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("✓ 檔案已儲存")


if __name__ == "__main__":
    # 設定檔案路徑
    base_dir = Path(__file__).parent
    input_file = base_dir / "cleaned_data" / "全國哺集乳室.json"

    # 執行 geocoding
    # max_workers: 平行處理的執行緒數（建議 10-20，避免過度請求 API）
    geocode_nursing_rooms(input_file=input_file, max_workers=10, batch_size=50)
