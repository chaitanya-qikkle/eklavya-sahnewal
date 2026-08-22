-- Delete a transaction record.
CREATE OR ALTER PROCEDURE dbo.SP_MOVEMENT_TRANSACTION_DELETE
    @TransactionId INT,
    @PlantId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DELETE FROM dbo.TBL_EQUIPMENT_TRANSACTION
        WHERE TRANSACTION_ID = @TransactionId;

        IF @@ROWCOUNT = 0
        BEGIN
            SELECT CAST(0 AS INT) AS Status, N'Equipment transaction not found' AS Message;
            RETURN;
        END

        SELECT CAST(1 AS INT) AS Status, N'Equipment transaction deleted successfully' AS Message;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_MOVEMENT_TRANSACTION_DELETE failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
