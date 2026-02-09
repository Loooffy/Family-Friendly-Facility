#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
從 HTML 檔案中提取台北市兒童遊戲場的詳細資訊
分頁依序處理，詳細頁面平行處理
"""

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from urllib.parse import urlparse, parse_qs, urljoin

import requests
from bs4 import BeautifulSoup

# 基礎 URL
MAIN_PAGE_URL = "https://parks.gov.taipei/playground/#main-content"
BASE_URL = "https://parks.gov.taipei/playground/content/"
LIST_URL_TEMPLATE = (
    "m1_list.php?dopost=search&playtype_All=on&srh_keyword=&token={token}&p={page}"
)
DETAIL_URL_TEMPLATE = "m102.php?sid={sid}"

# 請求設定
REQUEST_TIMEOUT = 30
MAX_WORKERS = 10  # 平行處理的最大執行緒數
REQUEST_DELAY = 0.5  # 請求之間的延遲（秒），避免對伺服器造成壓力


def extract_detail_urls_from_list_html(html_path: str) -> List[str]:
    """
    從清單 HTML 中提取所有詳細頁面的 URL

    Args:
        html_path: 清單 HTML 檔案路徑

    Returns:
        詳細頁面 URL 列表
    """
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, "html.parser")
    urls = []

    # 尋找所有 m102.php?sid= 的連結
    links = soup.find_all("a", href=re.compile(r"m102\.php\?sid="))

    for link in links:
        href = link.get("href", "")
        if href:
            urls.append(href)

    # 去重
    return list(set(urls))


def extract_page_info_from_detail_html_content(html_content: str) -> Optional[Dict]:
    """
    從詳細資料 HTML 內容中提取資訊

    Args:
        html_content: HTML 內容字串

    Returns:
        包含行政區、遊戲場類別、圖片、經緯度等資訊的字典
    """

    soup = BeautifulSoup(html_content, "html.parser")

    result = {
        "行政區": None,
        "遊戲場類別": None,
        "圖片": [],
        "經度": None,
        "緯度": None,
        "設施": [],
    }

    # 提取行政區 - 從 feature_list 中尋找
    feature_list = soup.find("div", class_="feature_list")
    if feature_list:
        items = feature_list.find_all("li")
        for item in items:
            text = item.get_text()
            # 尋找行政區
            if "行政區" in text and not result["行政區"]:
                match = re.search(r"行政區\s*/\s*里別\s*：\s*([^區]+區)", text)
                if match:
                    result["行政區"] = match.group(1).strip()

            # 尋找遊戲場類別
            if "遊戲場類別" in text and not result["遊戲場類別"]:
                match = re.search(r"遊戲場類別\s*：\s*([^\s]+)", text)
                if match:
                    result["遊戲場類別"] = match.group(1).strip()

    # 提取圖片 - 從 img 標籤中尋找
    imgs = soup.find_all("img")
    for img in imgs:
        src = img.get("src", "")
        if src and "upload" in src and "m2s2" in src:
            # 清理相對路徑
            img_url = src
            if img_url.startswith("../../"):
                img_url = img_url.replace("../../", "")
            elif img_url.startswith("../"):
                img_url = img_url.replace("../", "")
            result["圖片"].append(img_url)

    # 如果沒找到圖片，嘗試從 portfolio 區域尋找 background-image
    if not result["圖片"]:
        portfolio_items = soup.find_all("li", class_="portfolio-item")
        for item in portfolio_items:
            # 尋找包含 background-image 的元素
            style_elem = item.find(style=re.compile(r"background-image"))
            if style_elem:
                style = style_elem.get("style", "")
                match = re.search(r"background-image:\s*url\(['\"]?([^'\"]+)['\"]?\)", style)
                if match:
                    img_url = match.group(1)
                    # 只保留 upload 目錄下的圖片
                    if "upload" in img_url:
                        # 清理相對路徑
                        if img_url.startswith("../../"):
                            img_url = img_url.replace("../../", "")
                        elif img_url.startswith("../"):
                            img_url = img_url.replace("../", "")
                        result["圖片"].append(img_url)

    # 如果還是沒找到，嘗試所有包含 background-image 的元素
    if not result["圖片"]:
        style_elements = soup.find_all(style=re.compile(r"background-image"))
        for elem in style_elements:
            style = elem.get("style", "")
            match = re.search(r"background-image:\s*url\(['\"]?([^'\"]+)['\"]?\)", style)
            if match:
                img_url = match.group(1)
                if "upload" in img_url and "m2s2" in img_url:
                    if img_url.startswith("../../"):
                        img_url = img_url.replace("../../", "")
                    elif img_url.startswith("../"):
                        img_url = img_url.replace("../", "")
                    result["圖片"].append(img_url)

    # 去重圖片
    result["圖片"] = list(set(result["圖片"]))

    # 提取經緯度 - 從 Google Maps 連結中提取
    location_btn = soup.find("a", class_="location_btn")
    if location_btn:
        href = location_btn.get("href", "")
        # 格式：https://www.google.com.tw/maps/search/公園名稱/@緯度,經度,zoom/
        # 例如：/@25.056489944,121.52398682,16z/
        match = re.search(r"/@([+-]?\d+\.?\d*),([+-]?\d+\.?\d*),", href)
        if match:
            result["緯度"] = float(match.group(1))
            result["經度"] = float(match.group(2))

    # 提取遊具資訊（設施） - 從 portfolio_group 中尋找
    portfolio_group = soup.find("ul", class_="portfolio_group")
    if portfolio_group:
        portfolio_items = portfolio_group.find_all("li", class_="portfolio-item")
        for item in portfolio_items:
            # 尋找遊具名稱 - 優先從 aimg_txt，其次從 entry-title
            equipment_name = None
            aimg_txt = item.find("span", class_="aimg_txt")
            if aimg_txt:
                equipment_name = aimg_txt.get_text(strip=True)
            else:
                entry_title = item.find("span", class_="entry-title")
                if entry_title:
                    equipment_name = entry_title.get_text(strip=True)

            # 如果還是沒有，從連結的 title 取得
            if not equipment_name:
                link = item.find("a")
                if link:
                    equipment_name = link.get("title", "").strip()

            # 尋找圖片 - 先從 img 標籤，再從 background-image
            img_url = None

            # 方法1: 從 img 標籤
            img = item.find("img")
            if img:
                img_src = img.get("src", "")
                if img_src and "upload" in img_src and "m2s2" in img_src:
                    img_url = img_src

            # 方法2: 從 background-image CSS
            if not img_url:
                link = item.find("a")
                if link:
                    style = link.get("style", "")
                    match = re.search(
                        r"background-image:\s*url\(['\"]?([^'\"]+)['\"]?\)", style
                    )
                    if match:
                        img_url = match.group(1)

            # 清理相對路徑
            if img_url:
                if img_url.startswith("../../"):
                    img_url = img_url.replace("../../", "")
                elif img_url.startswith("../"):
                    img_url = img_url.replace("../", "")

                # 只保留 upload 目錄下的圖片
                if img_url and "upload" in img_url and "m2s2" in img_url:
                    if equipment_name:
                        result["設施"].append(
                            {
                                "equipment_name": equipment_name,
                                "image": img_url,
                            }
                        )

    return result


def fetch_html_from_url(url: str, session: Optional[requests.Session] = None) -> Optional[str]:
    """
    從 URL 獲取 HTML 內容

    Args:
        url: 完整的 URL
        session: requests Session 物件（用於維持 cookies）

    Returns:
        HTML 內容，如果失敗則返回 None
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

        if session:
            response = session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        else:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)

        response.raise_for_status()
        response.encoding = "utf-8"
        time.sleep(REQUEST_DELAY)  # 避免請求過於頻繁
        return response.text
    except Exception as e:
        print(f"錯誤：無法獲取 {url}: {e}")
        return None


