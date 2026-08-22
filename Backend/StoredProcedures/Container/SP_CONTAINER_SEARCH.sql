-- Container number search by prefix.
CREATE OR ALTER PROCEDURE dbo.SP_CONTAINER_SEARCH
    @PlantId INT,
    @Term NVARCHAR(50) = NULL,
    @Top INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        IF @Top IS NULL OR @Top < 1 SET @Top = 20;
        IF @Top > 200 SET @Top = 200;

        DECLARE @TermValue NVARCHAR(50) = ISNULL(@Term, N'');

        SELECT DISTINCT TOP (@Top) CONTAINER_NO
        FROM dbo.TBL_CONTAINER_INVENTORY
        WHERE CONTAINER_NO LIKE @TermValue + '%'
        ORDER BY CONTAINER_NO;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_CONTAINER_SEARCH failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
