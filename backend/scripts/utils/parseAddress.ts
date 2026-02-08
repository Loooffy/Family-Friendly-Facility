/**
 * 從地址字串中解析出都市和區域
 * 例如: "臺北市北投區榮華三路與磺溪旁" -> { city: "臺北市", district: "北投區" }
 */

// 台灣所有都市列表（包含可能的變體）
const CITY_PATTERNS = [
  '臺北市', '台北市', '新北市', '桃園市', '臺中市', '台中市',
  '臺南市', '台南市', '高雄市', '基隆市', '新竹市', '嘉義市',
  '新竹縣', '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義縣',
  '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '台東縣', '澎湖縣',
  '金門縣', '連江縣'
];

// 區域後綴
const DISTRICT_SUFFIXES = ['區', '市', '鎮', '鄉', '縣'];

/**
 * 從地址中解析都市和區域
 * @param address 完整地址字串，例如: "臺北市北投區榮華三路與磺溪旁"
 * @param fallbackCity 如果無法從地址解析，可選的備用都市名稱
 * @param fallbackDistrict 如果無法從地址解析，可選的備用區域名稱
 * @returns { city: string | null, district: string | null, remainingAddress: string }
 */
export function parseCityAndDistrict(
  address: string | null | undefined,
  fallbackCity?: string | null,
  fallbackDistrict?: string | null
): {
  city: string | null;
  district: string | null;
  remainingAddress: string;
} {
  if (!address || address.trim() === '') {
    return {
      city: fallbackCity || null,
      district: fallbackDistrict || null,
      remainingAddress: '',
    };
  }

  let remainingAddress = address.trim();
  let city: string | null = null;
  let district: string | null = null;

  // 嘗試匹配都市
  for (const cityPattern of CITY_PATTERNS) {
    if (remainingAddress.startsWith(cityPattern)) {
      city = cityPattern;
      remainingAddress = remainingAddress.substring(cityPattern.length);
      break;
    }
  }

  // 如果沒有找到都市，使用備用值
  if (!city && fallbackCity) {
    city = fallbackCity;
  }

  // 嘗試匹配區域（在都市之後）
  if (city && remainingAddress.length > 0) {
    // 區域通常是 2-4 個字，後面跟著區/市/鎮/鄉/縣
    const districtMatch = remainingAddress.match(/^([^區市鎮鄉縣]{1,4}[區市鎮鄉縣])/);
    if (districtMatch) {
      district = districtMatch[1];
      remainingAddress = remainingAddress.substring(district.length);
    }
  }

  // 如果沒有找到區域，使用備用值
  if (!district && fallbackDistrict) {
    district = fallbackDistrict;
  }

  // 清理剩餘地址（移除開頭空白）
  remainingAddress = remainingAddress.trim();

  return {
    city,
    district,
    remainingAddress,
  };
}

/**
 * 標準化都市名稱（統一使用「臺」而非「台」）
 */
export function normalizeCityName(city: string | null | undefined): string | null {
  if (!city) return null;
  return city.replace(/台/g, '臺');
}

/**
 * 標準化區域名稱
 */
export function normalizeDistrictName(district: string | null | undefined): string | null {
  if (!district) return null;
  return district.trim();
}
