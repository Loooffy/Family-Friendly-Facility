/**
 * 解析資料檔案並輸出樣本到 parsed_data 目錄
 * 用於檢查 parse 之後的欄位是否正確
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseNursingRoomsData } from '../backend/scripts/utils/parseNursingRooms.js';
import { parsePlaygroundsCSV, parseTaipeiPlaygroundsJSON } from '../backend/scripts/utils/parsePlaygrounds.js';
import { parseToiletsData } from '../backend/scripts/utils/parseToilets.js';
import { parseNewTaipeiParksCSV } from '../backend/scripts/utils/scrapeNewTaipeiParks.js';

// 在 ESM 模組中取得 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 輸出目錄
const OUTPUT_DIR = join(__dirname, 'parsed_data');

// 輸出樣本數量
const SAMPLE_SIZE = 5;

/**
 * 輸出樣本資料到 JSON 檔案
 */
function outputSample(data: unknown[], filename: string, description: string) {
  const sample = data.slice(0, SAMPLE_SIZE);
  const output = {
    description,
    totalCount: data.length,
    sampleSize: sample.length,
    sample,
  };

  const outputPath = join(OUTPUT_DIR, filename);
  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`✓ ${description}: 總共 ${data.length} 筆，已輸出 ${sample.length} 筆樣本到 ${filename}`);
}

async function main() {
  console.log('開始解析資料檔案...\n');

  try {
    // 1. 解析共融式遊戲場 CSV
    const playgroundsCSVPath = join(__dirname, '台北市共融式遊戲場.csv');
    const playgroundsCSV = parsePlaygroundsCSV(playgroundsCSVPath);
    outputSample(playgroundsCSV, 'taipei-inclusive-playgrounds-sample.json', '共融式遊戲場 (CSV)');

    // 2. 解析台北市兒童遊戲場 JSON
    const taipeiPlaygroundsPath = join(__dirname, '台北市兒童遊戲場.json');
    const taipeiPlaygrounds = parseTaipeiPlaygroundsJSON(taipeiPlaygroundsPath);
    outputSample(taipeiPlaygrounds, 'taipei-playgrounds-sample.json', '台北市兒童遊戲場 (JSON)');

    // 3. 解析新北市共融公園 CSV
    const newTaipeiParksCSVPath = join(__dirname, '新北市共融公園.csv');
    const newTaipeiParksCSV = parseNewTaipeiParksCSV(newTaipeiParksCSVPath);
    outputSample(newTaipeiParksCSV, 'new-taipei-parks-sample.json', '新北市共融公園 (CSV)');

    // 4. 解析親子廁所 JSON
    const toiletsPath = join(__dirname, '全國公廁建檔資料.json');
    const toilets = parseToiletsData(toiletsPath);
    outputSample(toilets, 'toilets-sample.json', '親子廁所 (JSON)');

    // 5. 解析依法設置哺集乳室 CSV
    const nursingRoomsMandatoryPath = join(__dirname, '全國依法設置哺集乳室名單(截至115年1月).csv');
    const nursingRoomsMandatory = parseNursingRoomsData(nursingRoomsMandatoryPath, '依法設置');
    outputSample(nursingRoomsMandatory, 'nursing-rooms-mandatory-sample.json', '哺集乳室-依法設置 (CSV)');

    // 6. 解析自願設置哺集乳室 CSV
    const nursingRoomsVoluntaryPath = join(__dirname, '全國自願設置哺集乳室名單(截至115年1月).csv');
    const nursingRoomsVoluntary = parseNursingRoomsData(nursingRoomsVoluntaryPath, '自願設置');
    outputSample(nursingRoomsVoluntary, 'nursing-rooms-voluntary-sample.json', '哺集乳室-自願設置 (CSV)');

    console.log('\n✓ 所有資料解析完成！');
    console.log(`樣本檔案已輸出到: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('解析過程中發生錯誤:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
