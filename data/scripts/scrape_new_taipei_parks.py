"""
爬取新北市共融特色公園資料
"""

import csv
import re
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import requests
from bs4 import BeautifulSoup
from .parse_address import normalize_city_name, normalize_district_name, parse_city_and_district


class ParsedPlace:
    """解析後的地點資料"""
    def __init__(
        self,
        name: str,
        address: str,
        city: Optional[str],
        district: Optional[str],
        latitude: Optional[float],
        longitude: Optional[float],
        link: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        source: str = '',
        source_id: str = ''
    ):
        self.name = name
        self.address = address
        self.city = city
        self.district = district
        self.latitude = latitude
        self.longitude = longitude
        self.link = link
        self.metadata = metadata or {}
        self.source = source
        self.source_id = source_id

    def to_dict(self) -> Dict[str, Any]:
        """轉換為字典格式"""
        return {
            'name': self.name,
            'address': self.address,
            'city': self.city,
            'district': self.district,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'link': self.link,
            'metadata': self.metadata,
            'source': self.source,
            'sourceId': self.source_id,
        }


def parse_park_detail_page(html_content: str) -> Dict[str, Any]:
    """
    解析詳細公園頁面 HTML 以提取地址、描述、座標等
    
    Returns:
        包含地址、描述、遊具設施、體健設施、座標、圖片連結等的字典
    """
    base_url = 'https://www.ntparks.tw/'
    result = {
        'address': '',
        'description': '',
        'playEquipment': '',  # 遊具設施
        'fitnessEquipment': '',  # 體健設施
        'latitude': None,
        'longitude': None,
        'imageLinks': [],  # 圖片連結
        'metadata': {},
    }

    soup = BeautifulSoup(html_content, 'html.parser')

    # 提取位置（地址）
    location_div = soup.find('div', class_='stitle subTitle_cray', string='位置')
    if location_div:
        content_div = location_div.find_next_sibling('div', class_='content')
        if content_div:
            result['address'] = content_div.get_text(strip=True)

    # 提取遊具設施
    play_equipment_div = soup.find('div', class_='stitle subTitle_cray', string='遊具設施')
    if play_equipment_div:
        content_div = play_equipment_div.find_next_sibling('div', class_='content')
        if content_div:
            result['playEquipment'] = content_div.get_text(strip=True)

    # 提取體健設施
    fitness_equipment_div = soup.find('div', class_='stitle subTitle_cray', string='體健設施')
    if fitness_equipment_div:
        content_div = fitness_equipment_div.find_next_sibling('div', class_='content')
        if content_div:
            result['fitnessEquipment'] = content_div.get_text(strip=True)

    # 提取公園介紹
    description_div = soup.find('div', class_='stitle subTitle_cray', string='公園介紹')
    if description_div:
        content_div = description_div.find_next_sibling('div', class_='content')
        if content_div:
            result['description'] = content_div.get_text(strip=True)

    # 提取所有圖片連結（只提取公園相關的圖片，排除 logo、icon 等）
    for img in soup.find_all('img', src=re.compile(r'images/views/')):
        image_src = img.get('src', '').strip()
        if image_src and not image_src.startswith(('http://', 'https://')):
            image_src = image_src.lstrip('/')
            image_src = f"{base_url}{image_src}" if not image_src.startswith(base_url) else image_src
            result['imageLinks'].append(image_src)

    # 從 Google Maps iframe 提取座標
    # 格式: !2d121.3315648886216!3d24.97092663816664 (經度, 緯度)
    iframe_match = re.search(r'google\.com/maps/embed\?pb=[^"]*!2d([\d.]+)!3d([\d.]+)', html_content)
    if iframe_match:
        result['longitude'] = float(iframe_match.group(1))
        result['latitude'] = float(iframe_match.group(2))

    # 提取其他資訊
    for div in soup.find_all('div', class_='stitle subTitle_cray'):
        key = div.get_text(strip=True)
        if key in ('位置', '公園介紹', '遊具設施', '體健設施'):
            continue
        
        content_div = div.find_next_sibling('div', class_='content')
        if content_div:
            value = content_div.get_text(strip=True)
            if key and value:
                result['metadata'][key] = value

    return result


def fetch_html(url: str) -> str:
    """從 URL 獲取 HTML 內容"""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f'Failed to fetch {url}: {e}')
        raise


def parse_new_taipei_parks_html_from_content(html_content: str, index_offset: int = 0) -> List[ParsedPlace]:
    """
    從 HTML 內容解析新北市公園列表
    
    Args:
        html_content: HTML 內容
        index_offset: 索引偏移量（用於多頁爬取時避免 index 衝突）
    
    Returns:
        解析後的地點列表
    """
    places = []
    soup = BeautifulSoup(html_content, 'html.parser')

    # 提取所有公園列表項
    li_items = soup.find_all('li', id=re.compile(r'^view-'))

    for index, li in enumerate(li_items):
        # 提取公園名稱
        title_tag = li.find('h3', class_='title')
        if not title_tag:
            continue

        name = title_tag.get_text(strip=True)

        # 提取位置資訊（格式：新北市．區域）
        location_tag = li.find('p', class_='location')
        location = location_tag.get_text(strip=True) if location_tag else ''

        # 提取連結
        link_tag = li.find('a', class_='views-List')
        link = link_tag.get('href') if link_tag else None

        # 將相對路徑轉換成完整 URL
        if link and not link.startswith(('http://', 'https://')):
            base_url = 'https://www.ntparks.tw/'
            link = link.lstrip('/')
            link = f"{base_url}{link}" if not link.startswith(base_url) else link

        # 解析位置資訊（格式：新北市．區域）
        district = None
        if '．' in location:
            parts = location.split('．')
            if len(parts) >= 2:
                district = parts[1].strip()
                if district and not district.endswith(('區', '市', '鎮', '鄉')):
                    district = district + '區'

        # 提取 HTML ID
        html_id = li.get('id', '')

        place = ParsedPlace(
            name=name,
            address='',  # 將從詳細頁面提取
            city='新北市',
            district=normalize_district_name(district),
            latitude=None,  # 將從詳細頁面提取
            longitude=None,  # 將從詳細頁面提取
            link=link,
            metadata={
                'originalLocation': location,
                'htmlId': html_id,
            },
            source='新北市共融特色公園',
            source_id=f'ntpc_park_{index_offset + index}_{name}',
        )

        places.append(place)

    return places


