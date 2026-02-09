-- Rollback Normalize Districts Migration
-- 回滾鄉鎮市區正規化
-- 注意：此回滾可能無法完全恢復到原始狀態，因為資料可能已經被更新

-- ============================================================================
-- PART 1: Restore city names (恢復城市名稱)
-- ============================================================================

-- 1.1 恢復「臺」為「台」（如果需要）
-- 注意：這會將所有「臺」改回「台」，可能不是您想要的
-- UPDATE cities 
-- SET name = REPLACE(name, '臺', '台')
-- WHERE name LIKE '%臺%';

-- 1.2 恢復「桃園市」為「桃園縣」（如果需要）
-- UPDATE cities SET name = '桃園縣' WHERE name = '桃園市';

-- ============================================================================
-- PART 2: Note about districts
-- ============================================================================

-- 注意：由於 districts 的插入使用了 ON CONFLICT DO NOTHING，
-- 回滾時不需要刪除這些資料，因為它們不會造成衝突。
-- 如果需要完全回滾，可以手動刪除在這次 migration 中新增的 districts。

-- 如果需要刪除所有在這次 migration 中新增的 districts（不建議）：
-- DELETE FROM districts d
-- WHERE d."createdAt" >= (
--     SELECT "createdAt" FROM districts 
--     ORDER BY "createdAt" DESC 
--     LIMIT 1 OFFSET (
--         SELECT COUNT(*) FROM districts 
--         WHERE "createdAt" < (
--             SELECT "createdAt" FROM districts 
--             ORDER BY "createdAt" DESC 
--             LIMIT 1
--         )
--     )
-- );

-- ============================================================================
-- PART 3: Note about locations
-- ============================================================================

-- 注意：locations 的 districtId 更新無法自動回滾，
-- 因為我們無法知道更新前的原始值。
-- 如果需要回滾，建議：
-- 1. 在執行 up.sql 之前備份 locations 表
-- 2. 或者手動檢查並更新需要回滾的 locations

-- 此 migration 的回滾主要是警告性質，實際回滾需要手動處理
