"""
PDF 處理工具
從 PDF 檔案中提取設施資訊和圖片
"""

import re
import os
from pathlib import Path
from typing import List, Dict, Any, Optional

try:
    import pdfplumber
    PDF_PLUMBER_AVAILABLE = True
except ImportError:
    PDF_PLUMBER_AVAILABLE = False

try:
    from PyPDF2 import PdfReader
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False


class Facility:
    """設施資料"""
    def __init__(self, equipment_name: str, image: Optional[str] = None):
        self.equipment_name = equipment_name
        self.image = image

    def to_dict(self) -> Dict[str, Any]:
        """轉換為字典格式"""
        return {
            'equipmentName': self.equipment_name,
            'imageUrl': self.image,
        }


def extract_facilities_from_pdf_text(pdf_text: str) -> List[Facility]:
    """
    從 PDF 文字內容中提取設施資訊
    
    PDF 結構：
    1. 表格形式：
       - 「遊具設施內容」欄位：設施名稱（如「攀爬網」、「攀爬架」）
       - 「遊具設施照片」欄位：圖片
       - 「遊具設施相關說明」欄位：描述
    
    2. 「遊具設施內容、數量」行：
       - 格式：綜合遊戲組1組、滾輪滑梯1組、遊戲板4組...
    """
    facilities = []

    # 方法1: 從「遊具設施內容、數量」行中提取（最可靠）
    quantity_index = pdf_text.find('數量')
    content_quantity_index = pdf_text.find('內容、數')

    facility_list_text = ''

    if quantity_index >= 0:
        # 向前查找「遊具設施」關鍵字（最多向前 100 字元）
        before_quantity = pdf_text[max(0, quantity_index - 100):quantity_index]
        if '遊具設施' in before_quantity:
            # 提取「數量」之後的內容，直到「周邊設施」或「主管機關」或「遊樂場資訊」
            after_quantity = pdf_text[quantity_index:]
            facility_match = re.search(r'數量[：:\s]*([\s\S]*?)(?=周邊設施|主管機關|遊樂場資訊|$)', after_quantity, re.IGNORECASE)
            if facility_match:
                facility_list_text = re.sub(r'\s+', ' ', facility_match.group(1).replace('\n', ' ')).strip()

    # 如果沒找到，嘗試從「內容、數」之後查找
    if not facility_list_text and content_quantity_index >= 0:
        before_content_quantity = pdf_text[max(0, content_quantity_index - 50):content_quantity_index]
        if '遊具設施' in before_content_quantity:
            after_content_quantity = pdf_text[content_quantity_index:]
            quantity_match = re.search(r'量[：:\s]*([\s\S]*?)(?=周邊設施|主管機關|遊樂場資訊|$)', after_content_quantity, re.IGNORECASE)
            if quantity_match:
                facility_list_text = re.sub(r'\s+', ' ', quantity_match.group(1).replace('\n', ' ')).strip()

    # 如果還是沒找到，直接查找包含多個設施名稱的行（用「、」分隔）
    if not facility_list_text:
        lines = [l.strip() for l in pdf_text.split('\n') if l.strip()]
        for line in lines:
            # 檢查是否包含多個設施名稱（用「、」分隔，且包含設施關鍵字）
            if '、' in line and any(keyword in line for keyword in ['攀爬', '滑梯', '鞦韆', '旋轉', '遊戲', '傳聲']):
                # 排除明顯不是設施列表的行
                excluded_keywords = [
                    '遊具設施', '行政區', '地址', '適用對象', '啟用日期', '交通資訊',
                    '遮陽設施', '休息區', '沖洗區', '輪椅', '無障礙', '哺乳室', '育嬰室',
                    '對外開放', '停車位', '醫療院所', '主管機關', '聯繫窗口', '遊樂場資訊',
                    '點閱數', '資料更新', '資料檢視', '資料維護', '周邊設施', '照片', '說明',
                    '內容', '數量', '組', '面', '片', '個', '座', '項', '頁', '臺北市',
                    '內湖區', '國民小學', '政府', '教育局'
                ]
                if not any(keyword in line for keyword in excluded_keywords):
                    facility_list_text = line
                    break

    if facility_list_text:
        # 設施名稱通常以「、」或「，」分隔，且可能包含數量（如「X1組」、「1組」等）
        # 也可能包含「及」連接詞
        parts = re.split(r'[、，,]', facility_list_text)

        for part in parts:
            # 移除數量資訊（如「X1組」、「1組」、「1面」等）
            clean_name = re.sub(r'[\d一二三四五六七八九十]+[個組面片座項]', '', part).strip()

            # 處理「及」連接詞（如「無障礙坡道及平台」）
            if '及' in clean_name:
                sub_parts = clean_name.split('及')
                for sub_part in sub_parts:
                    final_name = sub_part.strip()
                    if final_name and 2 <= len(final_name) <= 30:
                        # 過濾掉明顯不是設施名稱的詞
                        excluded_keywords = [
                            '遊具設施', '行政區', '地址', '適用對象', '啟用日期', '交通資訊',
                            '遮陽設施', '休息區', '沖洗區', '輪椅', '無障礙', '哺乳室', '育嬰室',
                            '對外開放', '停車位', '醫療院所', '主管機關', '聯繫窗口', '遊樂場資訊',
                            '點閱數', '資料更新', '資料檢視', '資料維護', '周邊設施', '主管機關',
                            '安全告示牌', '太陽能', 'LED', '燈', '坡道', '平台'
                        ]
                        if not any(keyword in final_name for keyword in excluded_keywords):
                            if not any(f.equipment_name == final_name for f in facilities):
                                facilities.append(Facility(equipment_name=final_name))
            else:
                # 移除前後的空白和標點
                clean_name = re.sub(r'^[、，,。\s]+|[、，,。\s]+$', '', clean_name)
                if clean_name and 2 <= len(clean_name) <= 30:
                    # 過濾掉明顯不是設施名稱的詞
                    excluded_keywords = [
                        '遊具設施', '行政區', '地址', '適用對象', '啟用日期', '交通資訊',
                        '遮陽設施', '休息區', '沖洗區', '輪椅', '無障礙', '哺乳室', '育嬰室',
                        '對外開放', '停車位', '醫療院所', '主管機關', '聯繫窗口', '遊樂場資訊',
                        '點閱數', '資料更新', '資料檢視', '資料維護', '周邊設施', '主管機關',
                        '安全告示牌', '太陽能', 'LED', '燈', '坡道', '平台'
                    ]
                    if not any(keyword in clean_name for keyword in excluded_keywords):
                        if not any(f.equipment_name == clean_name for f in facilities):
                            facilities.append(Facility(equipment_name=clean_name))

    # 方法2: 如果方法1沒有找到，從表格中提取設施名稱
    if len(facilities) == 0:
        facility_section_match = re.search(r'遊具設施內容[\s\S]*?(?=遊樂場資訊|周邊設施|主管機關|$)', pdf_text, re.IGNORECASE)
        if facility_section_match:
            facility_text = facility_section_match.group(0)

            # 將文字按行分割
            lines = [l.strip() for l in facility_text.split('\n') if l.strip()]

            excluded_keywords_pattern = re.compile(
                r'遊具設施|行政區|地址|適用對象|啟用日期|交通資訊|遮陽設施|休息區|沖洗區|'
                r'輪椅|無障礙|哺乳室|育嬰室|對外開放|停車位|醫療院所|主管機關|聯繫窗口|'
                r'遊樂場資訊|點閱數|資料更新|資料檢視|資料維護|周邊設施|主管機關|照片|說明|'
                r'內容|數量|組|面|片|個|座|項'
            )

            for line in lines:
                # 跳過明顯不是設施名稱的行
                if excluded_keywords_pattern.search(line):
                    continue

                # 檢查是否是設施名稱（2-20 個中文字）
                facility_name_match = re.match(r'^([\u4e00-\u9fa5]{2,20})$', line)
                if facility_name_match:
                    facility_name = facility_name_match.group(1)
                    if not any(f.equipment_name == facility_name for f in facilities):
                        facilities.append(Facility(equipment_name=facility_name))

    return facilities


