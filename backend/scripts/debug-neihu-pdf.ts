#!/usr/bin/env node
/**
 * 臨時程式：專門用來解析內湖國小 PDF
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Facility {
  equipment_name: string;
  image?: string;
}

async function main() {
  const pdfPath = join(__dirname, '../../data/pdf/內湖國小.pdf');
  
  console.log('正在解析內湖國小 PDF...');
  console.log('PDF 路徑:', pdfPath);
  
  // 讀取 PDF
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const pdfParse = require('pdf-parse');
  const pdfBuffer = readFileSync(pdfPath);
  const pdfData = await pdfParse(pdfBuffer);
  const pdfText = pdfData.text;
  
  console.log('\n=== PDF 基本資訊 ===');
  console.log('頁數:', pdfData.numpages);
  console.log('文字長度:', pdfText.length);
  
  // 將文字保存到檔案以便檢查
  const debugTextPath = join(__dirname, '../../data/debug-neihu-text.txt');
  writeFileSync(debugTextPath, pdfText, 'utf-8');
  console.log('\n已將 PDF 文字內容保存到:', debugTextPath);
  
  // 查找關鍵字
  console.log('\n=== 關鍵字搜尋 ===');
  const keywords = [
    '遊具設施',
    '設施內容',
    '設施名稱',
    '遊具',
    '數量',
    '攀爬',
    '滑梯',
    '鞦韆',
    '傳聲',
    '遊戲',
    '共融',
  ];
  
  for (const keyword of keywords) {
    const index = pdfText.indexOf(keyword);
    if (index >= 0) {
      const context = pdfText.substring(Math.max(0, index - 50), Math.min(pdfText.length, index + 100));
      console.log(`\n找到 "${keyword}":`);
      console.log('  位置:', index);
      console.log('  上下文:', context.replace(/\n/g, '\\n'));
    }
  }
  
  // 嘗試提取設施名稱
  console.log('\n=== 嘗試提取設施名稱 ===');
  const facilities: Facility[] = [];
  
  // 方法1: 查找「遊具設施內容、數量」相關的行（處理換行分割的情況）
  // 先找到「數量」或「內容、數」關鍵字
  const quantityIndex = pdfText.indexOf('數量');
  const contentQuantityIndex = pdfText.indexOf('內容、數');
  
  console.log('\n「數量」關鍵字位置:', quantityIndex);
  console.log('「內容、數」關鍵字位置:', contentQuantityIndex);
  
  // 查找設施列表（可能在「數量」或「內容、數」之後）
  let facilityListText = '';
  
  if (quantityIndex >= 0) {
    // 向前查找「遊具設施」（最多向前 100 字元）
    const beforeQuantity = pdfText.substring(Math.max(0, quantityIndex - 100), quantityIndex);
    
    if (beforeQuantity.includes('遊具設施')) {
      // 提取「數量」之後的內容，直到「周邊設施」或「主管機關」
      const afterQuantity = pdfText.substring(quantityIndex);
      const facilityMatch = afterQuantity.match(/數量[：:]\s*([\s\S]*?)(?=周邊設施|主管機關|遊樂場資訊|$)/i);
      
      if (facilityMatch) {
        facilityListText = facilityMatch[1]
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
  }
  
  // 如果沒找到，嘗試從「內容、數」之後查找
  if (!facilityListText && contentQuantityIndex >= 0) {
    const beforeContentQuantity = pdfText.substring(Math.max(0, contentQuantityIndex - 50), contentQuantityIndex);
    
    if (beforeContentQuantity.includes('遊具設施')) {
      // 提取「內容、數」之後的內容
      const afterContentQuantity = pdfText.substring(contentQuantityIndex);
      // 查找「量」之後的內容
      const quantityMatch = afterContentQuantity.match(/量[：:\s]*([\s\S]*?)(?=周邊設施|主管機關|遊樂場資訊|$)/i);
      
      if (quantityMatch) {
        facilityListText = quantityMatch[1]
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
  }
  
  // 如果還是沒找到，直接查找包含多個設施名稱的行（用「、」分隔）
  if (!facilityListText) {
    // 查找包含「攀爬」、「滑梯」、「鞦韆」等關鍵字且用「、」分隔的行
    const lines = pdfText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    
    for (const line of lines) {
      // 檢查是否包含多個設施名稱（用「、」分隔，且包含設施關鍵字）
      if (line.includes('、') && 
          (line.includes('攀爬') || line.includes('滑梯') || line.includes('鞦韆') || 
           line.includes('旋轉') || line.includes('遊戲'))) {
        // 排除明顯不是設施列表的行
        if (!line.match(/遊具設施|行政區|地址|適用對象|啟用日期|交通資訊|遮陽設施|休息區|沖洗區|輪椅|無障礙|哺乳室|育嬰室|對外開放|停車位|醫療院所|主管機關|聯繫窗口|遊樂場資訊|點閱數|資料更新|資料檢視|資料維護|周邊設施|照片|說明|內容|數量|組|面|片|個|座|項|頁|臺北市|內湖區|國民小學|政府|教育局/)) {
          facilityListText = line;
          console.log('\n找到可能的設施列表行:', facilityListText);
          break;
        }
      }
    }
  }
  
  if (facilityListText) {
    console.log('\n找到設施列表:', facilityListText);
    
    // 設施名稱以「、」分隔
    const parts = facilityListText.split(/[、，,]/).map(p => p.trim()).filter(p => p);
    console.log('\n分割後的設施名稱:');
    
    for (const part of parts) {
      console.log(`  - "${part}"`);
      
      // 清理名稱（移除數量資訊）
      let cleanName = part
        .replace(/[\d一二三四五六七八九十]+[個組面片座項]/g, '')
        .trim();
      
      if (cleanName && cleanName.length >= 2 && cleanName.length <= 30) {
        if (!facilities.some(f => f.equipment_name === cleanName)) {
          facilities.push({ equipment_name: cleanName });
        }
      }
    }
  }
  
  // 如果已經從設施列表中提取到設施，就不需要再從其他地方提取了
  if (facilities.length > 0) {
    console.log('\n已從設施列表中提取到設施，跳過其他提取方法');
  } else {
    console.log('\n方法1未找到設施，嘗試從表格中提取...');
    
    // 查找表格區域（「遊具設施內容」到「遊樂場資訊」之間）
    const tableMatch = pdfText.match(/遊具設施內容[\s\S]*?(?=遊樂場資訊|周邊設施|主管機關|$)/i);
    if (tableMatch) {
      const tableText = tableMatch[0];
      console.log('表格區域:', tableText.substring(0, 300));
      
      // 提取表格中的設施名稱（通常是單獨一行，2-10 個中文字）
      const tableLines = tableText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      
      for (const line of tableLines) {
        // 檢查是否是設施名稱（純中文，2-15 個字）
        if (/^[\u4e00-\u9fa5]{2,15}$/.test(line)) {
          // 排除明顯不是設施名稱的詞
          if (!line.match(/遊具設施|行政區|地址|適用對象|啟用日期|交通資訊|遮陽設施|休息區|沖洗區|輪椅|無障礙|哺乳室|育嬰室|對外開放|停車位|醫療院所|主管機關|聯繫窗口|遊樂場資訊|點閱數|資料更新|資料檢視|資料維護|周邊設施|照片|說明|內容|數量|組|面|片|個|座|項|頁|臺北市|內湖區|國民小學|政府|教育局/)) {
            if (!facilities.some(f => f.equipment_name === line)) {
              facilities.push({ equipment_name: line });
            }
          }
        }
      }
    }
  }
  
  // 過濾掉明顯不是設施的名稱
  const validFacilities = facilities.filter(f => {
    const name = f.equipment_name;
    // 排除太長或太短的名稱
    if (name.length < 2 || name.length > 20) return false;
    // 排除包含明顯不是設施名稱的詞
    if (name.match(/臺北市|內湖區|國民小學|政府|教育局|學校位置圖|藉由|進行|中央|不同|旋轉盤更|作，|合，|覺，|觸覺|視覺|聽覺|感統|探索|挑戰|訓練|鍛鍊|訓練|提供|促進|增進|發展|穩定|刺激|協調|能力|力量|肌肉|重力|斜面|平衡|手眼|四肢|個體|距離|安全|身體|控制|速度|高度|幅度|擺盪|前庭|情緒|社交|功能|合作|協力|轉動|人際|關係/)) {
      return false;
    }
    // 必須包含設施相關的關鍵字
    const facilityKeywords = ['攀爬', '滑梯', '鞦韆', '傳聲', '遊戲', '平衡', '搖擺', '旋轉', '音樂', '觸覺', '視覺', '聽覺', '感統', '探索', '挑戰', '訓練', '網', '架', '版', '盤', '管', '螺旋', '三維', '抿石子', '鳥巢'];
    return facilityKeywords.some(kw => name.includes(kw));
  });
  
  console.log('\n過濾後的設施:');
  for (const facility of validFacilities) {
    console.log(`  - ${facility.equipment_name}`);
  }
  
  // 更新設施列表
  facilities.length = 0;
  facilities.push(...validFacilities);
  
  console.log('\n=== 提取結果 ===');
  console.log(`找到 ${facilities.length} 個設施:`);
  for (const facility of facilities) {
    console.log(`  - ${facility.equipment_name}`);
  }
  
  // 保存結果
  const resultPath = join(__dirname, '../../data/debug-neihu-result.json');
  writeFileSync(resultPath, JSON.stringify(facilities, null, 2), 'utf-8');
  console.log('\n結果已保存到:', resultPath);
}

main().catch(error => {
  console.error('錯誤:', error);
  process.exit(1);
});
