-- Master lists: yards, plants, and blocks for a plant.
CREATE OR ALTER PROCEDURE dbo.SP_MASTER_YARD_MASTER_LISTS
    @PlantId INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        -- 1) Yards
        SELECT
            YardID,
            YardName,
            YardCode
        FROM dbo.ESS_MST_YARD
        WHERE
            (@PlantId IS NULL OR PlantID = @PlantId)
            AND ISNULL(IsDelete, 0) = 0
        ORDER BY YardName;

        -- 2) Plants
        SELECT
            PLANT_ID,
            PLANT_CODE,
            PLANT_NAME
        FROM dbo.TBL_MST_PLANT
        WHERE ISNULL(IS_DELETED, 0) = 0 AND ISNULL(IS_ACTIVE, 1) = 1
        ORDER BY PLANT_NAME;

        -- 3) Blocks
        SELECT
            BlockID,
            YardID,
            BlockName,
            BlockCode,
            RowStart,
            RowEnd,
            TotalColumns,
            Polygon
        FROM dbo.ESS_MST_BLOCK
        WHERE PlantID = @PlantId AND ISNULL(IsDeleted, 0) = 0
        ORDER BY BlockName;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_MASTER_YARD_MASTER_LISTS failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