def parse_new_taipei_parks_html(file_path: str) -> List[ParsedPlace]:
    """
    從 HTML 檔案解析新北市公園資料
    
    Args:
        file_path: HTML 檔案路徑
    
    Returns:
        解析後的地點列表
    """
    if not os.path.exists(file_path):
        print(f'警告: File not found: {file_path}')
        return []

    with open(file_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    return parse_new_taipei_parks_html_from_content(html_content, 0)


def parse_new_taipei_parks_csv(file_path: str) -> List[ParsedPlace]:
    """
    解析新北市公園 CSV 檔案
    
    Args:
        file_path: CSV 檔案路徑
    
    Returns:
        解析後的地點列表
    """
    if not os.path.exists(file_path):
        print(f'警告: File not found: {file_path}')
        return []

    places = []

    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                lat = float(row.get('latitude', 0))
                lng = float(row.get('longitude', 0))
            except (ValueError, TypeError):
                continue

            # 跳過無效座標（台灣地區：緯度約 21-26，經度約 118-123）
            if lat < 20 or lat > 26 or lng < 118 or lng > 123:
                continue

            # 解析圖片連結（用分號分隔）
            image_links = []
            if row.get('imageLinks'):
                image_links = [link.strip() for link in row['imageLinks'].split(';') if link.strip()]

            place = ParsedPlace(
                name=row.get('name', '未命名公園'),
                address=row.get('address', ''),
                city=normalize_city_name(row.get('city')),
                district=normalize_district_name(row.get('district')),
                latitude=lat,
                longitude=lng,
                link=row.get('link'),
                metadata={
                    'playEquipment': row.get('playEquipment', ''),
                    'fitnessEquipment': row.get('fitnessEquipment', ''),
                    'description': row.get('description', ''),
                    'imageLinks': image_links,
                },
                source=row.get('source', '新北市共融特色公園'),
                source_id=row.get('sourceId', f"ntpc_park_{row.get('name', '')}_{lat}_{lng}"),
            )

            places.append(place)

    return places


def escape_csv_field(value: Any) -> str:
    """轉義 CSV 欄位值"""
    if value is None:
        return ''
    str_value = str(value)
    # 如果包含逗號、引號或換行，用引號包裹並轉義引號
    if ',' in str_value or '"' in str_value or '\n' in str_value:
        return f'"{str_value.replace('"', '""')}"'
    return str_value


def convert_to_csv(places: List[ParsedPlace]) -> str:
    """將地點列表轉換為 CSV 格式"""
    if not places:
        return ''

    # CSV headers
    headers = [
        'name', 'address', 'city', 'district', 'latitude', 'longitude',
        'link', 'playEquipment', 'fitnessEquipment', 'description',
        'imageLinks', 'source', 'sourceId'
    ]

    rows = [','.join(headers)]

    for place in places:
        # 從 metadata 中提取遊具設施、體健設施、公園介紹、圖片連結
        play_equipment = place.metadata.get('playEquipment', '')
        fitness_equipment = place.metadata.get('fitnessEquipment', '')
        description = place.metadata.get('description', '')
        image_links = place.metadata.get('imageLinks', [])
        image_links_str = '; '.join(image_links) if isinstance(image_links, list) else ''

        row = [
            escape_csv_field(place.name),
            escape_csv_field(place.address),
            escape_csv_field(place.city),
            escape_csv_field(place.district),
            escape_csv_field(place.latitude),
            escape_csv_field(place.longitude),
            escape_csv_field(place.link),
            escape_csv_field(play_equipment),
            escape_csv_field(fitness_equipment),
            escape_csv_field(description),
            escape_csv_field(image_links_str),
            escape_csv_field(place.source),
            escape_csv_field(place.source_id),
        ]
        rows.append(','.join(row))

    return '\n'.join(rows)


def save_to_csv(places: List[ParsedPlace], filename: str = 'new-taipei-parks.csv', output_dir: Optional[str] = None) -> None:
    """將地點列表儲存為 CSV 檔案"""
    csv_content = convert_to_csv(places)

    if output_dir:
        output_path = Path(output_dir) / filename
    else:
        # 預設存到 data 目錄
        # 假設此檔案在 data/scripts/，向上兩層到專案根目錄
        project_root = Path(__file__).parent.parent.parent
        data_dir = project_root / 'data'
        output_path = data_dir / filename

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(csv_content)

    print(f'已將 {len(places)} 筆資料儲存至: {output_path}')