def extract_images_from_pdf(
    pdf_path: str,
    school_name: str,
    facilities: List[Facility],
    base_image_dir: str
) -> None:
    """
    從 PDF 中提取圖片並保存到檔案
    為每個國小創建獨立資料夾，並使用設施名稱作為檔名
    """
    # 為每個國小創建獨立資料夾
    sanitized_school_name = re.sub(r'[\/\\:*?"<>|]', '_', school_name)
    school_image_dir = Path(base_image_dir) / sanitized_school_name

    # 確保學校圖片目錄存在
    school_image_dir.mkdir(parents=True, exist_ok=True)

    try:
        all_images = []

        # 方法1: 使用 pdfplumber（如果可用）
        if PDF_PLUMBER_AVAILABLE:
            try:
                with pdfplumber.open(pdf_path) as pdf:
                    for page_num, page in enumerate(pdf.pages, 1):
                        # 提取圖片
                        images = page.images
                        for img in images:
                            if img.get('stream'):
                                # 這裡需要進一步處理圖片數據
                                # pdfplumber 的圖片提取較複雜，可能需要使用其他方法
                                pass
            except Exception as e:
                print(f'  使用 pdfplumber 提取圖片時發生錯誤: {e}')

        # 方法2: 直接從 PDF 二進制流中查找 JPEG 圖片
        if len(all_images) == 0:
            with open(pdf_path, 'rb') as f:
                pdf_buffer = f.read()

            # 查找所有 JPEG 圖片（FF D8 FF ... FF D9）
            offset = 0
            while offset < len(pdf_buffer) - 1:
                # 查找 JPEG 開始標記 (FF D8)
                start_idx = pdf_buffer.find(b'\xFF\xD8', offset)
                if start_idx == -1:
                    break

                # 查找 JPEG 結束標記 (FF D9)
                end_idx = pdf_buffer.find(b'\xFF\xD9', start_idx + 2)
                if end_idx == -1:
                    offset = start_idx + 1
                    continue

                jpeg_data = pdf_buffer[start_idx:end_idx + 2]
                # 確保圖片大小合理（至少 1KB）
                if len(jpeg_data) > 1024:
                    all_images.append({
                        'data': jpeg_data,
                        'extension': 'jpg',
                        'page_num': 0,  # 無法確定頁碼，使用 0
                    })

                offset = end_idx + 2

        print(f'  → 找到 {len(all_images)} 張圖片，{len(facilities)} 個設施')

        if len(all_images) > 0:
            # 如果圖片數量與設施數量相同，按順序對應
            if len(all_images) == len(facilities):
                for i, facility in enumerate(facilities):
                    image_info = all_images[i]

                    # 使用設施名稱作為檔名
                    sanitized_facility_name = re.sub(r'[\/\\:*?"<>|]', '_', facility.equipment_name)
                    filename = f'{sanitized_facility_name}.{image_info["extension"]}'
                    filepath = school_image_dir / filename

                    with open(filepath, 'wb') as f:
                        f.write(image_info['data'])

                    # 更新設施的圖片路徑（相對路徑）
                    facility.image = f'image/{sanitized_school_name}/{filename}'

                    print(f'    ✓ 保存圖片: {filename}')
            else:
                # 如果數量不匹配，按順序保存
                for i in range(min(len(all_images), len(facilities))):
                    facility = facilities[i]
                    image_info = all_images[i]

                    sanitized_facility_name = re.sub(r'[\/\\:*?"<>|]', '_', facility.equipment_name)
                    filename = f'{sanitized_facility_name}.{image_info["extension"]}'
                    filepath = school_image_dir / filename

                    with open(filepath, 'wb') as f:
                        f.write(image_info['data'])

                    facility.image = f'image/{sanitized_school_name}/{filename}'

                    print(f'    ✓ 保存圖片: {filename}')

                # 如果有額外的圖片，使用索引命名
                for i in range(len(facilities), len(all_images)):
                    image_info = all_images[i]
                    filename = f'image_{i}.{image_info["extension"]}'
                    filepath = school_image_dir / filename

                    with open(filepath, 'wb') as f:
                        f.write(image_info['data'])

                    print(f'    ✓ 保存額外圖片: {filename}')

    except Exception as e:
        print(f'  提取 PDF 圖片時發生錯誤: {e}')
        # 不拋出錯誤，繼續執行


def process_pdf_file(
    pdf_path: str,
    school_name: str,
    base_image_dir: str
) -> List[Facility]:
    """
    處理單個 PDF 檔案
    
    Returns:
        設施列表
    """
    # 讀取 PDF 並提取文字
    pdf_text = ''

    # 方法1: 使用 pdfplumber（如果可用）
    if PDF_PLUMBER_AVAILABLE:
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    pdf_text += page.extract_text() or ''
        except Exception as e:
            print(f'  使用 pdfplumber 提取文字時發生錯誤: {e}')

    # 方法2: 使用 PyPDF2（如果可用且 pdfplumber 失敗）
    if not pdf_text and PYPDF2_AVAILABLE:
        try:
            reader = PdfReader(pdf_path)
            for page in reader.pages:
                pdf_text += page.extract_text() or ''
        except Exception as e:
            print(f'  使用 PyPDF2 提取文字時發生錯誤: {e}')

    if not pdf_text:
        print(f'  警告: 無法從 PDF 提取文字: {pdf_path}')
        return []

    # 提取設施資訊
    facilities = extract_facilities_from_pdf_text(pdf_text)

    # 提取圖片
    extract_images_from_pdf(pdf_path, school_name, facilities, base_image_dir)

    return facilities
