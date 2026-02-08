#!/usr/bin/env python3
"""
使用 Google Geocoding API 為台北市公園遊戲場資料補齊地址
使用平行化處理以加速處理
"""
import json
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional
import requests
import time


# Google Geocoding API 端點
GEOCODE_API_URL = "https://maps.googleapis.com/maps/api/geocode/json"


def load_api_key() -> str:
    """
    從 .env 檔案載入 Google API key

    Returns:
        API key 字串
    """
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                # 支援多種格式：key=、API_KEY=、GOOGLE_API_KEY=
                if (
                    line.startswith("key=")
                    or line.startswith("API_KEY=")
                    or line.startswith("GOOGLE_API_KEY=")
                ):
                    return line.split("=", 1)[1].strip()

    # 如果 .env 檔案不存在，嘗試從環境變數讀取
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("API_KEY")
    if api_key:
        return api_key

    raise ValueError(
        "無法找到 Google API key，請確認 .env 檔案存在或設定 GOOGLE_API_KEY 環境變數"
    )


def reverse_geocode(latitude: float, longitude: float, api_key: str) -> Optional[str]:
    """
    使用 Google Geocoding API 將經緯度座標轉換為地址

    Args:
        latitude: 緯度
        longitude: 經度
        api_key: Google API key

    Returns:
        地址字串，如果失敗則返回 None
    """
    if latitude is None or longitude is None:
        return None

    try:
        # 準備 API 請求參數
        params = {
            "latlng": f"{latitude},{longitude}",
            "key": api_key,
            "language": "zh-TW",  # 使用繁體中文
            "region": "tw",  # 指定台灣地區
        }

        # 發送請求
        response = requests.get(GEOCODE_API_URL, params=params, timeout=10)
        response.raise_for_status()

        data = response.json()

        # 檢查 API 回應狀態
        if data.get("status") != "OK":
            error_msg = data.get("error_message", data.get("status", "Unknown error"))
            print(f"  ⚠ API 錯誤 ({latitude:.6f}, {longitude:.6f}): {error_msg}")
            return None

        # 檢查是否有結果
        results = data.get("results", [])
        if not results:
            return None

        # 取得第一個結果的格式化地址
        formatted_address = results[0].get("formatted_address")

        if formatted_address:
            return formatted_address

        return None

    except requests.exceptions.RequestException as e:
        print(f"  ⚠ API 請求錯誤 ({latitude:.6f}, {longitude:.6f}): {e}")
        return None
    except (KeyError, ValueError, TypeError) as e:
        print(f"  ⚠ 解析錯誤 ({latitude:.6f}, {longitude:.6f}): {e}")
        return None
    except Exception as e:
        print(f"  ⚠ 未知錯誤 ({latitude:.6f}, {longitude:.6f}): {e}")
        return None


def process_item(
    item: Dict, index: int, total: int, api_key: str
) -> tuple[int, Dict, Optional[str]]:
    """
    處理單一項目，獲取地址

    Args:
        item: 資料項目
        index: 項目索引
        total: 總項目數
        api_key: Google API key

    Returns:
        (index, item, address) 的 tuple
    """
    # 如果已經有地址，跳過
    if item.get("address"):
        return (index, item, None)

    # 檢查是否有經緯度
    latitude = item.get("latitude")
    longitude = item.get("longitude")

    if latitude is None or longitude is None:
        print(f"  [{index+1}/{total}] ✗ {item.get('name', '')[:30]}... -> 缺少經緯度座標")
        return (index, item, None)

    # 獲取地址
    address = reverse_geocode(latitude, longitude, api_key)

    if address:
        item["address"] = address
        print(f"  [{index+1}/{total}] ✓ {item.get('name', '')[:30]}... -> {address[:50]}...")
    else:
        print(f"  [{index+1}/{total}] ✗ {item.get('name', '')[:30]}... -> 無法取得地址")

    return (index, item, address)


def reverse_geocode_playgrounds(
    input_file: Path,
    api_key: str,
    max_workers: int = 10,
    batch_size: int = 100,
    save_interval: int = 50,
) -> None:
    """
    為公園遊戲場資料補齊地址

    Args:
        input_file: 輸入 JSON 檔案路徑
        api_key: Google API key
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

    # 找出需要處理的項目（缺少地址的）
    items_to_process = [
        (i, item)
        for i, item in enumerate(items)
        if not item.get("address")
        and item.get("latitude") is not None
        and item.get("longitude") is not None
    ]

    missing_count = len(items_to_process)
    print(f"\n總項目數：{total_count}")
    print(f"缺少地址的項目：{missing_count}")

    if missing_count == 0:
        print("✓ 所有項目都已有地址，無需處理")
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
                executor.submit(process_item, item, index, missing_count, api_key): (
                    index,
                    item,
                )
                for index, item in items_to_process
            }

            # 處理完成的任務
            for future in as_completed(future_to_item):
                index, updated_item, address = future.result()
                processed_count += 1

                # 更新原始資料
                items[index] = updated_item
                updated_items[index] = updated_item

                if address:
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

                # 避免 API 請求過於頻繁（Google API 有速率限制）
                time.sleep(0.1)  # 每個請求間隔 0.1 秒

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
    print(f"  成功取得地址：{success_count}")
    print(f"  失敗項目數：{processed_count - success_count}")
    if elapsed_time > 0:
        print(f"  平均速率：{processed_count/elapsed_time:.1f} 項/秒")

    # 更新 total_count（以防有變動）
    data["total_count"] = len(items)

    # 最終儲存
    print(f"\n儲存更新後的檔案：{input_file}")
    with open(input_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("✓ 檔案已儲存")


if __name__ == "__main__":
    # 載入 API key
    try:
        api_key = load_api_key()
    except ValueError as e:
        print(f"錯誤：{e}")
        exit(1)

    # 設定檔案路徑
    base_dir = Path(__file__).parent
    input_file = base_dir / "cleaned_data" / "台北市公園遊戲場.json"

    # 執行反向地理編碼
    # max_workers: 平行處理的執行緒數（建議 5-10，避免超過 Google API 速率限制）
    # 注意：Google Geocoding API 有每分鐘請求數限制，建議不要設定過高的 max_workers
    reverse_geocode_playgrounds(
        input_file=input_file,
        api_key=api_key,
        max_workers=5,  # 降低執行緒數以避免超過 API 限制
        batch_size=50,
        save_interval=50,
    )
