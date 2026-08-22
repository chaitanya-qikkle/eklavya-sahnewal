-- Plant list with optional filter and sorting.
CREATE OR ALTER PROCEDURE dbo.SP_MASTER_PLANT_LIST
    @PlantId INT = NULL,
    @IncludeDeleted BIT = 0,
    @SortBy NVARCHAR(50) = N'PLANT_NAME',
    @SortDir NVARCHAR(4) = N'ASC'
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @SortByNorm NVARCHAR(50) = UPPER(LTRIM(RTRIM(ISNULL(@SortBy, N''))));
        DECLARE @SortDirNorm NVARCHAR(4) = UPPER(LTRIM(RTRIM(ISNULL(@SortDir, N'ASC'))));

        SELECT
            PLANT_ID,
            PLANT_CODE,
            PLANT_NAME,
            LOCATION,
            CLIENT_ID,
            IS_ACTIVE,
            IS_DELETED
        FROM dbo.TBL_MST_PLANT
        WHERE
            (@IncludeDeleted = 1 OR ISNULL(IS_DELETED, 0) = 0)
            AND (@PlantId IS NULL OR PLANT_ID = @PlantId)
        ORDER BY
            CASE WHEN @SortByNorm = N'PLANT_NAME' AND @SortDirNorm = N'ASC' THEN PLANT_NAME END ASC,
            CASE WHEN @SortByNorm = N'PLANT_NAME' AND @SortDirNorm = N'DESC' THEN PLANT_NAME END DESC,
            CASE WHEN @SortByNorm = N'PLANT_ID' AND @SortDirNorm = N'ASC' THEN PLANT_ID END ASC,
            CASE WHEN @SortByNorm = N'PLANT_ID' AND @SortDirNorm = N'DESC' THEN PLANT_ID END DESC,
            PLANT_NAME ASC;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_MASTER_PLANT_LIST failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
