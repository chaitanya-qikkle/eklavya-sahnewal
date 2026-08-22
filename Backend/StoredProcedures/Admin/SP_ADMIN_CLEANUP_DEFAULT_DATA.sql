-- Cleanup default test data.
CREATE OR ALTER PROCEDURE dbo.SP_ADMIN_CLEANUP_DEFAULT_DATA
    @TestUsername NVARCHAR(50) = N'testuser',
    @DefaultPlantId INT = 1
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DELETE FROM dbo.TBL_MST_USER
        WHERE USERNAME = @TestUsername;
        DECLARE @UsersDeleted INT = @@ROWCOUNT;

        UPDATE dbo.TBL_MST_ROLE
        SET PLANT_ID = NULL
        WHERE PLANT_ID = @DefaultPlantId;
        DECLARE @RolesUpdated INT = @@ROWCOUNT;

        DELETE FROM dbo.TBL_MST_PLANT
        WHERE PLANT_ID = @DefaultPlantId;
        DECLARE @PlantsDeleted INT = @@ROWCOUNT;

        COMMIT TRANSACTION;

        SELECT
            @UsersDeleted AS UsersDeleted,
            @RolesUpdated AS RolesUpdated,
            @PlantsDeleted AS PlantsDeleted;

        SELECT PLANT_ID, PLANT_NAME, PLANT_CODE, LOCATION
        FROM dbo.TBL_MST_PLANT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_ADMIN_CLEANUP_DEFAULT_DATA failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
