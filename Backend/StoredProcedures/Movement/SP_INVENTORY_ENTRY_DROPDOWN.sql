-- Returns distinct Block names, Rows, and Columns from ESS_MST_LOCATION.
-- PlantID filter removed — ESS_MST_LOCATION.PlantID is NULL for all rows in this DB.
--
-- Usage:
--   EXEC dbo.SP_INVENTORY_ENTRY_DROPDOWN                           -- all blocks
--   EXEC dbo.SP_INVENTORY_ENTRY_DROPDOWN @BlockName = 'B1'        -- rows + cols for that block
CREATE OR ALTER PROCEDURE dbo.SP_INVENTORY_ENTRY_DROPDOWN
    @PlantId   INT           = NULL,   -- kept for signature compat, not used in filter
    @BlockName NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Result set 1 – distinct block names
    SELECT DISTINCT
        LTRIM(RTRIM(BlockName)) AS BlockName
    FROM ESS_MST_LOCATION
    WHERE BlockName IS NOT NULL
      AND LTRIM(RTRIM(BlockName)) <> ''
    ORDER BY LTRIM(RTRIM(BlockName));

    -- Result set 2 – distinct rows for the chosen block
    SELECT DISTINCT
        LTRIM(RTRIM(RowNo)) AS RowNo
    FROM ESS_MST_LOCATION
    WHERE (@BlockName IS NULL OR LTRIM(RTRIM(BlockName)) = LTRIM(RTRIM(@BlockName)))
      AND RowNo IS NOT NULL
      AND LTRIM(RTRIM(RowNo)) <> ''
    ORDER BY LTRIM(RTRIM(RowNo));

    -- Result set 3 – distinct columns for the chosen block
    SELECT DISTINCT
        LTRIM(RTRIM(ColumnName)) AS ColumnName
    FROM ESS_MST_LOCATION
    WHERE (@BlockName IS NULL OR LTRIM(RTRIM(BlockName)) = LTRIM(RTRIM(@BlockName)))
      AND ColumnName IS NOT NULL
      AND LTRIM(RTRIM(ColumnName)) <> ''
    ORDER BY LTRIM(RTRIM(ColumnName));
END;
