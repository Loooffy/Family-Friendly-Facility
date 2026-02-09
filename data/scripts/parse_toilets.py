"""
解析親子廁所 JSON 資料
"""

import json
from typing import List, Dict, Any, Optional
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


def parse_toilets_data(file_path: str) -> List[ParsedPlace]:
    """
    解析親子廁所 JSON 資料
    
    Args:
        file_path: JSON 檔案路徑
    
    Returns:
        解析後的地點列表
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    places = []

    for item in data:
        # 只處理親子廁所
        if item.get('type') != '親子廁所':
            continue

        try:
            lat = float(item.get('latitude', 0))
            lng = float(item.get('longitude', 0))
        except (ValueError, TypeError):
            continue

        # 跳過無效座標（台灣地區：緯度約 21-26，經度約 118-123）
        if lat < 20 or lat > 26 or lng < 118 or lng > 123:
            continue

        address = item.get('address', '')

        # 從地址中解析都市和區域
        city, district, remaining_address = parse_city_and_district(address)

        place = ParsedPlace(
            name=item.get('name', '未命名親子廁所'),
            address=remaining_address or address or '',
            city=normalize_city_name(city),
            district=normalize_district_name(district),
            latitude=lat,
            longitude=lng,
            link=item.get('link'),
            metadata={
                'type2': item.get('type2'),
                'administration': item.get('administration'),
                'exec': item.get('exec'),
                'grade': item.get('grade'),
                'number': item.get('number'),
                'originalAddress': address,  # 保留原始地址
            },
            source='公廁建檔',
            source_id=item.get('number') or f"toilet_{lat}_{lng}",
        )

        places.append(place)

    return places
