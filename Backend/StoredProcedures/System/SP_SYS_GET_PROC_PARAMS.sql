-- Return parameter metadata for a stored procedure.
CREATE OR ALTER PROCEDURE dbo.SP_SYS_GET_PROC_PARAMS
    @ProcName SYSNAME
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        SELECT
            PARAMETER_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            PARAMETER_MODE
        FROM INFORMATION_SCHEMA.PARAMETERS
        WHERE SPECIFIC_NAME = @ProcName
        ORDER BY ORDINAL_POSITION;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_SYS_GET_PROC_PARAMS failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
