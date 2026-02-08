#!/usr/bin/env node
/**
 * 從台北市共融式遊戲場 CSV 中找出包含「國小」或「附小」的 row，
 * 然後訪問每個連結並提取詳細資料
 */

import { parse } from 'csv-parse/sync';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { extractFacilitiesFromPDFText, extractImagesFromPDF } from './utils/processPDFPlaygrounds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CSVRow {
  location: string;
  district: string;
  address: string;
  longitude: string;
  latitude: string;
  link: string;
}

interface Facility {
  equipment_name: string;
  image?: string;
}

interface PlaygroundData {
  location: string;
  district: string;
  address: string;
  longitude: string;
  latitude: string;
  link: string;
  facilities: Facility[];
}

/**
 * 從 HTML 連結字串中提取 URL
 */
function extractUrlFromLink(linkHtml: string): string | null {
  // 格式: <a target="_blank" href="URL">連結</a>
  const match = linkHtml.match(/href=["']([^"']+)["']/);
  return match ? match[1] : null;
}

/**
 * 從 HTML 內容中提取設施資訊
 * 參考 data/webpage/台北市共融式遊戲場-遊戲場資訊-軟橋公園.html 的結構
 * 
 * HTML 結構有兩種：
 * 1. 標準表格：
 *    <table>
 *      <thead><tr><th>遊具設施內容</th><th>遊具設施照片</th><th>遊具設施相關說明</th></tr></thead>
 *      <tbody>
 *        <tr><td>設施名稱</td><td>圖片</td><td>描述</td></tr>
 *      </tbody>
 *    </table>
 * 
 * 2. 非標準表格（在 tbody 中直接放置文字）：
 *    <table>
 *      <caption>遊具設施內容說明</caption>
 *      <tbody>
 *        設施名稱&nbsp;<p>描述</p>年齡限制
 *      </tbody>
 *    </table>
 */
