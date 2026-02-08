#!/usr/bin/env node
/**
 * 處理本地 PDF 檔案
 * 從 data/pdf 目錄中讀取 PDF 檔案，提取設施資訊和圖片
 */

import { existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { processPDFFile } from './utils/processPDFPlaygrounds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 主函數
 */
async function main() {
  const pdfDir = join(__dirname, '../../data/pdf');
  const imageDir = join(__dirname, '../../data/image');
  
  if (!existsSync(pdfDir)) {
    console.error(`PDF 目錄不存在: ${pdfDir}`);
    process.exit(1);
  }
  
  console.log('=== 處理本地 PDF 檔案 ===\n');
  console.log(`PDF 目錄: ${pdfDir}\n`);
  
  // 讀取所有 PDF 檔案
  const pdfFiles = readdirSync(pdfDir).filter(file => file.endsWith('.pdf'));
  
  if (pdfFiles.length === 0) {
    console.log('沒有找到 PDF 檔案');
    process.exit(0);
  }
  
  console.log(`找到 ${pdfFiles.length} 個 PDF 檔案：\n`);
  pdfFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  console.log('');
  
  // 處理每個 PDF 檔案
  for (let i = 0; i < pdfFiles.length; i++) {
    const pdfFile = pdfFiles[i];
    const pdfPath = join(pdfDir, pdfFile);
    
    // 從檔名提取學校名稱（移除 .pdf 副檔名）
    const schoolName = pdfFile.replace(/\.pdf$/, '');
    
    console.log(`[${i + 1}/${pdfFiles.length}] 處理: ${schoolName}`);
    console.log(`  PDF: ${pdfPath}`);
    
    try {
      const facilities = await processPDFFile(pdfPath, schoolName, imageDir);
      console.log(`  ✓ 找到 ${facilities.length} 個設施`);
      facilities.forEach(facility => {
        console.log(`    - ${facility.equipment_name}${facility.image ? ` (圖片: ${facility.image})` : ''}`);
      });
    } catch (error) {
      console.error(`  ✗ 處理失敗:`, error);
    }
    
    console.log('');
  }
  
  console.log(`\n✓ 完成！處理了 ${pdfFiles.length} 個 PDF 檔案`);
}

main().catch(error => {
  console.error('執行失敗:', error);
  process.exit(1);
});
