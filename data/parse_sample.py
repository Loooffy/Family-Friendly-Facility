#!/usr/bin/env python3
"""
解析資料檔案並輸出樣本到 parsed_data 目錄
用於檢查 parse 之後的欄位是否正確
"""

import json
from pathlib import Path
from scripts.parse_nursing_rooms import parse_nursing_rooms_data
from scripts.parse_playgrounds import parse_playgrounds_csv, parse_taipei_playgrounds_json
from scripts.parse_toilets import parse_toilets_data
from scripts.scrape_new_taipei_parks import parse_new_taipei_parks_csv

# 輸出目錄
OUTPUT_DIR = Path(__file__).parent / 'parsed_data'

# 輸出樣本數量
SAMPLE_SIZE = 5


def output_sample(data, filename: str, description: str):
    """輸出樣本資料到 JSON 檔案"""
    sample = data[:SAMPLE_SIZE]
    output = {
        'description': description,
        'totalCount': len(data),
        'sampleSize': len(sample),
        'sample': [item.to_dict() if hasattr(item, 'to_dict') else item for item in sample],
    }

    output_path = OUTPUT_DIR / filename
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f'✓ {description}: 總共 {len(data)} 筆，已輸出 {len(sample)} 筆樣本到 {filename}')


def main():
    print('開始解析資料檔案...\n')

    try:
        data_dir = Path(__file__).parent / 'source_data'

        # 1. 解析共融式遊戲場 CSV
        playgrounds_csv_path = data_dir / '台北市共融式遊戲場.csv'
        if playgrounds_csv_path.exists():
            playgrounds_csv = parse_playgrounds_csv(str(playgrounds_csv_path))
            output_sample(playgrounds_csv, 'taipei-inclusive-playgrounds-sample.json', '共融式遊戲場 (CSV)')

        # 2. 解析台北市兒童遊戲場 JSON
        taipei_playgrounds_path = data_dir / '台北市兒童遊戲場.json'
        if taipei_playgrounds_path.exists():
            taipei_playgrounds = parse_taipei_playgrounds_json(str(taipei_playgrounds_path))
            output_sample(taipei_playgrounds, 'taipei-playgrounds-sample.json', '台北市兒童遊戲場 (JSON)')

        # 3. 解析新北市共融公園 CSV
        new_taipei_parks_csv_path = data_dir / '新北市共融公園.csv'
        if new_taipei_parks_csv_path.exists():
            new_taipei_parks_csv = parse_new_taipei_parks_csv(str(new_taipei_parks_csv_path))
            output_sample(new_taipei_parks_csv, 'new-taipei-parks-sample.json', '新北市共融公園 (CSV)')

        # 4. 解析親子廁所 JSON
        toilets_path = data_dir / '全國公廁建檔資料.json'
        if toilets_path.exists():
            toilets = parse_toilets_data(str(toilets_path))
            output_sample(toilets, 'toilets-sample.json', '親子廁所 (JSON)')

        # 5. 解析依法設置哺集乳室 CSV
        nursing_rooms_mandatory_path = data_dir / '全國依法設置哺集乳室名單(截至115年1月).csv'
        if nursing_rooms_mandatory_path.exists():
            nursing_rooms_mandatory = parse_nursing_rooms_data(
                str(nursing_rooms_mandatory_path),
                '依法設置'
            )
            output_sample(nursing_rooms_mandatory, 'nursing-rooms-mandatory-sample.json', '哺集乳室-依法設置 (CSV)')

        # 6. 解析自願設置哺集乳室 CSV
        nursing_rooms_voluntary_path = data_dir / '全國自願設置哺集乳室名單(截至115年1月).csv'
        if nursing_rooms_voluntary_path.exists():
            nursing_rooms_voluntary = parse_nursing_rooms_data(
                str(nursing_rooms_voluntary_path),
                '自願設置'
            )
            output_sample(nursing_rooms_voluntary, 'nursing-rooms-voluntary-sample.json', '哺集乳室-自願設置 (CSV)')

        print('\n✓ 所有資料解析完成！')
        print(f'樣本檔案已輸出到: {OUTPUT_DIR}')
    except Exception as e:
        print(f'解析過程中發生錯誤: {e}')
        raise


if __name__ == '__main__':
    main()
