-- User list with optional filters, pagination, and sorting.
CREATE OR ALTER PROCEDURE dbo.SP_AUTH_USER_LIST
    @Page INT = 1,
    @PageSize INT = 50,
    @SortBy NVARCHAR(50) = N'USER_ID',
    @SortDir NVARCHAR(4) = N'DESC',
    @IsActive BIT = NULL,
    @RoleId INT = NULL,
    @Search NVARCHAR(100) = NULL
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
            u.USER_ID,
            u.FIRST_NAME,
            u.LAST_NAME,
            u.USERNAME,
            u.EMAIL_ID,
            u.ROLE_ID,
            u.IsActive,
            COUNT(*) OVER() AS TOTAL_COUNT
        FROM dbo.TBL_MST_USER AS u
        WHERE
            u.IS_DELETED = 0
            AND (@IsActive IS NULL OR u.IsActive = @IsActive)
            AND (@RoleId IS NULL OR u.ROLE_ID = @RoleId)
            AND (
                @Search IS NULL
                OR LTRIM(RTRIM(@Search)) = N''
                OR u.USERNAME LIKE N'%' + @Search + N'%'
                OR u.FIRST_NAME LIKE N'%' + @Search + N'%'
                OR u.LAST_NAME LIKE N'%' + @Search + N'%'
                OR u.EMAIL_ID LIKE N'%' + @Search + N'%'
            )
        ORDER BY
            CASE WHEN @SortByNorm = N'USER_ID' AND @SortDirNorm = N'ASC' THEN u.USER_ID END ASC,
            CASE WHEN @SortByNorm = N'USER_ID' AND @SortDirNorm = N'DESC' THEN u.USER_ID END DESC,
            CASE WHEN @SortByNorm = N'USERNAME' AND @SortDirNorm = N'ASC' THEN u.USERNAME END ASC,
            CASE WHEN @SortByNorm = N'USERNAME' AND @SortDirNorm = N'DESC' THEN u.USERNAME END DESC,
            CASE WHEN @SortByNorm = N'CREATED_DATE' AND @SortDirNorm = N'ASC' THEN u.CREATED_DATE END ASC,
            CASE WHEN @SortByNorm = N'CREATED_DATE' AND @SortDirNorm = N'DESC' THEN u.CREATED_DATE END DESC,
            u.USER_ID DESC
        OFFSET @Offset ROWS
        FETCH NEXT @PageSize ROWS ONLY;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_AUTH_USER_LIST failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
