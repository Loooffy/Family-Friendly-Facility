#!/usr/bin/env node
/**
 * 新北市共融特色公園爬蟲腳本
 * 從網站爬取所有分頁並將資料存成 CSV
 */

import { scrapeAllPagesAndSaveToCSV } from './utils/scrapeNewTaipeiParks.js';

const csvFilename = '新北市共融公園.csv';

console.log('=== 新北市共融特色公園爬蟲 ===\n');
console.log('模式: 從網站爬取所有分頁（包含詳細資料）');
console.log(`輸出 CSV: data/${csvFilename}\n`);

async function main() {
  try {
    await scrapeAllPagesAndSaveToCSV(csvFilename);
    console.log('\n✓ 爬蟲執行完成！');
  } catch (error) {
    console.error('\n✗ 執行失敗:', error);
    process.exit(1);
  }
}

main();
