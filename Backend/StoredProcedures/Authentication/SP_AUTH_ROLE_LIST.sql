-- Role list with optional filters, pagination, and sorting.
CREATE OR ALTER PROCEDURE dbo.SP_AUTH_ROLE_LIST
    @PlantId INT = NULL,
    @IncludeDeleted BIT = 0,
    @Page INT = 1,
    @PageSize INT = 50,
    @SortBy NVARCHAR(50) = N'ROLE_ID',
    @SortDir NVARCHAR(4) = N'DESC'
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        IF @Page IS NULL OR @Page < 1 SET @Page = 1;
        IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;
        IF @PageSize > 500 SET @PageSize = 500;

        DECLARE @Offset INT = (@Page - 1) * @PageSize;
        DECLARE @SortByNorm NVARCHAR(50) = UPPER(LTRIM(RTRIM(ISNULL(@SortBy, N''))));
        DECLARE @SortDirNorm NVARCHAR(4) = UPPER(LTRIM(RTRIM(ISNULL(@SortDir, N'DESC'))));

        SELECT
            r.ROLE_ID,
            r.ROLE,
            r.PLANT_ID,
            p.PLANT_NAME,
            r.IS_DELETED,
            COUNT(*) OVER() AS TOTAL_COUNT
        FROM dbo.TBL_MST_ROLE AS r
        LEFT JOIN dbo.TBL_MST_PLANT AS p ON p.PLANT_ID = r.PLANT_ID
        WHERE
            (@IncludeDeleted = 1 OR ISNULL(r.IS_DELETED, 0) = 0)
            AND (@PlantId IS NULL OR r.PLANT_ID = @PlantId)
        ORDER BY
            CASE WHEN @SortByNorm = N'ROLE_ID' AND @SortDirNorm = N'ASC' THEN r.ROLE_ID END ASC,
            CASE WHEN @SortByNorm = N'ROLE_ID' AND @SortDirNorm = N'DESC' THEN r.ROLE_ID END DESC,
            CASE WHEN @SortByNorm = N'ROLE' AND @SortDirNorm = N'ASC' THEN r.ROLE END ASC,
            CASE WHEN @SortByNorm = N'ROLE' AND @SortDirNorm = N'DESC' THEN r.ROLE END DESC,
            r.ROLE_ID DESC
        OFFSET @Offset ROWS
        FETCH NEXT @PageSize ROWS ONLY;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_AUTH_ROLE_LIST failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
