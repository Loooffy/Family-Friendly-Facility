import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { normalizeCityName, normalizeDistrictName, parseCityAndDistrict } from './parseAddress.js';

/**
 * TWD97 轉 WGS84 座標轉換
 * TWD97 是台灣的座標系統，X坐標和Y坐標需要轉換成經緯度
 * 使用 Transverse Mercator 投影的反轉換
 */
function twd97ToWGS84(x: number, y: number): { lat: number; lng: number } {
  // TWD97 參數 (GRS80)
  const a = 6378137.0; // 長半軸 (m)
  const b = 6356752.314140; // 短半軸 (m)
  const e = Math.sqrt(1 - (b * b) / (a * a)); // 第一偏心率
  
  // TWD97 投影參數 (二度分帶，中央經線 121度)
  const k0 = 0.9999; // 比例因子
  const dx = 250000; // 東偏移 (m)
  const dy = 0; // 北偏移 (m)
  const lon0 = 121 * Math.PI / 180; // 中央經線（121度）
  
  // 計算相對於原點的座標
  const x1 = x - dx;
  const y1 = y - dy;
  
  // 計算子午線弧長
  const M = y1 / k0;
  
  // 計算緯度（使用迭代法）
  const mu = M / (a * (1 - Math.pow(e, 2) / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));
  
  const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
  const J1 = 3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32;
  const J2 = 21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32;
  const J3 = 151 * Math.pow(e1, 3) / 96;
  const J4 = 1097 * Math.pow(e1, 4) / 512;
  
  const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);
  
  // 計算輔助量
  const e2 = Math.pow(e, 2) / (1 - Math.pow(e, 2));
  const N1 = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2));
  const T1 = Math.pow(Math.tan(fp), 2);
  const C1 = e2 * Math.pow(Math.cos(fp), 2);
  const R1 = a * (1 - Math.pow(e, 2)) / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2), 1.5);
  const D = x1 / (N1 * k0);
  
  // 計算緯度
  const Q1 = N1 * Math.tan(fp) / R1;
  const Q2 = Math.pow(D, 2) / 2;
  const Q3 = (5 + 3 * T1 + 10 * C1 - 4 * Math.pow(C1, 2) - 9 * e2) * Math.pow(D, 4) / 24;
  const Q4 = (61 + 90 * T1 + 298 * C1 + 45 * Math.pow(T1, 2) - 252 * e2 - 3 * Math.pow(C1, 2)) * Math.pow(D, 6) / 720;
  
  const lat = fp - Q1 * (Q2 - Q3 + Q4);
  
  // 計算經度
  const Q5 = D;
  const Q6 = (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6;
  const Q7 = (5 - 2 * C1 + 28 * T1 - 3 * Math.pow(C1, 2) + 8 * e2 + 24 * Math.pow(T1, 2)) * Math.pow(D, 5) / 120;
  
  const lng = lon0 + (Q5 - Q6 + Q7) / Math.cos(fp);
  
  return {
    lat: lat * 180 / Math.PI,
    lng: lng * 180 / Math.PI,
  };
}

interface PlaygroundRow {
  location: string;
  district: string;
  address: string;
  longitude: string;
  latitude: string;
  link?: string;
}

export interface ParsedPlace {
  name: string;
  address: string;
  city: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
  link?: string | null;
  metadata: Record<string, unknown>;
  source: string;
  sourceId: string;
}

export function parsePlaygroundsCSV(filePath: string): ParsedPlace[] {
  const fileContent = readFileSync(filePath, 'utf-8');

  const records: PlaygroundRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  return records
    .map((row) => {
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);

      // Skip invalid coordinates
      if (isNaN(lat) || isNaN(lng) || lat < 20 || lat > 26 || lng < 118 || lng > 123) {
        return null;
      }

      // 從地址中解析都市和區域
      const { city, district, remainingAddress } = parseCityAndDistrict(
        row.address,
        null, // 沒有備用都市
        row.district || null // 使用 CSV 中的 district 作為備用
      );

      return {
        name: row.location || '未命名遊戲場',
        address: remainingAddress || row.address || '', // 使用解析後的剩餘地址
        city: normalizeCityName(city),
        district: normalizeDistrictName(district),
        latitude: lat,
        longitude: lng,
        link: row.link || null,
        metadata: {
          district: row.district,
          originalAddress: row.address, // 保留原始地址
        },
        source: '共融式遊戲場',
        sourceId: `playground_${row.location}_${lat}_${lng}`,
      };
    })
    .filter((item): item is ParsedPlace => item !== null);
}

export function parseTaipeiPlaygroundsJSON(filePath: string): ParsedPlace[] {
  const fileContent = readFileSync(filePath, 'utf-8');
  const data: unknown = JSON.parse(fileContent);

  // Handle different JSON structures
  if (!Array.isArray(data)) {
    console.warn('Taipei playgrounds JSON is not an array');
    return [];
  }

  return data
    .map((item: any) => {
      // 處理中文欄位名稱
      const name = item['公園名稱'] || item.name || item.location || item.名稱 || '未命名遊戲場';
      const districtName = item['行政區'] || item.district || item.行政區 || '';
      
      // 嘗試取得經緯度（可能有多種欄位名稱）
      let lat = parseFloat(item.latitude || item.lat || item.緯度 || item['緯度'] || '');
      let lng = parseFloat(item.longitude || item.lng || item.經度 || item['經度'] || '');
      
      // 如果沒有經緯度，嘗試從 TWD97 座標轉換
      if (isNaN(lat) || isNaN(lng)) {
        const x = parseFloat(item['X坐標'] || item.X坐標 || '');
        const y = parseFloat(item['Y坐標'] || item.Y坐標 || '');
        
        if (!isNaN(x) && !isNaN(y) && x > 0 && y > 0) {
          // 轉換 TWD97 座標為 WGS84 經緯度
          const coords = twd97ToWGS84(x, y);
          lat = coords.lat;
          lng = coords.lng;
        } else {
          // 沒有有效的座標資料，跳過
          return null;
        }
      }

      // 驗證座標範圍（台灣地區：緯度約 21-26，經度約 118-123）
      if (isNaN(lat) || isNaN(lng) || lat < 20 || lat > 26 || lng < 118 || lng > 123) {
        return null;
      }

      // 台北市資料，city 直接設為「臺北市」
      const city = '臺北市';
      
      // 處理區域名稱（加上「區」後綴如果沒有的話）
      let district = districtName;
      if (district && !district.endsWith('區') && !district.endsWith('市') && !district.endsWith('鎮') && !district.endsWith('鄉')) {
        district = district + '區';
      }

      return {
        name,
        address: '', // 此資料來源沒有地址欄位
        city: normalizeCityName(city), // 確保使用標準化的「臺」
        district: normalizeDistrictName(district),
        latitude: lat,
        longitude: lng,
        link: item.link || item['連結'] || null,
        metadata: {
          ...item,
          行政區: districtName, // 保留原始行政區名稱
        },
        source: '台北市兒童遊戲場',
        sourceId: `taipei_playground_${item.id || name}_${lat}_${lng}`,
      };
    })
    .filter((item): item is ParsedPlace => item !== null);
}
