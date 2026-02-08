import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { normalizeCityName, normalizeDistrictName } from './parseAddress.js';

interface NursingRoomRow {
  場所名稱: string;
  縣市: string;
  '鄉/鎮/市/區': string;
  村里?: string;
  大道路街地區?: string;
  段?: string;
  '巷/弄/衖'?: string;
  號?: string;
  '樓（之~）'?: string;
  電話?: string;
  開放時間?: string;
  注意事項?: string;
  設置依據: string;
}

export interface ParsedPlace {
  name: string;
  address: string;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  link?: string | null;
  metadata: Record<string, unknown>;
  source: string;
  sourceId: string;
}

// Simple geocoding helper - in production, use a proper geocoding service
function buildAddress(row: NursingRoomRow): string {
  const parts: string[] = [];
  if (row.縣市) parts.push(row.縣市);
  if (row['鄉/鎮/市/區']) parts.push(row['鄉/鎮/市/區']);
  if (row.村里) parts.push(row.村里);
  if (row.大道路街地區) parts.push(row.大道路街地區);
  if (row.段) parts.push(`${row.段}段`);
  if (row['巷/弄/衖']) parts.push(row['巷/弄/衖']);
  if (row.號) parts.push(`${row.號}號`);
  if (row['樓（之~）']) parts.push(row['樓（之~）']);

  return parts.join('');
}

export function parseNursingRoomsData(
  filePath: string,
  sourceType: '依法設置' | '自願設置'
): ParsedPlace[] {
  const fileContent = readFileSync(filePath, 'utf-8');

  // Parse CSV - handle the header row issue
  const records: NursingRoomRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });

  return records
    .filter((row) => row.場所名稱 && row.場所名稱.trim() !== '')
    .map((row, index) => {
      const address = buildAddress(row);
      
      // 從地址中解析都市和區域，如果地址中沒有，使用 CSV 欄位
      const city = normalizeCityName(row.縣市 || null);
      const district = normalizeDistrictName(row['鄉/鎮/市/區'] || null);

      return {
        name: row.場所名稱.trim(),
        address,
        city,
        district,
        latitude: null, // Will need geocoding
        longitude: null, // Will need geocoding
        link: row.連結 || row.link || null,
        metadata: {
          縣市: row.縣市,
          區: row['鄉/鎮/市/區'],
          電話: row.電話,
          開放時間: row.開放時間,
          注意事項: row.注意事項,
          設置依據: row.設置依據,
        },
        source: `哺集乳室-${sourceType}`,
        sourceId: `nursing_room_${sourceType}_${index}_${row.場所名稱}`,
      };
    });
}
