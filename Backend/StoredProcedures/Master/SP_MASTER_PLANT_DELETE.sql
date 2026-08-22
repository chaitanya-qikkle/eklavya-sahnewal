-- Soft delete a plant.
CREATE OR ALTER PROCEDURE dbo.SP_MASTER_PLANT_DELETE
    @PlantId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        UPDATE dbo.TBL_MST_PLANT
        SET
            IS_DELETED = 1,
            IS_ACTIVE = 0,
            MODIFIED_BY = @UserId,
            MODIFIED_DATE = GETDATE()
        WHERE PLANT_ID = @PlantId AND ISNULL(IS_DELETED, 0) = 0;

        IF @@ROWCOUNT = 0
        BEGIN
            SELECT CAST(0 AS INT) AS Status, N'Plant not found or already deleted' AS Message;
            RETURN;
        END

        SELECT CAST(1 AS INT) AS Status, N'Plant deleted successfully' AS Message;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_MASTER_PLANT_DELETE failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
