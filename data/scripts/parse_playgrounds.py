"""
解析遊戲場資料（CSV 和 JSON）
包含 TWD97 座標轉換功能
"""

import csv
import json
import math
from typing import List, Dict, Any, Optional, Tuple
from .parse_address import normalize_city_name, normalize_district_name, parse_city_and_district


class ParsedPlace:
    """解析後的地點資料"""
    def __init__(
        self,
        name: str,
        address: str,
        city: Optional[str],
        district: Optional[str],
        latitude: float,
        longitude: float,
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


def twd97_to_wgs84(x: float, y: float) -> Tuple[float, float]:
    """
    TWD97 轉 WGS84 座標轉換
    TWD97 是台灣的座標系統，X坐標和Y坐標需要轉換成經緯度
    使用 Transverse Mercator 投影的反轉換
    
    Args:
        x: TWD97 X 座標
        y: TWD97 Y 座標
    
    Returns:
        (緯度, 經度) 元組
    """
    # TWD97 參數 (GRS80)
    a = 6378137.0  # 長半軸 (m)
    b = 6356752.314140  # 短半軸 (m)
    e = math.sqrt(1 - (b * b) / (a * a))  # 第一偏心率

    # TWD97 投影參數 (二度分帶，中央經線 121度)
    k0 = 0.9999  # 比例因子
    dx = 250000  # 東偏移 (m)
    dy = 0  # 北偏移 (m)
    lon0 = 121 * math.pi / 180  # 中央經線（121度）

    # 計算相對於原點的座標
    x1 = x - dx
    y1 = y - dy

    # 計算子午線弧長
    M = y1 / k0

    # 計算緯度（使用迭代法）
    mu = M / (a * (1 - e**2 / 4 - 3 * e**4 / 64 - 5 * e**6 / 256))

    e1 = (1 - math.sqrt(1 - e * e)) / (1 + math.sqrt(1 - e * e))
    J1 = 3 * e1 / 2 - 27 * e1**3 / 32
    J2 = 21 * e1**2 / 16 - 55 * e1**4 / 32
    J3 = 151 * e1**3 / 96
    J4 = 1097 * e1**4 / 512

    fp = mu + J1 * math.sin(2 * mu) + J2 * math.sin(4 * mu) + J3 * math.sin(6 * mu) + J4 * math.sin(8 * mu)

    # 計算輔助量
    e2 = e**2 / (1 - e**2)
    N1 = a / math.sqrt(1 - e**2 * math.sin(fp)**2)
    T1 = math.tan(fp)**2
    C1 = e2 * math.cos(fp)**2
    R1 = a * (1 - e**2) / (1 - e**2 * math.sin(fp)**2)**1.5
    D = x1 / (N1 * k0)

    # 計算緯度
    Q1 = N1 * math.tan(fp) / R1
    Q2 = D**2 / 2
    Q3 = (5 + 3 * T1 + 10 * C1 - 4 * C1**2 - 9 * e2) * D**4 / 24
    Q4 = (61 + 90 * T1 + 298 * C1 + 45 * T1**2 - 252 * e2 - 3 * C1**2) * D**6 / 720

    lat = fp - Q1 * (Q2 - Q3 + Q4)

    # 計算經度
    Q5 = D
    Q6 = (1 + 2 * T1 + C1) * D**3 / 6
    Q7 = (5 - 2 * C1 + 28 * T1 - 3 * C1**2 + 8 * e2 + 24 * T1**2) * D**5 / 120

    lng = lon0 + (Q5 - Q6 + Q7) / math.cos(fp)

    return (lat * 180 / math.pi, lng * 180 / math.pi)


def parse_playgrounds_csv(file_path: str) -> List[ParsedPlace]:
    """
    解析遊戲場 CSV 資料
    
    Args:
        file_path: CSV 檔案路徑
    
    Returns:
        解析後的地點列表
    """
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

            # 從地址中解析都市和區域
            city, district, remaining_address = parse_city_and_district(
                row.get('address', ''),
                None,  # 沒有備用都市
                row.get('district')  # 使用 CSV 中的 district 作為備用
            )

            place = ParsedPlace(
                name=row.get('location', '未命名遊戲場'),
                address=remaining_address or row.get('address', ''),
                city=normalize_city_name(city),
                district=normalize_district_name(district),
                latitude=lat,
                longitude=lng,
                link=row.get('link'),
                metadata={
                    'district': row.get('district'),
                    'originalAddress': row.get('address'),  # 保留原始地址
                },
                source='共融式遊戲場',
                source_id=f"playground_{row.get('location', '')}_{lat}_{lng}",
            )

            places.append(place)

    return places


def parse_taipei_playgrounds_json(file_path: str) -> List[ParsedPlace]:
    """
    解析台北市兒童遊戲場 JSON 資料
    
    Args:
        file_path: JSON 檔案路徑
    
    Returns:
        解析後的地點列表
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 處理不同的 JSON 結構
    if not isinstance(data, list):
        print('警告: Taipei playgrounds JSON is not an array')
        return []

    places = []

    for item in data:
        # 處理中文欄位名稱
        name = item.get('公園名稱') or item.get('name') or item.get('location') or item.get('名稱') or '未命名遊戲場'
        district_name = item.get('行政區') or item.get('district') or item.get('行政區') or ''

        # 嘗試取得經緯度（可能有多種欄位名稱）
        lat_str = str(item.get('latitude') or item.get('lat') or item.get('緯度') or item.get('緯度') or '')
        lng_str = str(item.get('longitude') or item.get('lng') or item.get('經度') or item.get('經度') or '')

        try:
            lat = float(lat_str) if lat_str else float('nan')
            lng = float(lng_str) if lng_str else float('nan')
        except (ValueError, TypeError):
            lat = float('nan')
            lng = float('nan')

        # 如果沒有經緯度，嘗試從 TWD97 座標轉換
        if math.isnan(lat) or math.isnan(lng):
            x_str = str(item.get('X坐標') or item.get('X坐標') or '')
            y_str = str(item.get('Y坐標') or item.get('Y坐標') or '')

            try:
                x = float(x_str) if x_str else float('nan')
                y = float(y_str) if y_str else float('nan')
            except (ValueError, TypeError):
                x = float('nan')
                y = float('nan')

            if not math.isnan(x) and not math.isnan(y) and x > 0 and y > 0:
                # 轉換 TWD97 座標為 WGS84 經緯度
                lat, lng = twd97_to_wgs84(x, y)
            else:
                # 沒有有效的座標資料，跳過
                continue

        # 驗證座標範圍（台灣地區：緯度約 21-26，經度約 118-123）
        if math.isnan(lat) or math.isnan(lng) or lat < 20 or lat > 26 or lng < 118 or lng > 123:
            continue

        # 台北市資料，city 直接設為「臺北市」
        city = '臺北市'

        # 處理區域名稱（加上「區」後綴如果沒有的話）
        district = district_name
        if district and not district.endswith(('區', '市', '鎮', '鄉')):
            district = district + '區'

        place = ParsedPlace(
            name=name,
            address='',  # 此資料來源沒有地址欄位
            city=normalize_city_name(city),  # 確保使用標準化的「臺」
            district=normalize_district_name(district),
            latitude=lat,
            longitude=lng,
            link=item.get('link') or item.get('連結'),
            metadata={
                **item,
                '行政區': district_name,  # 保留原始行政區名稱
            },
            source='台北市兒童遊戲場',
            source_id=f"taipei_playground_{item.get('id', name)}_{lat}_{lng}",
        )

        places.append(place)

    return places
