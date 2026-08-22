-- Return column metadata for a table.
CREATE OR ALTER PROCEDURE dbo.SP_SYS_GET_TABLE_COLUMNS
    @TableName SYSNAME
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        SELECT
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            NUMERIC_PRECISION,
            NUMERIC_SCALE,
            IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @TableName
        ORDER BY ORDINAL_POSITION;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_SYS_GET_TABLE_COLUMNS failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
