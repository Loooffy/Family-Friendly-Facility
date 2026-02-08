import requests
import xml.etree.ElementTree as ET
import json
import string


def fetch_taiwan_towns():
    base_url = "https://api.nlsc.gov.tw/other/ListTown/"
    # 產生 A 到 Q 的字母列表
    letters = string.ascii_uppercase[:26]  # A-Q

    result = {}

    for letter in letters:
        url = f"{base_url}{letter}"
        print(f"正在抓取城市代碼 {letter} 的資料...")

        try:
            response = requests.get(url)
            response.raise_for_status()

            # 解析 XML
            root = ET.fromstring(response.content)

            # 提取所有 townname 並存入陣列
            towns = [item.find("townname").text for item in root.findall("townItem")]

            # 存入字典
            result[letter] = towns

        except Exception as e:
            print(f"抓取 {letter} 時發生錯誤: {e}")
            result[letter] = []

    # 輸出成 JSON 檔案
    with open("taiwan_towns.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=4)

    print("\n抓取完成！結果已儲存至 taiwan_towns.json")
    return result


if __name__ == "__main__":
    fetch_taiwan_towns()