def get_valid_token_and_session() -> Tuple[Optional[str], Optional[requests.Session]]:
    """
    從主頁面獲取有效的 token 和 session

    Returns:
        (token, session) 元組，如果失敗則返回 (None, None)
    """
    print("正在訪問主頁面以獲取有效的 token...")

    session = requests.Session()

    # 先訪問主頁面
    html_content = fetch_html_from_url(MAIN_PAGE_URL, session)

    if not html_content:
        print("錯誤：無法訪問主頁面")
        return None, None

    # 從主頁面提取 token
    soup = BeautifulSoup(html_content, "html.parser")

    # 方法1: 從表單中提取 token
    token = None
    form = soup.find("form", {"id": "myform"})
    if form:
        token_input = form.find("input", {"name": "token"})
        if token_input:
            token = token_input.get("value")

    # 方法2: 如果表單中沒有，嘗試從 JavaScript 或頁面內容中提取
    if not token:
        # 搜尋所有包含 token 的 input
        token_inputs = soup.find_all("input", {"name": "token"})
        for inp in token_inputs:
            token_value = inp.get("value")
            if token_value:
                token = token_value
                break

    # 方法3: 從頁面中的 JavaScript 變數提取
    if not token:
        scripts = soup.find_all("script")
        for script in scripts:
            if script.string:
                match = re.search(
                    r"token['\"]?\s*[:=]\s*['\"]([a-f0-9]{32})['\"]", script.string
                )
                if match:
                    token = match.group(1)
                    break

    if token:
        print(f"成功獲取 token: {token[:16]}...")
        return token, session
    else:
        print("警告：無法從主頁面提取 token，嘗試模擬搜尋...")
        # 如果無法提取 token，嘗試直接提交搜尋表單
        return try_get_token_via_search(session)