function extractFacilitiesFromHTML(htmlContent: string): Facility[] {
  const facilities: Facility[] = [];
  
  // 尋找包含「遊具設施內容說明」或「遊具設施內容」的表格
  // 需要確保匹配到正確的表格，而不是「遊樂場資訊」或「周邊設施」表格
  
  // 方法1: 尋找標準表格結構（有 thead，且 thead 中包含「遊具設施內容」）
  // 匹配模式：遊具設施內容說明 -> thead -> tbody
  const standardTableMatch = htmlContent.match(/遊具設施內容說明[\s\S]*?<thead>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  if (standardTableMatch) {
    return extractFacilitiesFromTbody(standardTableMatch[1]);
  }
  
  // 方法2: 尋找標準表格結構（有 thead，且 thead 中包含「遊具設施內容」）
  const standardTableMatch2 = htmlContent.match(/遊具設施內容[\s\S]*?<thead>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  if (standardTableMatch2) {
    return extractFacilitiesFromTbody(standardTableMatch2[1]);
  }
  
  // 方法3: 尋找包含 caption 的表格（caption 包含「遊具設施內容說明」）
  const captionTableMatch = htmlContent.match(/<caption[^>]*>[\s\S]*?遊具設施內容說明[\s\S]*?<\/caption>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  if (captionTableMatch) {
    return extractFacilitiesFromTbody(captionTableMatch[1]);
  }
  
  // 方法4: 尋找包含「遊具設施內容說明」的表格（在 tbody 之前）
  // 但要排除「遊樂場資訊」和「周邊設施」表格
  // 優先匹配標準表格結構（包含 <td> 標籤的）
  const tableMatches = Array.from(htmlContent.matchAll(/遊具設施內容說明[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/g));
  
  // 先嘗試標準表格結構（包含 <td> 標籤和 data-title 屬性）
  for (const match of tableMatches) {
    const tbodyContent = match[1];
    // 檢查是否包含標準的 <td> 結構（有 data-title="遊具設施內容" 屬性）
    if (tbodyContent.includes('<td') && tbodyContent.includes('data-title="遊具設施內容"')) {
      const extracted = extractFacilitiesFromTbody(tbodyContent);
      // 確保提取到的設施名稱都包含中文（過濾掉空白字符）
      const validFacilities = extracted.filter(f => 
        f.equipment_name && 
        /[\u4e00-\u9fa5]/.test(f.equipment_name) &&
        f.equipment_name.trim().length > 0
      );
      if (validFacilities.length > 0) {
        return validFacilities;
      }
    }
  }
  
  // 如果標準表格沒有找到，再嘗試其他結構（包含 <td> 但沒有 data-title）
  for (const match of tableMatches) {
    const tbodyContent = match[1];
    // 檢查是否包含 <td> 標籤（標準表格結構）
    if (tbodyContent.includes('<td')) {
      const extracted = extractFacilitiesFromTbody(tbodyContent);
      // 確保提取到的設施名稱都包含中文（過濾掉空白字符）
      const validFacilities = extracted.filter(f => 
        f.equipment_name && 
        /[\u4e00-\u9fa5]/.test(f.equipment_name) &&
        f.equipment_name.trim().length > 0
      );
      if (validFacilities.length > 0) {
        return validFacilities;
      }
    }
  }
  
  // 最後嘗試非標準結構
  for (const match of tableMatches) {
    const tbodyContent = match[1];
    const extracted = extractFacilitiesFromTbody(tbodyContent);
    // 確保提取到的設施名稱都包含中文（過濾掉空白字符）
    const validFacilities = extracted.filter(f => 
      f.equipment_name && 
      /[\u4e00-\u9fa5]/.test(f.equipment_name) &&
      f.equipment_name.trim().length > 0
    );
    if (validFacilities.length > 0) {
      return validFacilities;
    }
  }
  
  return facilities;
}

/**
 * 從 tbody 內容中提取設施資訊
 * 支援兩種 HTML 結構：
 * 1. 標準表格結構：<tr><td>設施名稱</td><td>圖片</td><td>描述</td></tr>
 * 2. 非標準結構：設施名稱&nbsp;<p>描述</p>年齡限制
 */
function extractFacilitiesFromTbody(tbodyContent: string): Facility[] {
  const facilities: Facility[] = [];
  
  // 方法1: 嘗試從標準表格結構中提取（<tr><td>...）
  const trMatches = Array.from(tbodyContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g));
  for (const trMatch of trMatches) {
    const trContent = trMatch[1];
    
    // 跳過表頭行（包含 <th> 標籤的行）
    if (trContent.includes('<th')) {
      continue;
    }
    
    // 檢查是否是 colspan 行（通常是表頭或說明行），跳過
    if (trContent.includes('colspan')) {
      continue;
    }
    
    // 提取所有 <td> 標籤的內容
    const tdMatches = Array.from(trContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g));
    
    if (tdMatches.length >= 1) {
      // 第一個 <td> 通常是設施名稱
      const nameTd = tdMatches[0][1];
      // 移除 HTML 標籤、HTML 實體，並清理空白字符
      let facilityName = nameTd
        .replace(/<[^>]+>/g, '') // 移除 HTML 標籤
        .replace(/&nbsp;/g, ' ') // 替換 &nbsp;
        .replace(/&[a-z]+;/gi, ' ') // 移除其他 HTML 實體
        .replace(/[\r\n\t]/g, ' ') // 移除換行符和製表符
        .replace(/\s+/g, ' ') // 將多個空白字符合併為一個
        .trim();
      
      // 跳過表頭或其他非設施名稱的內容
      // 設施名稱應該：
      // 1. 不包含這些關鍵字
      // 2. 長度適中（1-50 字元）
      // 3. 不是純數字或日期格式
      // 4. 不是地址開頭
      // 5. 不是表頭（如「遊具設施內容說明」）
      // 6. 必須包含至少一個中文字（設施名稱通常是中文）
      if (facilityName && 
          facilityName.length > 1 && 
          facilityName.length < 50 &&
          /[\u4e00-\u9fa5]/.test(facilityName) && // 必須包含至少一個中文字
          !facilityName.match(/遊具設施|行政區|地址|適用對象|啟用日期|交通資訊|遮陽設施|休息區|沖洗區|輪椅|無障礙|哺乳室|育嬰室|對外開放|停車位|醫療院所|主管機關|聯繫窗口|遊樂場資訊|點閱數|資料更新|資料檢視|資料維護|周邊設施|主管機關/) &&
          !facilityName.match(/^\d+\.\d+$/) && // 排除純數字（如座標）
          !facilityName.match(/^\d{3,4}\.\d+$/) && // 排除日期格式（如 107.7）
          !facilityName.match(/^臺北市/) && // 排除地址開頭
          !facilityName.match(/^\d+歲/) && // 排除年齡限制
          !facilityName.match(/適用對象/)) { // 排除適用對象
        
        const facility: Facility = {
          equipment_name: facilityName,
        };
        
        // 第二個 <td> 可能包含圖片
        if (tdMatches.length >= 2) {
          const imgTd = tdMatches[1][1];
          const imgMatch = imgTd.match(/src=["']([^"']+)["']/);
          if (imgMatch) {
            facility.image = imgMatch[1];
          }
        }
        
        facilities.push(facility);
      }
    }
  }
  
  // 方法2: 如果標準表格結構沒有找到設施，嘗試非標準結構
  // 這種情況下，設施名稱和描述直接放在 tbody 中，沒有 <tr><td> 包裝
  if (facilities.length === 0) {
    // 先嘗試從文字中提取設施名稱
    // 設施名稱通常出現在描述之前，且描述通常包含「適用」或年齡限制
    
    // 移除所有 HTML 標籤，但保留文字內容
    const textContent = tbodyContent
      .replace(/<img[^>]*>/g, ' ') // 移除圖片標籤
      .replace(/<[^>]+>/g, ' ') // 移除其他 HTML 標籤
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/gi, ' ') // 移除 HTML 實體
      .replace(/\s+/g, ' ')
      .trim();
    
    // 嘗試匹配設施名稱模式
    // 設施名稱通常：
    // 1. 是中文詞組（2-20 個字）
    // 2. 後面跟著描述（通常包含「適用」或年齡限制）
    // 3. 下一個設施名稱前可能有年齡限制或「適用」關鍵字
    
    // 使用正則表達式匹配設施名稱
    // 模式：設施名稱（可能重複）+ 描述（以「適用」結尾）
    // 設施名稱通常會重複出現（例如：向日葵魔法陣滾輪滑梯向日葵魔法陣滾輪滑梯可以讓...）
    // 我們需要找到重複的設施名稱，然後提取第一個
    
    const foundFacilities: string[] = [];
    
    // 先找到所有「適用」的位置，這些是設施描述的結尾
    const applicableMatches = Array.from(textContent.matchAll(/適用[^。]*?\)/g));
    
    if (applicableMatches.length > 0) {
      let lastIndex = 0;
      
      for (let i = 0; i < applicableMatches.length; i++) {
        const match = applicableMatches[i];
        const endIndex = match.index! + match[0].length;
        
        // 從上一個設施結束位置到當前設施結束位置之間提取設施名稱
        const facilityText = textContent.substring(lastIndex, endIndex);
        
        // 設施名稱通常在描述之前，且可能重複
        // 嘗試匹配：設施名稱（2-30字）+ 設施名稱（重複）+ 描述關鍵字（可以讓、利用、設計、規劃等）
        const nameMatch = facilityText.match(/^([\u4e00-\u9fa5]{2,30}?)(?:\1)?(?:可以讓|利用|設計|規劃|提供|讓|讓學童|讓坐|提供學童)/);
        
        if (nameMatch) {
          const facilityName = nameMatch[1].trim();
          // 過濾掉明顯不是設施名稱的詞
          if (facilityName && 
              facilityName.length >= 2 && 
              facilityName.length <= 30 &&
              !facilityName.match(/遊具設施|行政區|地址|適用對象|啟用日期|交通資訊|遮陽設施|休息區|沖洗區|輪椅|無障礙|哺乳室|育嬰室|對外開放|停車位|醫療院所|主管機關|聯繫窗口|遊樂場資訊|點閱數|資料更新|資料檢視|資料維護|周邊設施|主管機關/)) {
            foundFacilities.push(facilityName);
          }
        } else {
          // 如果沒有匹配到重複模式，嘗試直接匹配設施名稱
          // 設施名稱通常在文本開頭，後面跟著描述
          const simpleMatch = facilityText.match(/^([\u4e00-\u9fa5]{2,30}?)(?:可以讓|利用|設計|規劃|提供|讓|讓學童|讓坐|提供學童)/);
          if (simpleMatch) {
            const facilityName = simpleMatch[1].trim();
            if (facilityName && 
                facilityName.length >= 2 && 
                facilityName.length <= 30 &&
                !facilityName.match(/遊具設施|行政區|地址|適用對象|啟用日期|交通資訊|遮陽設施|休息區|沖洗區|輪椅|無障礙|哺乳室|育嬰室|對外開放|停車位|醫療院所|主管機關|聯繫窗口|遊樂場資訊|點閱數|資料更新|資料檢視|資料維護|周邊設施|主管機關/)) {
              foundFacilities.push(facilityName);
            }
          }
        }
        
        lastIndex = endIndex;
      }
    }
    
    // 如果找到設施名稱，添加到結果中
    for (const name of foundFacilities) {
      // 嘗試從原始 HTML 中提取圖片（如果有的話）
      const facility: Facility = {
        equipment_name: name,
      };
      
      // 在 tbody 中尋找包含設施名稱的區域，看看是否有圖片
      const nameIndex = tbodyContent.indexOf(name);
      if (nameIndex >= 0) {
        const surroundingText = tbodyContent.substring(Math.max(0, nameIndex - 500), nameIndex + 500);
        const imgMatch = surroundingText.match(/src=["']([^"']+)["']/);
        if (imgMatch) {
          facility.image = imgMatch[1];
        }
      }
      
      facilities.push(facility);
    }
    
    // 如果還是沒有找到，嘗試更簡單的方法：按行分割
    if (facilities.length === 0) {
      const lines = tbodyContent.split(/\n/);
      let currentFacility: Partial<Facility> | null = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 跳過空行
        if (!line) {
          continue;
        }
        
        // 檢查是否有圖片
        if (line.includes('<img')) {
          const imgMatch = line.match(/src=["']([^"']+)["']/);
          if (imgMatch && currentFacility) {
            currentFacility.image = imgMatch[1];
          }
          continue;
        }
        
        // 檢查是否是年齡限制行（格式：2-12歲為原則...）
        if (line.match(/\d+[-~]\d+歲/)) {
          // 年齡限制行表示一個設施的結束
          if (currentFacility && currentFacility.equipment_name) {
            facilities.push(currentFacility as Facility);
            currentFacility = null;
          }
          continue;
        }
        
        // 檢查是否是 <p> 標籤（描述）
        if (line.includes('<p>')) {
          continue;
        }
        
        // 移除 HTML 標籤和 &nbsp;
        const cleanLine = line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
        
        // 如果這行看起來像設施名稱
        if (cleanLine && 
            !cleanLine.match(/\d+[-~]\d+歲/) &&
            cleanLine.length > 1 && 
            cleanLine.length < 50 &&
            !line.includes('<p>') &&
            !cleanLine.match(/遊具設施|行政區|地址|適用對象|啟用日期|交通資訊|遮陽設施|休息區|沖洗區|輪椅|無障礙|哺乳室|育嬰室|對外開放|停車位|醫療院所|主管機關|聯繫窗口/)) {
          
          // 如果上一個設施還沒完成，先保存它
          if (currentFacility && currentFacility.equipment_name) {
            facilities.push(currentFacility as Facility);
          }
          
          // 開始新的設施
          currentFacility = {
            equipment_name: cleanLine,
          };
        }
      }
      
      // 保存最後一個設施
      if (currentFacility && currentFacility.equipment_name) {
        facilities.push(currentFacility as Facility);
      }
    }
  }
  
  return facilities;
}

