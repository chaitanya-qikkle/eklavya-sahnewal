-- Update role details.
CREATE OR ALTER PROCEDURE dbo.SP_AUTH_ROLE_UPDATE
    @RoleId INT,
    @Role NVARCHAR(50),
    @PlantId INT = NULL,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        IF @PlantId IS NOT NULL
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.TBL_MST_PLANT
                WHERE PLANT_ID = @PlantId
                  AND ISNULL(IS_DELETED, 0) = 0
                  AND ISNULL(IS_ACTIVE, 1) = 1
            )
            BEGIN
                SELECT CAST(0 AS INT) AS Status, N'Selected plant is not available' AS Message, @RoleId AS RoleId;
                RETURN;
            END
        END

        UPDATE dbo.TBL_MST_ROLE
        SET
            ROLE = @Role,
            PLANT_ID = @PlantId,
            MODIFIED_BY = @UserId,
            MODIFIED_DATE = GETDATE()
        WHERE ROLE_ID = @RoleId AND ISNULL(IS_DELETED, 0) = 0;

        IF @@ROWCOUNT = 0
        BEGIN
            SELECT CAST(0 AS INT) AS Status, N'Role not found or deleted' AS Message, @RoleId AS RoleId;
            RETURN;
        END

        SELECT CAST(1 AS INT) AS Status, N'Role updated successfully' AS Message, @RoleId AS RoleId;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_AUTH_ROLE_UPDATE failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