def try_get_token_via_search(
    session: requests.Session,
) -> Tuple[Optional[str], Optional[requests.Session]]:
    """
    通過模擬搜尋操作來獲取 token

    Args:
        session: requests Session 物件

    Returns:
        (token, session) 元組
    """
    print("嘗試通過模擬搜尋獲取 token...")

    # 訪問清單頁面（不帶參數）
    list_page_url = urljoin(BASE_URL, "m1_list.php")
    html_content = fetch_html_from_url(list_page_url, session)

    if not html_content:
        return None, None

    soup = BeautifulSoup(html_content, "html.parser")

    # 從表單中提取 token
    form = soup.find("form", {"id": "myform"})
    if form:
        token_input = form.find("input", {"name": "token"})
        if token_input:
            token = token_input.get("value")
            if token:
                print(f"成功從清單頁面獲取 token: {token[:16]}...")
                return token, session

    # 如果還是沒有，嘗試提交搜尋表單
    if form:
        action = form.get("action", "m1_list.php")
        form_url = urljoin(BASE_URL, action)

        # 準備表單資料
        form_data = {
            "dopost": "search",
            "playtype_All": "on",
            "srh_keyword": "",
        }

        # 提取所有 hidden input
        hidden_inputs = form.find_all("input", type="hidden")
        for inp in hidden_inputs:
            name = inp.get("name")
            value = inp.get("value", "")
            if name:
                form_data[name] = value

        # 提交表單
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": list_page_url,
        }

        try:
            response = session.post(
                form_url, data=form_data, headers=headers, timeout=REQUEST_TIMEOUT
            )
            response.raise_for_status()

            # 從響應中提取 token（如果有的話）
            response_soup = BeautifulSoup(response.text, "html.parser")
            token_input = response_soup.find("input", {"name": "token"})
            if token_input:
                token = token_input.get("value")
                if token:
                    print(f"成功通過搜尋獲取 token: {token[:16]}...")
                    return token, session

            # 如果響應成功，使用表單中的 token
            if form_data.get("token"):
                print(f"使用表單中的 token: {form_data['token'][:16]}...")
                return form_data["token"], session
        except Exception as e:
            print(f"提交搜尋表單時發生錯誤: {e}")

    print("錯誤：無法獲取有效的 token")
    return None, None


def extract_all_urls_from_list_html(html_path: str) -> Dict[str, Dict]:
    """
    從清單 HTML 中提取所有詳細頁面的 URL 和基本資訊

    由於 HTML 檔案只包含第一頁，我們需要：
    1. 提取第一頁的所有連結
    2. 同時提取清單頁面中的行政區和類別資訊
    3. 檢查是否有分頁資訊

    Args:
        html_path: 清單 HTML 檔案路徑

    Returns:
        字典，key 為 sid，value 為包含 url、行政區、類別等資訊的字典
    """
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, "html.parser")
    result = {}

    # 尋找所有包含 m102.php?sid= 連結的項目
    # 每個項目是一個 post div
    posts = soup.find_all("div", class_=re.compile(r"post-\d+"))

    for post in posts:
        # 尋找連結
        link = post.find("a", href=re.compile(r"m102\.php\?sid="))
        if not link:
            continue

        href = link.get("href", "")
        if not href:
            continue

        # 提取 sid
        match = re.search(r"sid=(\d+)", href)
        if not match:
            continue

        sid = match.group(1)

        # 提取公園名稱
        park_name = link.get_text(strip=True)
        # 移除編號前綴（如 "1.中安公園 " -> "中安公園"）
        park_name = re.sub(r"^\d+\.\s*", "", park_name)

        # 提取行政區
        admin_area = None
        admin_area_elem = post.find(string=re.compile(r"行政區:\s*"))
        if admin_area_elem:
            match = re.search(r"行政區:\s*([^區]+區)", admin_area_elem)
            if match:
                admin_area = match.group(1)

        # 提取類別
        category = None
        category_elem = post.find(string=re.compile(r"類別:\s*"))
        if category_elem:
            match = re.search(r"類別:\s*([^\s]+)", category_elem)
            if match:
                category = match.group(1)

        result[sid] = {
            "url": href,
            "公園名稱": park_name,
            "行政區": admin_area,
            "遊戲場類別": category,
            "圖片": [],
            "設施": [],
        }

    # 檢查分頁資訊
    page_info = soup.find(string=re.compile(r"共\s+\d+\s+頁"))
    if page_info:
        match = re.search(r"共\s+(\d+)\s+頁", page_info)
        if match:
            total_pages = int(match.group(1))
            print(f"發現總共 {total_pages} 頁")

    return result


