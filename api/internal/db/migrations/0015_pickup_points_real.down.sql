DROP INDEX IF EXISTS pickup_points_slug_key;
ALTER TABLE pickup_points DROP COLUMN IF EXISTS slug;
ALTER TABLE pickup_points DROP COLUMN IF EXISTS is_main;
ALTER TABLE pickup_points DROP COLUMN IF EXISTS city;