/**
 * 從 URL 獲取 HTML 內容
 */
async function fetchHTML(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

/**
 * 從 URL 下載 PDF 並提取文字內容
 */
async function fetchPDFText(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 動態導入 pdf-parse (CommonJS 模組)
    // pdf-parse 使用 createRequire 來處理 CommonJS 模組
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error(`Error fetching PDF ${url}:`, error);
    throw error;
  }
}

/**
 * 從 URL 下載 PDF 並返回 Buffer
 */
async function fetchPDFBuffer(url: string): Promise<Buffer> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Error fetching PDF ${url}:`, error);
    throw error;
  }
}

/**
 * 獲取或下載 PDF，如果本地已有則直接讀取，否則下載並保存
 */
async function getOrDownloadPDF(url: string, schoolName: string, pdfDir: string): Promise<Buffer> {
  // 確保 PDF 目錄存在
  if (!existsSync(pdfDir)) {
    mkdirSync(pdfDir, { recursive: true });
  }
  
  // 生成檔名：{小學名稱}.pdf
  const sanitizedSchoolName = schoolName.replace(/[\/\\:*?"<>|]/g, '_');
  const pdfPath = join(pdfDir, `${sanitizedSchoolName}.pdf`);
  
  // 檢查本地是否已有 PDF
  if (existsSync(pdfPath)) {
    console.log(`  → 使用本地 PDF: ${pdfPath}`);
    return readFileSync(pdfPath);
  }
  
  // 下載 PDF
  console.log(`  → 下載 PDF 並保存到: ${pdfPath}`);
  const buffer = await fetchPDFBuffer(url);
  
  // 保存到本地
  writeFileSync(pdfPath, buffer);
  console.log(`  ✓ PDF 已保存`);
  
  return buffer;
}

// extractImagesFromPDF 和 extractFacilitiesFromPDFText 函數已移至 utils/processPDFPlaygrounds.ts

/**
 * 從 HTML 中提取 PDF 連結
 */
function extractPDFLink(htmlContent: string): string | null {
  // 尋找 PDF 連結（通常在「相關檔案」區塊中）
  const pdfMatch = htmlContent.match(/href=["']([^"']*Download\.ashx[^"']*\.pdf[^"']*)["']/i);
  if (pdfMatch) {
    // 解碼 HTML 實體
    let url = pdfMatch[1].replace(/&amp;/g, '&');
    // 如果是相對路徑，補上基礎 URL
    if (url.startsWith('/')) {
      url = 'https://www-ws.gov.taipei' + url;
    } else if (!url.startsWith('http')) {
      url = 'https://www-ws.gov.taipei/' + url;
    }
    return url;
  }
  return null;
}

// PDF 處理函數已移至 utils/processPDFPlaygrounds.ts

/**
 * 主函數
 */
async function main() {
  const csvPath = join(__dirname, '../../data/台北市共融式遊戲場.csv');
  
  if (!existsSync(csvPath)) {
    console.error(`CSV 檔案不存在: ${csvPath}`);
    process.exit(1);
  }
  
  console.log('=== 台北市國小/附小共融式遊戲場詳細資料爬蟲 ===\n');
  console.log(`讀取 CSV: ${csvPath}\n`);
  
  // 讀取 CSV
  const csvContent = readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  
  // 處理 BOM 字符，正規化欄位名稱
  const normalizedRecords = records.map(record => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      // 移除 BOM 字符和空白
      const normalizedKey = key.replace(/^\uFEFF/, '').trim();
      normalized[normalizedKey] = value;
    }
    return normalized as CSVRow;
  });
  
  console.log(`總共 ${normalizedRecords.length} 筆資料\n`);
  
  // 找出包含「國小」或「附小」的 row
  const schoolRows = normalizedRecords.filter(row => {
    const location = row.location || '';
    return location.includes('國小') || location.includes('附小');
  });
  
  console.log(`找到 ${schoolRows.length} 筆包含「國小」或「附小」的資料：\n`);
  schoolRows.forEach((row, index) => {
    console.log(`${index + 1}. ${row.location} (${row.district})`);
  });
  console.log('');
  
  // 提取每個 row 的 link 並訪問
  const results: PlaygroundData[] = [];
  
  for (let i = 0; i < schoolRows.length; i++) {
    const row = schoolRows[i];
    const url = extractUrlFromLink(row.link);
    
    if (!url) {
      console.warn(`[${i + 1}/${schoolRows.length}] 無法提取 URL: ${row.location}`);
      continue;
    }
    
    console.log(`[${i + 1}/${schoolRows.length}] 處理: ${row.location}`);
    console.log(`  URL: ${url}`);
    
    try {
      // 訪問 URL 並獲取 HTML
      const htmlContent = await fetchHTML(url);
      
      // 先嘗試從 HTML 中提取設施資訊
      let facilities = extractFacilitiesFromHTML(htmlContent);
      
      // 如果沒有找到設施，檢查是否有 PDF 檔案
      if (facilities.length === 0) {
        const pdfLink = extractPDFLink(htmlContent);
        if (pdfLink) {
          console.log(`  → 發現 PDF 檔案，嘗試從 PDF 提取設施資訊...`);
          try {
            // 獲取或下載 PDF（優先使用本地緩存）
            const pdfDir = join(__dirname, '../../data/pdf');
            const pdfBuffer = await getOrDownloadPDF(pdfLink, row.location, pdfDir);
            
            // 從 PDF 提取文字內容
            const { createRequire } = await import('module');
            const require = createRequire(import.meta.url);
            const pdfParse = require('pdf-parse');
            const pdfData = await pdfParse(pdfBuffer);
            const pdfText = pdfData.text;
            
            facilities = extractFacilitiesFromPDFText(pdfText);
            console.log(`  ✓ 從 PDF 中找到 ${facilities.length} 個設施`);
            
            // 從 PDF 中提取圖片並保存到對應的資料夾
            console.log(`  → 提取 PDF 中的圖片...`);
            const sanitizedSchoolName = row.location.replace(/[\/\\:*?"<>|]/g, '_');
            const pdfPath = join(pdfDir, `${sanitizedSchoolName}.pdf`);
            const baseImageDir = join(__dirname, '../../data/image');
            await extractImagesFromPDF(pdfPath, row.location, facilities, baseImageDir);
          } catch (pdfError) {
            console.error(`  ✗ PDF 處理失敗:`, pdfError);
          }
        }
      } else {
        console.log(`  ✓ 找到 ${facilities.length} 個設施`);
      }
      
      facilities.forEach(facility => {
        console.log(`    - ${facility.equipment_name}`);
      });
      
      results.push({
        location: row.location,
        district: row.district,
        address: row.address,
        longitude: row.longitude,
        latitude: row.latitude,
        link: url,
        facilities,
      });
      
      // 避免請求過快
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ✗ 處理失敗:`, error);
    }
    
    console.log('');
  }
  
  // 儲存結果
  const outputPath = join(__dirname, '../../data/台北市國小附小遊戲場詳細資料.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  
  console.log(`\n✓ 完成！結果已儲存至: ${outputPath}`);
  console.log(`總共處理 ${results.length} 筆資料`);
}

main().catch(error => {
  console.error('執行失敗:', error);
  process.exit(1);
});
