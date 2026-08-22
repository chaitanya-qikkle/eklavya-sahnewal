-- Find objects by name pattern.
CREATE OR ALTER PROCEDURE dbo.SP_SYS_FIND_OBJECTS_BY_NAME
    @NameLike NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        SELECT s.name AS schema_name, o.name AS object_name, o.type_desc
        FROM sys.objects o
        JOIN sys.schemas s ON o.schema_id = s.schema_id
        WHERE o.name LIKE @NameLike
        ORDER BY s.name, o.name;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_SYS_FIND_OBJECTS_BY_NAME failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
