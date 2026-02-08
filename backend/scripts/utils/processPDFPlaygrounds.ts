/**
 * PDF 處理工具
 * 從 PDF 檔案中提取設施資訊和圖片
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface Facility {
  equipment_name: string;
  image?: string;
}

/**
 * 從 PDF 文字內容中提取設施資訊
 * 
 * PDF 結構：
 * 1. 表格形式：
 *    - 「遊具設施內容」欄位：設施名稱（如「攀爬網」、「攀爬架」）
 *    - 「遊具設施照片」欄位：圖片
 *    - 「遊具設施相關說明」欄位：描述
 * 
 * 2. 「遊具設施內容、數量」行：
 *    - 格式：綜合遊戲組1組、滾輪滑梯1組、遊戲板4組...
 */
export function extractFacilitiesFromPDFText(pdfText: string): Facility[] {
  const facilities: Facility[] = [];
  
  // 方法1: 從「遊具設施內容、數量」行中提取（最可靠）
  // 注意：這一行可能被換行分割（如「遊具設施內\n容、數量」）
  // 先尋找「數量」關鍵字，然後向前找到「遊具設施」，向後提取設施列表
  const quantityIndex = pdfText.indexOf('數量');
  const contentQuantityIndex = pdfText.indexOf('內容、數');
  
  let facilityListText = '';
  
  if (quantityIndex >= 0) {
    // 向前查找「遊具設施」關鍵字（最多向前 100 字元）
    const beforeQuantity = pdfText.substring(Math.max(0, quantityIndex - 100), quantityIndex);
    if (beforeQuantity.includes('遊具設施')) {
      // 提取「數量」之後的內容，直到「周邊設施」或「主管機關」或「遊樂場資訊」
      const afterQuantity = pdfText.substring(quantityIndex);
      const facilityMatch = afterQuantity.match(/數量[：:]\s*([\s\S]*?)(?=周邊設施|主管機關|遊樂場資訊|$)/i);
      if (facilityMatch) {
        facilityListText = facilityMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }
  
  // 如果沒找到，嘗試從「內容、數」之後查找
  if (!facilityListText && contentQuantityIndex >= 0) {
    const beforeContentQuantity = pdfText.substring(Math.max(0, contentQuantityIndex - 50), contentQuantityIndex);
    if (beforeContentQuantity.includes('遊具設施')) {
      const afterContentQuantity = pdfText.substring(contentQuantityIndex);
      const quantityMatch = afterContentQuantity.match(/量[：:\s]*([\s\S]*?)(?=周邊設施|主管機關|遊樂場資訊|$)/i);
      if (quantityMatch) {
        facilityListText = quantityMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }
  
  // 如果還是沒找到，直接查找包含多個設施名稱的行（用「、」分隔）
  if (!facilityListText) {
    const lines = pdfText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    for (const line of lines) {
      // 檢查是否包含多個設施名稱（用「、」分隔，且包含設施關鍵字）
      if (line.includes('、') && 
          (line.includes('攀爬') || line.includes('滑梯') || line.includes('鞦韆') || 
           line.includes('旋轉') || line.includes('遊戲') || line.includes('傳聲'))) {
        // 排除明顯不是設施列表的行
        if (!line.match(/遊具設施|行政區|地址|適用對象|啟用日期|交通資訊|遮陽設施|休息區|沖洗區|輪椅|無障礙|哺乳室|育嬰室|對外開放|停車位|醫療院所|主管機關|聯繫窗口|遊樂場資訊|點閱數|資料更新|資料檢視|資料維護|周邊設施|照片|說明|內容|數量|組|面|片|個|座|項|頁|臺北市|內湖區|國民小學|政府|教育局/)) {
          facilityListText = line;
          break;
        }
      }
    }
  }
  
  if (facilityListText) {
    // 設施名稱通常以「、」或「，」分隔，且可能包含數量（如「X1組」、「1組」等）
    // 也可能包含「及」連接詞
    const parts = facilityListText.split(/[、，,]/);
    
    for (const part of parts) {
      // 移除數量資訊（如「X1組」、「1組」、「1面」等）
      let cleanName = part.replace(/[\d一二三四五六七八九十]+[個組面片座項]/g, '').trim();
      
      // 處理「及」連接詞（如「無障礙坡道及平台」）
      if (cleanName.includes('及')) {
        const subParts = cleanName.split('及');
        for (const subPart of subParts) {
          const finalName = subPart.trim();
          if (finalName && finalName.length >= 2 && finalName.length <= 30) {
            // 過濾掉明顯不是設施名稱的詞
            if (!finalName.match(/遊具設施|行政區|地址|適用對象|啟用日期|交通資訊|遮陽設施|休息區|沖洗區|輪椅|無障礙|哺乳室|育嬰室|對外開放|停車位|醫療院所|主管機關|聯繫窗口|遊樂場資訊|點閱數|資料更新|資料檢視|資料維護|周邊設施|主管機關|安全告示牌|太陽能|LED|燈|坡道|平台/)) {
              if (!facilities.some(f => f.equipment_name === finalName)) {
                facilities.push({
                  equipment_name: finalName,
                });
              }
            }
          }
        }
      } else {
        // 移除前後的空白和標點
        cleanName = cleanName.replace(/^[、，,。\s]+|[、，,。\s]+$/g, '');
        if (cleanName && cleanName.length >= 2 && cleanName.length <= 30) {
          // 過濾掉明顯不是設施名稱的詞
          if (!cleanName.match(/遊具設施|行政區|地址|適用對象|啟用日期|交通資訊|遮陽設施|休息區|沖洗區|輪椅|無障礙|哺乳室|育嬰室|對外開放|停車位|醫療院所|主管機關|聯繫窗口|遊樂場資訊|點閱數|資料更新|資料檢視|資料維護|周邊設施|主管機關|安全告示牌|太陽能|LED|燈|坡道|平台/)) {
            if (!facilities.some(f => f.equipment_name === cleanName)) {
              facilities.push({
                equipment_name: cleanName,
              });
            }
          }
        }
      }
    }
  }
  
  // 方法2: 如果方法1沒有找到，從表格中提取設施名稱
  if (facilities.length === 0) {
    const facilitySectionMatch = pdfText.match(/遊具設施內容[\s\S]*?(?=遊樂場資訊|周邊設施|主管機關|$)/i);
    if (facilitySectionMatch) {
      const facilityText = facilitySectionMatch[0];
      
      // 將文字按行分割
      const lines = facilityText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      
      const excludedKeywords = /遊具設施|行政區|地址|適用對象|啟用日期|交通資訊|遮陽設施|休息區|沖洗區|輪椅|無障礙|哺乳室|育嬰室|對外開放|停車位|醫療院所|主管機關|聯繫窗口|遊樂場資訊|點閱數|資料更新|資料檢視|資料維護|周邊設施|主管機關|照片|說明|內容|數量|組|面|片|個|座|項/;
      
      for (const line of lines) {
        // 跳過明顯不是設施名稱的行
        if (excludedKeywords.test(line)) {
          continue;
        }
        
        // 檢查是否是設施名稱（2-20 個中文字）
        const facilityNameMatch = line.match(/^([\u4e00-\u9fa5]{2,20})$/);
        if (facilityNameMatch) {
          const facilityName = facilityNameMatch[1];
          if (!facilities.some(f => f.equipment_name === facilityName)) {
            facilities.push({
              equipment_name: facilityName,
            });
          }
        }
      }
    }
  }
  
  return facilities;
}

/**
 * 從 PDF 中提取圖片並保存到檔案
 * 為每個國小創建獨立資料夾，並使用設施名稱作為檔名
 */
export async function extractImagesFromPDF(
  pdfPath: string,
  schoolName: string,
  facilities: Facility[],
  baseImageDir: string
): Promise<void> {
  // 為每個國小創建獨立資料夾
  const sanitizedSchoolName = schoolName.replace(/[\/\\:*?"<>|]/g, '_');
  const schoolImageDir = join(baseImageDir, sanitizedSchoolName);
  
  // 確保學校圖片目錄存在
  if (!existsSync(schoolImageDir)) {
    mkdirSync(schoolImageDir, { recursive: true });
  }
  
  try {
    // 方法1: 嘗試直接從 PDF 二進制流中提取圖片
    const pdfBuffer = readFileSync(pdfPath);
    const allImages: Array<{ data: Buffer; extension: string; pageNum: number }> = [];
    
    // 直接從 PDF 二進制數據中查找 JPEG 圖片（FF D8 FF）
    const pdfStr = pdfBuffer.toString('binary');
    const jpegStart = 0xFFD8; // JPEG 開始標記
    const jpegEnd = 0xFFD9; // JPEG 結束標記
    
    // 查找所有 JPEG 圖片
    let offset = 0;
    let imageIndex = 0;
    while (offset < pdfBuffer.length) {
      // 查找 JPEG 開始標記 (FF D8)
      const startIdx = pdfBuffer.indexOf(0xFF, offset);
      if (startIdx === -1) break;
      
      if (startIdx + 1 < pdfBuffer.length && pdfBuffer[startIdx + 1] === 0xD8) {
        // 找到 JPEG 開始，查找結束標記 (FF D9)
        let endIdx = startIdx + 2;
        while (endIdx < pdfBuffer.length - 1) {
          if (pdfBuffer[endIdx] === 0xFF && pdfBuffer[endIdx + 1] === 0xD9) {
            // 找到 JPEG 結束
            const jpegData = pdfBuffer.slice(startIdx, endIdx + 2);
            // 確保圖片大小合理（至少 1KB）
            if (jpegData.length > 1024) {
              allImages.push({
                data: jpegData,
                extension: 'jpg',
                pageNum: 0, // 無法確定頁碼，使用 0
              });
              imageIndex++;
            }
            offset = endIdx + 2;
            break;
          }
          endIdx++;
        }
        if (endIdx >= pdfBuffer.length - 1) break;
      } else {
        offset = startIdx + 1;
      }
    }
    
    // 如果直接提取失敗，嘗試使用 pdfjs-dist
    if (allImages.length === 0) {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = false;
      
      const uint8Array = new Uint8Array(pdfBuffer);
      const loadingTask = pdfjsLib.getDocument({ 
        data: uint8Array,
        useWorkerFetch: false,
        isEvalSupported: false,
        disableNativeImageDecoder: true,
      });
      const pdf = await loadingTask.promise;
      
      // 遍歷每一頁提取圖片
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const operatorList = await page.getOperatorList();
        
        // 先收集所有圖片名稱
        const imageNames = new Set<string>();
        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const op = operatorList.fnArray[i];
          const args = operatorList.argsArray[i];
          
          if (op === pdfjsLib.OPS.paintImageXObject || op === pdfjsLib.OPS.paintImageXObjectGroup) {
            const imageName = args[0];
            imageNames.add(imageName);
          }
        }
        
        // 預先加載所有圖片對象
        const imagePromises = Array.from(imageNames).map(async (imageName) => {
          try {
            const imageObj = await page.objs.get(imageName);
            return { imageName, imageObj };
          } catch (e) {
            return null;
          }
        });
        
        const loadedImages = await Promise.all(imagePromises);
        
        // 處理圖片數據
        for (const loaded of loadedImages) {
          if (!loaded || !loaded.imageObj) continue;
          
          const { imageObj } = loaded;
          
          try {
            let imageData: Buffer | null = null;
            let extension = 'png';
            
            // 方法1: 直接從 data 屬性獲取
            if (imageObj.data instanceof Uint8Array) {
              const header = Array.from(imageObj.data.slice(0, 4));
              if (header[0] === 0xFF && header[1] === 0xD8) {
                extension = 'jpg';
              } else if (header[0] === 0x89 && header[1] === 0x50) {
                extension = 'png';
              }
              imageData = Buffer.from(imageObj.data);
            } 
            // 方法2: 從 src 屬性獲取
            else if (imageObj.src && imageObj.src.startsWith('data:image')) {
              const base64Data = imageObj.src.split(',')[1];
              if (base64Data) {
                imageData = Buffer.from(base64Data, 'base64');
                if (imageObj.src.includes('jpeg') || imageObj.src.includes('jpg')) {
                  extension = 'jpg';
                }
              }
            }
            
            if (imageData && imageData.length > 0) {
              allImages.push({ data: imageData, extension, pageNum });
            }
          } catch (e) {
            // 忽略錯誤
          }
        }
      }
    }
    
    console.log(`  → 找到 ${allImages.length} 張圖片，${facilities.length} 個設施`);
    
    if (allImages.length > 0) {
      // 如果圖片數量與設施數量相同，按順序對應
      if (allImages.length === facilities.length) {
        for (let i = 0; i < facilities.length; i++) {
          const facility = facilities[i];
          const imageInfo = allImages[i];
          
          // 使用設施名稱作為檔名
          const sanitizedFacilityName = facility.equipment_name.replace(/[\/\\:*?"<>|]/g, '_');
          const filename = `${sanitizedFacilityName}.${imageInfo.extension}`;
          const filepath = join(schoolImageDir, filename);
          
          writeFileSync(filepath, imageInfo.data);
          
          // 更新設施的圖片路徑（相對路徑）
          facility.image = `image/${sanitizedSchoolName}/${filename}`;
          
          console.log(`    ✓ 保存圖片: ${filename}`);
        }
      } else {
        // 如果數量不匹配，按順序保存
        for (let i = 0; i < Math.min(allImages.length, facilities.length); i++) {
          const facility = facilities[i];
          const imageInfo = allImages[i];
          
          const sanitizedFacilityName = facility.equipment_name.replace(/[\/\\:*?"<>|]/g, '_');
          const filename = `${sanitizedFacilityName}.${imageInfo.extension}`;
          const filepath = join(schoolImageDir, filename);
          
          writeFileSync(filepath, imageInfo.data);
          facility.image = `image/${sanitizedSchoolName}/${filename}`;
          
          console.log(`    ✓ 保存圖片: ${filename}`);
        }
        
        // 如果有額外的圖片，使用索引命名
        for (let i = facilities.length; i < allImages.length; i++) {
          const imageInfo = allImages[i];
          const filename = `image_${i}.${imageInfo.extension}`;
          const filepath = join(schoolImageDir, filename);
          
          writeFileSync(filepath, imageInfo.data);
          console.log(`    ✓ 保存額外圖片: ${filename}`);
        }
      }
    }
  } catch (error) {
    console.error(`  提取 PDF 圖片時發生錯誤:`, error);
    // 不拋出錯誤，繼續執行
  }
}

/**
 * 處理單個 PDF 檔案
 */
export async function processPDFFile(
  pdfPath: string,
  schoolName: string,
  baseImageDir: string
): Promise<Facility[]> {
  // 讀取 PDF 並提取文字
  const pdfBuffer = readFileSync(pdfPath);
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const pdfParse = require('pdf-parse');
  const pdfData = await pdfParse(pdfBuffer);
  const pdfText = pdfData.text;
  
  // 提取設施資訊
  const facilities = extractFacilitiesFromPDFText(pdfText);
  
  // 提取圖片
  await extractImagesFromPDF(pdfPath, schoolName, facilities, baseImageDir);
  
  return facilities;
}
