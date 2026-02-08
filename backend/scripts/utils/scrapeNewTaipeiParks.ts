import { parse } from 'csv-parse/sync';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { normalizeCityName, normalizeDistrictName, parseCityAndDistrict } from './parseAddress.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

/**
 * Scrape New Taipei City inclusive parks from HTML
 * HTML structure: <li id="view-..."> contains <h3 class="title"> and <p class="location">
 */
export function parseNewTaipeiParksHTML(filePath: string): ParsedPlace[] {
  if (!existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return [];
  }

  const htmlContent = readFileSync(filePath, 'utf-8');
  return parseNewTaipeiParksHTMLFromContent(htmlContent, 0);
}

/**
 * Parse detailed park page HTML to extract address, description, coordinates, etc.
 */
export function parseParkDetailPage(htmlContent: string): {
  address: string;
  description: string;
  playEquipment: string; // 遊具設施
  fitnessEquipment: string; // 體健設施
  latitude: number | null;
  longitude: number | null;
  imageLinks: string[]; // 圖片連結
  metadata: Record<string, unknown>;
} {
  const baseUrl = 'https://www.ntparks.tw/';
  const result = {
    address: '',
    description: '',
    playEquipment: '',
    fitnessEquipment: '',
    latitude: null as number | null,
    longitude: null as number | null,
    imageLinks: [] as string[],
    metadata: {} as Record<string, unknown>,
  };

  // 提取位置（地址）
  const locationMatch = htmlContent.match(/<div[^>]*class="stitle subTitle_cray"[^>]*>位置<\/div>\s*<div[^>]*class="content"[^>]*>([^<]+)<\/div>/);
  if (locationMatch) {
    result.address = locationMatch[1].trim();
  }

  // 提取遊具設施
  const playEquipmentMatch = htmlContent.match(/<div[^>]*class="stitle subTitle_cray"[^>]*>遊具設施<\/div>\s*<div[^>]*class="content"[^>]*>([\s\S]*?)<\/div>/);
  if (playEquipmentMatch) {
    result.playEquipment = playEquipmentMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  // 提取體健設施
  const fitnessEquipmentMatch = htmlContent.match(/<div[^>]*class="stitle subTitle_cray"[^>]*>體健設施<\/div>\s*<div[^>]*class="content"[^>]*>([\s\S]*?)<\/div>/);
  if (fitnessEquipmentMatch) {
    result.fitnessEquipment = fitnessEquipmentMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  // 提取公園介紹
  const descriptionMatch = htmlContent.match(/<div[^>]*class="stitle subTitle_cray"[^>]*>公園介紹<\/div>\s*<div[^>]*class="content"[^>]*>([\s\S]*?)<\/div>/);
  if (descriptionMatch) {
    // 移除 HTML 標籤
    result.description = descriptionMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  // 提取所有圖片連結（只提取公園相關的圖片，排除 logo、icon 等）
  // 格式: <img src="images/views/view-109-23-239/Photo-01.jpg">
  const imageMatches = htmlContent.matchAll(/<img[^>]*src="([^"]*images\/views\/[^"]+)"[^>]*>/g);
  for (const match of imageMatches) {
    let imageSrc = match[1].trim();
    // 移除開頭的空格（如果有）
    imageSrc = imageSrc.replace(/^\s+/, '');
    // 轉換成完整 URL
    if (imageSrc && !imageSrc.startsWith('http://') && !imageSrc.startsWith('https://')) {
      imageSrc = imageSrc.startsWith('/') ? `${baseUrl}${imageSrc.slice(1)}` : `${baseUrl}${imageSrc}`;
      result.imageLinks.push(imageSrc);
    }
  }

  // 從 Google Maps iframe 提取座標
  // 格式: !2d121.3315648886216!3d24.97092663816664 (經度, 緯度)
  const iframeMatch = htmlContent.match(/google\.com\/maps\/embed\?pb=[^"]*!2d([\d.]+)!3d([\d.]+)/);
  if (iframeMatch) {
    result.longitude = parseFloat(iframeMatch[1]);
    result.latitude = parseFloat(iframeMatch[2]);
  }

  // 提取其他資訊
  const infoMatches = htmlContent.matchAll(/<div[^>]*class="stitle subTitle_cray"[^>]*>([^<]+)<\/div>\s*<div[^>]*class="content"[^>]*>([\s\S]*?)<\/div>/g);
  for (const match of infoMatches) {
    const key = match[1].trim();
    const value = match[2].replace(/<[^>]+>/g, '').trim();
    if (key && value && key !== '位置' && key !== '公園介紹' && key !== '遊具設施' && key !== '體健設施') {
      result.metadata[key] = value;
    }
  }

  return result;
}

/**
 * Fetch HTML content from URL
 */
async function fetchHTML(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    throw error;
  }
}

/**
 * Scrape all pages from the website (parallel processing)
 */
export async function scrapeAllPagesFromWeb(): Promise<ParsedPlace[]> {
  const baseUrl = 'https://www.ntparks.tw/';
  
  // 所有分頁：views.html, views02.html, ..., views16.html
  const pageUrls: string[] = [
    'views.html',
    'views02.html',
    'views03.html',
    'views04.html',
    'views05.html',
    'views06.html',
    'views07.html',
    'views08.html',
    'views09.html',
    'views10.html',
    'views11.html',
    'views12.html',
    'views13.html',
    'views14.html',
    'views15.html',
    'views16.html',
  ];

  console.log(`開始平行爬取 ${pageUrls.length} 個分頁...\n`);

  // 平行爬取所有分頁
  const pagePromises = pageUrls.map(async (pageFile, i) => {
    const pageUrl = `${baseUrl}${pageFile}`;
    console.log(`[${i + 1}/${pageUrls.length}] 開始爬取: ${pageUrl}`);
    
    try {
      const htmlContent = await fetchHTML(pageUrl);
      const places = parseNewTaipeiParksHTMLFromContent(htmlContent, i * 1000); // 使用偏移量避免 index 衝突
      console.log(`[${i + 1}/${pageUrls.length}] ✓ 找到 ${places.length} 個公園`);
      return places;
    } catch (error) {
      console.error(`[${i + 1}/${pageUrls.length}] ✗ 爬取失敗:`, error);
      return [] as ParsedPlace[];
    }
  });

  // 等待所有分頁爬取完成
  const allPagesPlaces = await Promise.all(pagePromises);
  const allPlaces = allPagesPlaces.flat();
  
  console.log(`\n所有分頁爬取完成，總共找到 ${allPlaces.length} 個公園`);
  console.log(`開始平行提取詳細資料...\n`);

  // 平行提取所有公園的詳細資料
  const detailPromises = allPlaces.map(async (place, index) => {
    if (!place.link) {
      return place;
    }

    try {
      const detailHtml = await fetchHTML(place.link);
      const detail = parseParkDetailPage(detailHtml);
      
      // 更新公園資料
      place.address = detail.address;
      place.latitude = detail.latitude;
      place.longitude = detail.longitude;
      
      // 合併 metadata（包含遊具設施、體健設施、公園介紹、圖片連結等）
      place.metadata = {
        ...place.metadata,
        description: detail.description,
        playEquipment: detail.playEquipment, // 遊具設施
        fitnessEquipment: detail.fitnessEquipment, // 體健設施
        imageLinks: detail.imageLinks, // 圖片連結陣列
        ...detail.metadata,
      };
      
      // 如果有地址，重新解析城市和區域
      if (detail.address) {
        const { city, district, remainingAddress } = parseCityAndDistrict(
          detail.address,
          '新北市',
          place.district
        );
        place.city = normalizeCityName(city);
        place.district = normalizeDistrictName(district);
        if (remainingAddress && !place.address.includes(remainingAddress)) {
          place.address = remainingAddress;
        }
      }
      
      if ((index + 1) % 50 === 0) {
        console.log(`  已處理 ${index + 1}/${allPlaces.length} 個公園...`);
      }
    } catch (error) {
      console.warn(`  無法提取 ${place.name} 的詳細資料:`, error);
    }
    
    return place;
  });

  // 等待所有詳細資料提取完成
  const placesWithDetails = await Promise.all(detailPromises);
  
  console.log(`\n✓ 所有詳細資料提取完成！`);
  return placesWithDetails;
}

/**
 * Parse HTML content (extracted from parseNewTaipeiParksHTML for reuse)
 */
function parseNewTaipeiParksHTMLFromContent(htmlContent: string, indexOffset: number = 0): ParsedPlace[] {
  const places: ParsedPlace[] = [];

  // 提取所有公園列表項
  const liMatches = htmlContent.matchAll(/<li[^>]*id="view-[^"]+"[^>]*>([\s\S]*?)<\/li>/g);
  
  let index = 0;
  for (const match of liMatches) {
    const content = match[1];
    
    // 提取公園名稱
    const titleMatch = content.match(/<h3[^>]*class="title"[^>]*>([^<]+)<\/h3>/);
    if (!titleMatch) continue;
    
    const name = titleMatch[1].trim();
    
    // 提取位置資訊（格式：新北市．區域）
    const locationMatch = content.match(/<p[^>]*class="location"[^>]*>([^<]+)<\/p>/);
    const location = locationMatch ? locationMatch[1].trim() : '';
    
    // 提取連結
    const linkMatch = content.match(/<a[^>]*href="([^"]+)"[^>]*class="views-List"/);
    let link = linkMatch ? linkMatch[1].trim() : null;
    
    // 將相對路徑轉換成完整 URL
    if (link && !link.startsWith('http://') && !link.startsWith('https://')) {
      const baseUrl = 'https://www.ntparks.tw/';
      link = link.startsWith('/') ? `${baseUrl}${link.slice(1)}` : `${baseUrl}${link}`;
    }
    
    // 解析位置資訊（格式：新北市．區域）
    let district: string | null = null;
    if (location.includes('．')) {
      const parts = location.split('．');
      if (parts.length >= 2) {
        district = parts[1].trim();
        if (district && !district.endsWith('區') && !district.endsWith('市') && !district.endsWith('鎮') && !district.endsWith('鄉')) {
          district = district + '區';
        }
      }
    }
    
    places.push({
      name,
      address: '', // 將從詳細頁面提取
      city: '新北市',
      district: normalizeDistrictName(district),
      latitude: null, // 將從詳細頁面提取
      longitude: null, // 將從詳細頁面提取
      link: link,
      metadata: {
        originalLocation: location,
        htmlId: match[0].match(/id="([^"]+)"/)?.[1] || null,
      },
      source: '新北市共融特色公園',
      sourceId: `ntpc_park_${indexOffset + index}_${name}`,
    });
    
    index++;
  }

  return places;
}

/**
 * Escape CSV field value
 */
function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert ParsedPlace array to CSV format
 */
function convertToCSV(places: ParsedPlace[]): string {
  if (places.length === 0) {
    return '';
  }

  // CSV headers
  const headers = [
    'name',
    'address',
    'city',
    'district',
    'latitude',
    'longitude',
    'link',
    'playEquipment',
    'fitnessEquipment',
    'description',
    'imageLinks',
    'source',
    'sourceId',
  ];

  // Create CSV rows
  const rows = [headers.join(',')];

  for (const place of places) {
    // 從 metadata 中提取遊具設施、體健設施、公園介紹、圖片連結
    const playEquipment = (place.metadata.playEquipment as string) || '';
    const fitnessEquipment = (place.metadata.fitnessEquipment as string) || '';
    const description = (place.metadata.description as string) || '';
    const imageLinks = Array.isArray(place.metadata.imageLinks) 
      ? (place.metadata.imageLinks as string[]).join('; ') 
      : '';
    
    const row = [
      escapeCSVField(place.name),
      escapeCSVField(place.address),
      escapeCSVField(place.city),
      escapeCSVField(place.district),
      escapeCSVField(place.latitude),
      escapeCSVField(place.longitude),
      escapeCSVField(place.link),
      escapeCSVField(playEquipment),
      escapeCSVField(fitnessEquipment),
      escapeCSVField(description),
      escapeCSVField(imageLinks),
      escapeCSVField(place.source),
      escapeCSVField(place.sourceId),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Save parsed places to CSV file in data directory
 */
export function saveToCSV(
  places: ParsedPlace[], 
  filename: string = 'new-taipei-parks.csv',
  outputDir?: string
): void {
  const csvContent = convertToCSV(places);
  
  let outputPath: string;
  
  if (outputDir) {
    // 如果指定了輸出目錄，直接使用
    outputPath = join(outputDir, filename);
  } else {
    // 預設存到 data 目錄
    // Get the project root (assuming this file is in backend/scripts/utils)
    // Go up 3 levels: utils -> scripts -> backend -> root
    const projectRoot = join(__dirname, '../../..');
    const dataDir = join(projectRoot, 'data');
    outputPath = join(dataDir, filename);
  }

  writeFileSync(outputPath, csvContent, 'utf-8');
  console.log(`已將 ${places.length} 筆資料儲存至: ${outputPath}`);
}

/**
 * Parse HTML file and save all data to CSV in data directory
 */
export function parseAndSaveToCSV(
  htmlFilePath: string,
  csvFilename: string = 'new-taipei-parks.csv'
): void {
  const places = parseNewTaipeiParksHTML(htmlFilePath);
  if (places.length === 0) {
    console.warn('沒有找到任何公園資料');
    return;
  }
  
  // 存到 data 目錄
  const projectRoot = join(__dirname, '../../..');
  const dataDir = join(projectRoot, 'data');
  saveToCSV(places, csvFilename, dataDir);
}

/**
 * Scrape all pages from website and save to CSV
 */
export async function scrapeAllPagesAndSaveToCSV(
  csvFilename: string = 'new-taipei-parks.csv'
): Promise<void> {
  const places = await scrapeAllPagesFromWeb();
  if (places.length === 0) {
    console.warn('沒有找到任何公園資料');
    return;
  }
  
  // 存到 data 目錄
  const projectRoot = join(__dirname, '../../..');
  const dataDir = join(projectRoot, 'data');
  saveToCSV(places, csvFilename, dataDir);
}

/**
 * Parse New Taipei Parks CSV file
 */
interface NewTaipeiParksCSVRow {
  name: string;
  address: string;
  city: string;
  district: string;
  latitude: string;
  longitude: string;
  link?: string;
  playEquipment?: string;
  fitnessEquipment?: string;
  description?: string;
  imageLinks?: string;
  source: string;
  sourceId: string;
}

export function parseNewTaipeiParksCSV(filePath: string): ParsedPlace[] {
  if (!existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return [];
  }

  const fileContent = readFileSync(filePath, 'utf-8');

  const records: NewTaipeiParksCSVRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  const places: ParsedPlace[] = [];
  
  for (const row of records) {
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);

    // Skip invalid coordinates
    if (isNaN(lat) || isNaN(lng) || lat < 20 || lat > 26 || lng < 118 || lng > 123) {
      continue;
    }

    // 解析圖片連結（用分號分隔）
    const imageLinks = row.imageLinks 
      ? row.imageLinks.split(';').map(link => link.trim()).filter(link => link.length > 0)
      : [];

    const place: ParsedPlace = {
      name: row.name || '未命名公園',
      address: row.address || '',
      city: normalizeCityName(row.city),
      district: normalizeDistrictName(row.district),
      latitude: lat,
      longitude: lng,
      link: row.link || null,
      metadata: {
        playEquipment: row.playEquipment || '',
        fitnessEquipment: row.fitnessEquipment || '',
        description: row.description || '',
        imageLinks: imageLinks,
      },
      source: row.source || '新北市共融特色公園',
      sourceId: row.sourceId || `ntpc_park_${row.name}_${lat}_${lng}`,
    };
    
    places.push(place);
  }
  
  return places;
}
