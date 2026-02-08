import { readFileSync } from 'fs';
import { normalizeCityName, normalizeDistrictName, parseCityAndDistrict } from './parseAddress.js';

interface ToiletData {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  type: string;
  type2?: string;
  administration?: string;
  exec?: string;
  grade?: string;
  number?: string;
  [key: string]: unknown;
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

export function parseToiletsData(filePath: string): ParsedPlace[] {
  const fileContent = readFileSync(filePath, 'utf-8');
  const data: ToiletData[] = JSON.parse(fileContent);

  return data
    .filter((item) => item.type === '親子廁所')
    .map((item) => {
      const lat = parseFloat(item.latitude);
      const lng = parseFloat(item.longitude);

      // Skip invalid coordinates
      if (isNaN(lat) || isNaN(lng) || lat < 20 || lat > 26 || lng < 118 || lng > 123) {
        return null;
      }

      const address = item.address || '';
      
      // 從地址中解析都市和區域
      const { city, district, remainingAddress } = parseCityAndDistrict(address);

      return {
        name: item.name || '未命名親子廁所',
        address: remainingAddress || address || '',
        city: normalizeCityName(city),
        district: normalizeDistrictName(district),
        latitude: lat,
        longitude: lng,
        link: item.link || null,
        metadata: {
          type2: item.type2,
          administration: item.administration,
          exec: item.exec,
          grade: item.grade,
          number: item.number,
          originalAddress: address, // 保留原始地址
        },
        source: '公廁建檔',
        sourceId: item.number || `toilet_${item.latitude}_${item.longitude}`,
      };
    })
    .filter((item): item is ParsedPlace => item !== null);
}
