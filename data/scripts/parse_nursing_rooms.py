"""
解析哺集乳室 CSV 資料
"""

import csv
from typing import List, Dict, Any, Optional
from .parse_address import normalize_city_name, normalize_district_name


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


def build_address(row: Dict[str, str]) -> str:
    """從 CSV 行資料建立完整地址"""
    parts = []
    if row.get('縣市'):
        parts.append(row['縣市'])
    if row.get('鄉/鎮/市/區'):
        parts.append(row['鄉/鎮/市/區'])
    if row.get('村里'):
        parts.append(row['村里'])
    if row.get('大道路街地區'):
        parts.append(row['大道路街地區'])
    if row.get('段'):
        parts.append(f"{row['段']}段")
    if row.get('巷/弄/衖'):
        parts.append(row['巷/弄/衖'])
    if row.get('號'):
        parts.append(f"{row['號']}號")
    if row.get('樓（之~）'):
        parts.append(row['樓（之~）'])

    return ''.join(parts)


def parse_nursing_rooms_data(
    file_path: str,
    source_type: str  # '依法設置' 或 '自願設置'
) -> List[ParsedPlace]:
    """
    解析哺集乳室 CSV 資料
    
    Args:
        file_path: CSV 檔案路徑
        source_type: 資料來源類型 ('依法設置' 或 '自願設置')
    
    Returns:
        解析後的地點列表
    """
    places = []

    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for index, row in enumerate(reader):
            # 跳過空的名稱
            if not row.get('場所名稱') or not row['場所名稱'].strip():
                continue

            address = build_address(row)

            # 從地址中解析都市和區域，如果地址中沒有，使用 CSV 欄位
            city = normalize_city_name(row.get('縣市'))
            district = normalize_district_name(row.get('鄉/鎮/市/區'))

            place = ParsedPlace(
                name=row['場所名稱'].strip(),
                address=address,
                city=city,
                district=district,
                latitude=None,  # Will need geocoding
                longitude=None,  # Will need geocoding
                link=row.get('連結') or row.get('link'),
                metadata={
                    '縣市': row.get('縣市'),
                    '區': row.get('鄉/鎮/市/區'),
                    '電話': row.get('電話'),
                    '開放時間': row.get('開放時間'),
                    '注意事項': row.get('注意事項'),
                    '設置依據': row.get('設置依據'),
                },
                source=f'哺集乳室-{source_type}',
                source_id=f'nursing_room_{source_type}_{index}_{row["場所名稱"]}',
            )

            places.append(place)

    return places