def fetch_list_page(
    page: int, token: str, session: Optional[requests.Session] = None
) -> Optional[Dict[str, Dict]]:
    """
    獲取並解析指定分頁的清單頁面

    Args:
        page: 頁碼（從 0 開始）
        token: 有效的 token
        session: requests Session 物件（用於維持 cookies）

    Returns:
        包含該頁所有遊戲場資訊的字典
    """
    url = urljoin(BASE_URL, LIST_URL_TEMPLATE.format(token=token, page=page))
    print(f"正在處理第 {page + 1} 頁: {url[:80]}...")

    html_content = fetch_html_from_url(url, session)
    if not html_content:
        return None

    # 使用現有的解析函數
    soup = BeautifulSoup(html_content, "html.parser")
    result = {}

    # 尋找所有包含 m102.php?sid= 連結的項目
    posts = soup.find_all("div", class_=re.compile(r"post-\d+"))

    for post in posts:
        link = post.find("a", href=re.compile(r"m102\.php\?sid="))
        if not link:
            continue

        href = link.get("href", "")
        if not href:
            continue

        match = re.search(r"sid=(\d+)", href)
        if not match:
            continue

        sid = match.group(1)
        park_name = link.get_text(strip=True)
        park_name = re.sub(r"^\d+\.\s*", "", park_name)

        admin_area = None
        admin_area_elem = post.find(string=re.compile(r"行政區:\s*"))
        if admin_area_elem:
            match = re.search(r"行政區:\s*([^區]+區)", admin_area_elem)
            if match:
                admin_area = match.group(1)

        category = None
        category_elem = post.find(string=re.compile(r"類別:\s*"))
        if category_elem:
            match = re.search(r"類別:\s*([^\s]+)", category_elem)
            if match:
                category = match.group(1)

        result[sid] = {
            "url": href,
            "公園名稱": park_name,
            "行政區": admin_area,
            "遊戲場類別": category,
            "圖片": [],
            "設施": [],
        }

    print(f"第 {page + 1} 頁完成，找到 {len(result)} 筆資料")
    return result


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
        包含圖片等詳細資訊的字典
    """
    full_url = urljoin(BASE_URL, url)
    html_content = fetch_html_from_url(full_url, session)

    if not html_content:
        return None

    return extract_page_info_from_detail_html_content(html_content)


def scrape_all_pages_sequential(
    total_pages: int,
    token: str,
    session: Optional[requests.Session],
    start_page: int = 0,
    page_delay: float = 1.0,
) -> Dict[str, Dict]:
    """
    依序爬取指定範圍分頁的清單資料（避免請求過於頻繁導致 504 錯誤）

    Args:
        total_pages: 要爬取的頁數
        token: 有效的 token
        session: requests Session 物件（用於維持 cookies）
        start_page: 起始頁碼（預設從 0 開始）
        page_delay: 分頁之間的延遲時間（秒），預設 1.0 秒

    Returns:
        合併後的所有遊戲場資料
    """
    all_data = {}

    if total_pages <= 0:
        return all_data

    print(f"\n開始依序爬取第 {start_page + 1} 到 {start_page + total_pages} 頁清單資料...")
    print(f"分頁間延遲：{page_delay} 秒")

    completed = 0
    for page in range(start_page, start_page + total_pages):
        try:
            page_data = fetch_list_page(page, token, session)
            if page_data:
                all_data.update(page_data)
                completed += 1
                print(f"進度: {completed}/{total_pages} 頁完成")
            else:
                print(f"警告：第 {page + 1} 頁沒有資料")
        except Exception as e:
            print(f"錯誤：處理第 {page + 1} 頁時發生錯誤: {e}")

        # 在分頁之間添加延遲（最後一頁不需要延遲）
        if page < start_page + total_pages - 1:
            time.sleep(page_delay)

    print(f"\n清單爬取完成，共找到 {len(all_data)} 筆遊戲場資料")
    return all_data


def scrape_detail_pages_parallel(
    all_data: Dict[str, Dict],
    session: Optional[requests.Session],
    max_workers: int = MAX_WORKERS,
) -> Dict[str, Dict]:
    """
    平行爬取所有詳細頁面的圖片資訊

    Args:
        all_data: 遊戲場資料字典
        session: requests Session 物件（用於維持 cookies）
        max_workers: 最大並發數

    Returns:
        更新後的遊戲場資料（包含圖片）
    """
    print(f"\n開始平行爬取 {len(all_data)} 個詳細頁面的圖片...")
    print(f"使用 {max_workers} 個執行緒")

    updated_data = all_data.copy()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 提交所有任務
        future_to_sid = {
            executor.submit(fetch_detail_page, sid, info["url"], session): sid
            for sid, info in all_data.items()
        }

        # 收集結果
        completed = 0
        for future in as_completed(future_to_sid):
            sid = future_to_sid[future]
            try:
                detail_info = future.result()
                if detail_info:
                    updated = False
                    # 更新圖片
                    if detail_info.get("圖片"):
                        updated_data[sid]["圖片"] = detail_info["圖片"]
                        updated = True
                    # 更新設施
                    if detail_info.get("設施"):
                        updated_data[sid]["設施"] = detail_info["設施"]
                        updated = True
                    # 更新經緯度
                    if detail_info.get("緯度") is not None:
                        updated_data[sid]["緯度"] = detail_info["緯度"]
                        updated = True
                    if detail_info.get("經度") is not None:
                        updated_data[sid]["經度"] = detail_info["經度"]
                        updated = True
                    # 更新行政區和遊戲場類別（如果原本沒有）
                    if detail_info.get("行政區") and not updated_data[sid].get("行政區"):
                        updated_data[sid]["行政區"] = detail_info["行政區"]
                        updated = True
                    if detail_info.get("遊戲場類別") and not updated_data[sid].get(
                        "遊戲場類別"
                    ):
                        updated_data[sid]["遊戲場類別"] = detail_info["遊戲場類別"]
                        updated = True

                    if updated:
                        completed += 1
                        if completed % 10 == 0:
                            print(f"進度: {completed}/{len(all_data)} 個詳細頁面完成")
            except Exception as e:
                print(f"錯誤：處理 sid={sid} 時發生錯誤: {e}")

    print(f"\n詳細頁面爬取完成，共更新 {completed} 筆資料的圖片")
    return updated_data


def main():
    """主函數"""
    import argparse

    parser = argparse.ArgumentParser(description="爬取台北市兒童遊戲場資料")
    parser.add_argument(
        "--mode",
        choices=["file", "web", "web-list-only"],
        default="file",
        help="執行模式：file=從本地 HTML 檔案提取，web=從網頁爬取，web-list-only=只爬取清單頁面",
    )
    parser.add_argument(
        "--total-pages",
        type=int,
        default=None,
        help="要爬取的總頁數（僅在 web 模式下有效）",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=MAX_WORKERS,
        help=f"平行處理的最大執行緒數（預設：{MAX_WORKERS}）",
    )
    parser.add_argument(
        "--skip-details",
        action="store_true",
        help="跳過詳細頁面爬取（僅爬取清單頁面）",
    )
    args = parser.parse_args()

    data_dir = Path(__file__).parent
    output_path = data_dir / "taipei-playgrounds-from-web.json"

    if args.mode == "file":
        # 從本地 HTML 檔案提取（原有功能）
        list_html_path = data_dir / "台北市兒童遊戲場_清單.html"
        detail_html_path = data_dir / "台北市兒童遊戲場詳細資料.html"

        print("正在從本地 HTML 檔案提取資料...")
        list_data = extract_all_urls_from_list_html(str(list_html_path))
        print(f"找到 {len(list_data)} 個詳細頁面連結")

        # 提取詳細資料頁面的資訊（作為範例）
        print("\n正在提取詳細資料頁面的資訊（範例）...")
        with open(detail_html_path, "r", encoding="utf-8") as f:
            detail_html_content = f.read()
        detail_info = extract_page_info_from_detail_html_content(detail_html_content)

        print("\n詳細資料頁面資訊（範例）:")
        print(json.dumps(detail_info, ensure_ascii=False, indent=2))

        all_data = []
        for sid, info in list_data.items():
            item = {
                "id": sid,
                "url": info["url"],
                "name": info["公園名稱"],
                "city": info["行政區"],
                "category": info["遊戲場類別"],
                "images": info.get("圖片", []),
                "facilities": info.get("設施", []),
            }
            # 如果有經緯度，加入
            if "緯度" in info and info["緯度"] is not None:
                item["latitude"] = info["緯度"]
            if "經度" in info and info["經度"] is not None:
                item["經度"] = info["經度"]
            all_data.append(item)

        all_data.sort(key=lambda x: int(x["id"]))

    else:
        # 從網頁爬取
        # 先獲取有效的 token 和 session
        token, session = get_valid_token_and_session()

        if not token or not session:
            print("錯誤：無法獲取有效的 token，請檢查網路連線或網站是否可訪問")
            return

        # 先獲取第一頁來確定總頁數（不處理資料，只用來確定頁數）
        print("正在獲取第一頁以確定總頁數...")
        first_page_url = urljoin(BASE_URL, LIST_URL_TEMPLATE.format(token=token, page=0))
        html_content = fetch_html_from_url(first_page_url, session)

        if not html_content:
            print("錯誤：無法獲取第一頁")
            return

        # 從第一頁的 HTML 中提取總頁數
        soup = BeautifulSoup(html_content, "html.parser")
        total_pages = args.total_pages
        if not total_pages:
            page_info = soup.find(string=re.compile(r"共\s+\d+\s+頁"))
            if page_info:
                match = re.search(r"共\s+(\d+)\s+頁", page_info)
                if match:
                    total_pages = int(match.group(1))

        if not total_pages:
            print("警告：無法確定總頁數，使用預設值 33")
            total_pages = 33

        print(f"確定總頁數：{total_pages}")

        # 依序爬取所有頁面（從第 1 頁開始）
        all_data_dict = scrape_all_pages_sequential(
            total_pages, token, session, start_page=0, page_delay=1.0
        )

        # 平行爬取詳細頁面（如果未跳過）
        if not args.skip_details and args.mode == "web":
            all_data_dict = scrape_detail_pages_parallel(
                all_data_dict, session, args.max_workers
            )

        # 轉換為列表格式，並將欄位改為英文
        all_data = []
        for sid, info in all_data_dict.items():
            item = {
                "id": sid,
                "url": info["url"],
                "name": info["公園名稱"],
                "city": info["行政區"],
                "category": info["遊戲場類別"],
                "images": info.get("圖片", []),
                "facilities": info.get("設施", []),
            }
            # 如果有經緯度，加入
            if "緯度" in info and info["緯度"] is not None:
                item["latitude"] = info["緯度"]
            if "經度" in info and info["經度"] is not None:
                item["longitude"] = info["經度"]
            all_data.append(item)

        all_data.sort(key=lambda x: int(x["id"]))

    # 統計資訊
    with_images = sum(
        1 for item in all_data if item.get("images") and len(item.get("images", [])) > 0
    )
    with_category = sum(1 for item in all_data if item.get("category"))
    with_city = sum(1 for item in all_data if item.get("city"))
    with_coordinates = sum(
        1
        for item in all_data
        if item.get("latitude") is not None and item.get("longitude") is not None
    )
    with_facilities = sum(
        1 for item in all_data if item.get("facilities") and len(item.get("facilities", [])) > 0
    )

    print(f"\n資料統計:")
    print(f"  總筆數: {len(all_data)}")
    print(f"  有圖片: {with_images}")
    print(f"  有遊戲場類別: {with_category}")
    print(f"  有行政區: {with_city}")
    print(f"  有經緯度: {with_coordinates}")
    print(f"  有設施: {with_facilities}")

    # 儲存結果
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "total_count": len(all_data),
                "data": all_data,
                "statistics": {
                    "with_images": with_images,
                    "with_category": with_category,
                    "with_city": with_city,
                    "with_coordinates": with_coordinates,
                    "with_facilities": with_facilities,
                },
                "note": (
                    "此資料使用平行處理從網頁爬取"
                    if args.mode == "web"
                    else "此資料從 HTML 檔案提取"
                ),
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    print(f"\n結果已儲存至: {output_path}")


if __name__ == "__main__":
    main()
