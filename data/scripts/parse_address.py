"""
從地址字串中解析出都市和區域
例如: "臺北市北投區榮華三路與磺溪旁" -> { city: "臺北市", district: "北投區" }
"""

import re
from typing import Optional, Tuple

# 台灣所有都市列表（包含可能的變體）
CITY_PATTERNS = [
    '臺北市', '台北市', '新北市', '桃園市', '臺中市', '台中市',
    '臺南市', '台南市', '高雄市', '基隆市', '新竹市', '嘉義市',
    '新竹縣', '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義縣',
    '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '台東縣', '澎湖縣',
    '金門縣', '連江縣'
]

# 區域後綴
DISTRICT_SUFFIXES = ['區', '市', '鎮', '鄉', '縣']


def parse_city_and_district(
    address: Optional[str],
    fallback_city: Optional[str] = None,
    fallback_district: Optional[str] = None
) -> Tuple[Optional[str], Optional[str], str]:
    """
    從地址中解析都市和區域
    
    Args:
        address: 完整地址字串，例如: "臺北市北投區榮華三路與磺溪旁"
        fallback_city: 如果無法從地址解析，可選的備用都市名稱
        fallback_district: 如果無法從地址解析，可選的備用區域名稱
    
    Returns:
        (city, district, remaining_address) 元組
    """
    if not address or address.strip() == '':
        return (fallback_city, fallback_district, '')

    remaining_address = address.strip()
    city: Optional[str] = None
    district: Optional[str] = None

    # 嘗試匹配都市
    for city_pattern in CITY_PATTERNS:
        if remaining_address.startswith(city_pattern):
            city = city_pattern
            remaining_address = remaining_address[len(city_pattern):]
            break

    # 如果沒有找到都市，使用備用值
    if not city and fallback_city:
        city = fallback_city

    # 嘗試匹配區域（在都市之後）
    if city and len(remaining_address) > 0:
        # 區域通常是 2-4 個字，後面跟著區/市/鎮/鄉/縣
        district_match = re.match(r'^([^區市鎮鄉縣]{1,4}[區市鎮鄉縣])', remaining_address)
        if district_match:
            district = district_match.group(1)
            remaining_address = remaining_address[len(district):]

    # 如果沒有找到區域，使用備用值
    if not district and fallback_district:
        district = fallback_district

    # 清理剩餘地址（移除開頭空白）
    remaining_address = remaining_address.strip()

    return (city, district, remaining_address)


def normalize_city_name(city: Optional[str]) -> Optional[str]:
    """
    標準化都市名稱（統一使用「臺」而非「台」）
    """
    if not city:
        return None
    return city.replace('台', '臺')


def normalize_district_name(district: Optional[str]) -> Optional[str]:
    """
    標準化區域名稱
    """
    if not district:
        return None
    return district.strip()
