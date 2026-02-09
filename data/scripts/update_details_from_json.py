#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
從現有的 JSON 檔案讀取 URL，更新詳細頁面資料（包括經緯度）
"""

import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
import re
import time

# 將當前目錄加入路徑，以便導入 scrape_taipei_playgrounds
sys.path.insert(0, str(Path(__file__).parent))

from scrape_taipei_playgrounds import (
    BASE_URL,
    REQUEST_TIMEOUT,
    REQUEST_DELAY,
    MAX_WORKERS,
    extract_page_info_from_detail_html_content,
    fetch_html_from_url,
    get_valid_token_and_session,
)


def fetch_detail_page(
    sid: str, url: str, session: Optional[requests.Session] = None
) -> Optional[Dict]:
    """
    獲取並解析指定詳細頁面

    Args:
        sid: 遊戲場 ID
        url: 詳細頁面 URL（相對路徑）
        session: requests Session 物件（用於維持 cookies）

    Returns:
        包含圖片、經緯度等詳細資訊的字典
    """
    full_url = urljoin(BASE_URL, url)
    html_content = fetch_html_from_url(full_url, session)

    if not html_content:
        return None

    return extract_page_info_from_detail_html_content(html_content)


def update_details_from_json(
    json_path: str,
    max_workers: int = MAX_WORKERS,
    output_path: Optional[str] = None,
):
    """
    從現有的 JSON 檔案讀取 URL，更新詳細頁面資料

    Args:
        json_path: 輸入 JSON 檔案路徑
        max_workers: 最大並發數
        output_path: 輸出 JSON 檔案路徑（如果為 None，則覆蓋原檔案）
    """
    # 讀取 JSON 檔案
    print(f"正在讀取 {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"總共 {len(data['data'])} 個項目")

    # 獲取有效的 token 和 session
    token, session = get_valid_token_and_session()

    if not token or not session:
        print("錯誤：無法獲取有效的 token，請檢查網路連線或網站是否可訪問")
        return

    # 建立 id/sid 到項目的映射（支援 id 或 sid 欄位）
    def get_item_id(item):
        return item.get("id") or item.get("sid", "")

    id_to_item = {get_item_id(item): item for item in data["data"]}

    # 平行更新所有詳細頁面
    print(f"\n開始更新 {len(data['data'])} 個詳細頁面...")
    print(f"使用 {max_workers} 個執行緒")

    updated_count = 0
    with_coordinates_count = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 提交所有任務
        future_to_id = {
            executor.submit(
                fetch_detail_page, get_item_id(item), item["url"], session
            ): get_item_id(item)
            for item in data["data"]
        }

        # 收集結果
        completed = 0
        for future in as_completed(future_to_id):
            item_id = future_to_id[future]
            try:
                detail_info = future.result()
                if detail_info:
                    item = id_to_item[item_id]
                    updated = False

                    # 更新設施（設施欄位已包含圖片資訊，不需要單獨的圖片欄位）
                    if detail_info.get("設施"):
                        item["設施"] = detail_info["設施"]
                        updated = True

                    # 更新經緯度
                    if (
                        detail_info.get("緯度") is not None
                        and detail_info.get("經度") is not None
                    ):
                        item["緯度"] = detail_info["緯度"]
                        item["經度"] = detail_info["經度"]
                        updated = True
                        with_coordinates_count += 1

                    # 更新行政區和遊戲場類別（如果原本沒有）
                    if detail_info.get("行政區") and not item.get("行政區"):
                        item["行政區"] = detail_info["行政區"]
                        updated = True
                    if detail_info.get("遊戲場類別") and not item.get("遊戲場類別"):
                        item["遊戲場類別"] = detail_info["遊戲場類別"]
                        updated = True

                    if updated:
                        updated_count += 1
            except Exception as e:
                print(f"錯誤：處理 id={item_id} 時發生錯誤: {e}")

            completed += 1
            if completed % 50 == 0:
                print(f"進度: {completed}/{len(data['data'])} 個頁面完成")

    print(f"\n更新完成，共更新 {updated_count} 筆資料")
    print(f"  有經緯度: {with_coordinates_count}")

    # 移除所有項目中的圖片欄位（因為圖片資訊已經在設施欄位中）
    print("\n正在移除圖片欄位...")
    removed_count = 0
    for item in data["data"]:
        if "圖片" in item:
            del item["圖片"]
            removed_count += 1
    print(f"已移除 {removed_count} 個項目的圖片欄位")

    # 將 city 欄位改名為 district，並新增 city 欄位（值為 "台北市"）
    print("\n正在更新 city/district 欄位...")
    updated_city_count = 0
    for item in data["data"]:
        # 如果存在 city 欄位，將其改名為 district
        if "city" in item:
            item["district"] = item["city"]
            del item["city"]
            updated_city_count += 1
        # 如果存在 行政區 欄位（中文格式），也轉換為 district
        elif "行政區" in item:
            item["district"] = item["行政區"]
            del item["行政區"]
            updated_city_count += 1

        # 新增 city 欄位，值為 "台北市"
        item["city"] = "台北市"
    print(f"已更新 {updated_city_count} 個項目的 city/district 欄位")

    # 更新統計資訊
    with_facilities = sum(
        1 for item in data["data"] if item.get("設施") and len(item.get("設施", [])) > 0
    )
    with_category = sum(
        1 for item in data["data"] if item.get("遊戲場類別") or item.get("category")
    )
    with_district = sum(1 for item in data["data"] if item.get("district"))
    with_city = sum(1 for item in data["data"] if item.get("city"))
    with_coordinates = sum(
        1
        for item in data["data"]
        if item.get("緯度") is not None
        and item.get("經度") is not None
        or (item.get("latitude") is not None and item.get("longitude") is not None)
    )

    data["statistics"] = {
        "with_facilities": with_facilities,
        "with_category": with_category,
        "with_district": with_district,
        "with_city": with_city,
        "with_coordinates": with_coordinates,
    }
    data["total_count"] = len(data["data"])

    # 儲存結果
    if output_path is None:
        output_path = json_path

    print(f"\n正在儲存結果至 {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n資料統計:")
    print(f"  總筆數: {len(data['data'])}")
    print(f"  有設施: {with_facilities}")
    print(f"  有遊戲場類別: {with_category}")
    print(f"  有行政區 (district): {with_district}")
    print(f"  有城市 (city): {with_city}")
    print(f"  有經緯度: {with_coordinates}")
    print(f"\n結果已儲存至: {output_path}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="從現有的 JSON 檔案更新詳細頁面資料")
    parser.add_argument(
        "--input",
        type=str,
        default="taipei-playgrounds-from-web.json",
        help="輸入 JSON 檔案路徑（預設：taipei-playgrounds-from-web.json）",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="輸出 JSON 檔案路徑（預設：覆蓋輸入檔案）",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=MAX_WORKERS,
        help=f"平行處理的最大執行緒數（預設：{MAX_WORKERS}）",
    )
    args = parser.parse_args()

    data_dir = Path(__file__).parent
    input_path = data_dir / args.input
    output_path = data_dir / args.output if args.output else None

    update_details_from_json(
        str(input_path), args.max_workers, str(output_path) if output_path else None
    )
