-- List all user-defined procedures.
CREATE OR ALTER PROCEDURE dbo.SP_SYS_LIST_PROCEDURES
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        SELECT name
        FROM sys.procedures
        WHERE is_ms_shipped = 0
        ORDER BY name;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_SYS_LIST_PROCEDURES failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
