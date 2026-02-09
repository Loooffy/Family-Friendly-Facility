# Hasura 功能設定指南

本文檔說明如何在 Hasura 中設定所有功能，**不需要額外的 Action handlers**。

## 架構說明

此專案完全使用 Hasura 的功能，不需要 Vercel 或其他 serverless 平台：

- **查詢功能**: 使用 Hasura Custom Functions（追蹤 PostgreSQL functions）
- **新增地點**: 使用 `add_location` PostgreSQL function
- **關聯查詢**: Hasura 自動處理 relationships

## 前置需求

1. 已建立 Hasura Cloud 專案並連接資料庫
2. 已執行所有 migrations（包括 PostGIS functions 和 add_location function）
3. 已追蹤資料表和設定 relationships

## 1. 追蹤 PostgreSQL Functions

在 Hasura Console 中：

1. 前往 **Data** → **Functions**
2. 追蹤以下函數：

### nearest_places

- Function: `nearest_places(p_lat double precision, p_lng double precision, p_type_id integer, p_radius integer, p_limit integer)`
- 用途: 查詢最近的地點
- 權限: 允許 `anonymous` role 執行

### places_in_bounds

- Function: `places_in_bounds(p_type_id integer, p_north double precision, p_south double precision, p_east double precision, p_west double precision)`
- 用途: 查詢範圍內的地點
- 權限: 允許 `anonymous` role 執行

### nearest_places_by_types

- Function: `nearest_places_by_types(p_lat double precision, p_lng double precision, p_type_ids integer[], p_radius integer, p_limit integer)`
- 用途: 查詢多個類型的最遠地點
- 權限: 允許 `anonymous` role 執行

### nearby_facility_stats

- Function: `nearby_facility_stats(p_lat double precision, p_lng double precision, p_radius integer)`
- 用途: 查詢附近設施統計
- 權限: 允許 `anonymous` role 執行

### add_location

- Function: `add_location(p_name varchar, p_address text, p_lat decimal, p_lng decimal, p_type_id integer, p_district_id integer, p_opening_hours varchar, p_link text, p_diaper boolean, p_note text, p_facilities jsonb)`
- 用途: 新增地點（包含地址解析）
- 權限: 允許 `anonymous` role 執行（或根據需求設定）

## 2. 使用 GraphQL Queries

### 查詢最近的地點

```graphql
query {
  nearest_places(
    args: {
      p_lat: 25.0330
      p_lng: 121.5654
      p_type_id: 1
      p_radius: 5000
      p_limit: 20
    }
  ) {
    id
    name
    address
    latitude
    longitude
    distance
  }
}
```

### 查詢範圍內的地點

```graphql
query {
  places_in_bounds(
    args: {
      p_type_id: 1
      p_north: 25.1
      p_south: 25.0
      p_east: 121.6
      p_west: 121.5
    }
  ) {
    id
    name
    address
    latitude
    longitude
  }
}
```

### 查詢多個類型的最遠地點

```graphql
query {
  nearest_places_by_types(
    args: {
      p_lat: 25.0330
      p_lng: 121.5654
      p_type_ids: [1, 2, 3]
      p_radius: 5000
      p_limit: 20
    }
  ) {
    id
    name
    type_id
    distance
  }
}
```

### 查詢附近設施統計

```graphql
query {
  nearby_facility_stats(
    args: {
      p_lat: 25.0330
      p_lng: 121.5654
      p_radius: 5000
    }
  ) {
    type_id
    type_name
    count
  }
}
```

### 新增地點

```graphql
mutation {
  add_location(
    args: {
      p_name: "測試地點"
      p_address: "臺北市信義區信義路五段7號"
      p_lat: 25.0330
      p_lng: 121.5654
      p_type_id: 1
      p_diaper: true
      p_facilities: "[{\"equipmentName\": \"溜滑梯\", \"imageUrl\": \"https://example.com/image.jpg\"}]"::jsonb
    }
  ) {
    id
    name
    success
    message
  }
}
```

## 3. 使用 Hasura 自動生成的 Queries

除了 Custom Functions，您也可以使用 Hasura 自動生成的 queries：

### 查詢地點（使用關聯）

```graphql
query {
  locations(
    where: {
      latitude: { _gte: 25.0, _lte: 25.1 }
      longitude: { _gte: 121.5, _lte: 121.6 }
      typeId: { _eq: 1 }
    }
  ) {
    id
    name
    address
    latitude
    longitude
    type {
      id
      name
    }
    district {
      id
      name
      city {
        id
        name
      }
    }
    facilities {
      id
      equipmentName
      imageUrl
    }
    images {
      id
      url
    }
  }
}
```

### 新增地點（使用 Hasura insert）

```graphql
mutation {
  insert_locations_one(
    object: {
      name: "測試地點"
      address: "臺北市信義區信義路五段7號"
      latitude: 25.0330
      longitude: 121.5654
      typeId: 1
      diaper: true
      facilities: {
        data: [
          {
            equipmentName: "溜滑梯"
            imageUrl: "https://example.com/image.jpg"
          }
        ]
      }
    }
  ) {
    id
    name
  }
}
```

**注意**: 使用 `insert_locations_one` 不會自動解析地址，需要手動提供 `districtId`。如果需要地址解析功能，請使用 `add_location` function。

## 4. 權限設定

在 Hasura Console 中為每個 function 和資料表設定 `anonymous` role 的權限：

### Functions 權限

1. 前往 **Data** → **Functions**
2. 點擊每個 function 的 **Permissions**
3. 新增 `anonymous` role
4. 允許執行該 function

### 資料表權限

1. 前往 **Data** → **Tables**
2. 點擊每個資料表的 **Permissions**
3. 為 `anonymous` role 設定：
   - **select**: 允許所有欄位（用於查詢）
   - **insert**: 根據需求設定（用於新增地點）
   - **update**: 根據需求設定
   - **delete**: 根據需求設定

## 5. 測試

在 Hasura Console 的 GraphQL 頁面測試所有 queries 和 mutations。

## 注意事項

1. **地址解析**: `add_location` function 會自動從地址中解析城市和區域，如果無法解析，會使用提供的 `districtId`。

2. **關聯資料**: Hasura 會自動處理關聯查詢，不需要手動查詢關聯資料。

3. **CORS**: Hasura 的 CORS 設定已在 `docker-compose.yml` 或 Hasura Cloud 設定中配置。

4. **效能**: PostgreSQL functions 在資料庫層執行，效能優於外部 API calls。

5. **複雜查詢**: 對於複雜的空間查詢，使用 Custom Functions 比 Hasura 自動生成的 queries 更有效率。
