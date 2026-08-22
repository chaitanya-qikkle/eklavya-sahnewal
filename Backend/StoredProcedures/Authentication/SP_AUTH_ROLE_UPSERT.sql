-- Create or reactivate a role for a plant.
CREATE OR ALTER PROCEDURE dbo.SP_AUTH_ROLE_UPSERT
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
                SELECT CAST(0 AS INT) AS Status, N'Selected plant is not available' AS Message, NULL AS RoleId;
                RETURN;
            END
        END

        DECLARE @ExistingRoleId INT = NULL;

        SELECT TOP 1 @ExistingRoleId = ROLE_ID
        FROM dbo.TBL_MST_ROLE
        WHERE ROLE = @Role
          AND ISNULL(PLANT_ID, 0) = ISNULL(@PlantId, 0)
          AND IS_DELETED = 1;

        IF @ExistingRoleId IS NOT NULL
        BEGIN
            UPDATE dbo.TBL_MST_ROLE
            SET
                PLANT_ID = @PlantId,
                IS_DELETED = 0,
                IS_ACTIVE = 1,
                MODIFIED_BY = @UserId,
                MODIFIED_DATE = GETDATE()
            WHERE ROLE_ID = @ExistingRoleId;

            SELECT CAST(1 AS INT) AS Status, N'Role reactivated successfully' AS Message, @ExistingRoleId AS RoleId;
            RETURN;
        END

        INSERT INTO dbo.TBL_MST_ROLE (
            ROLE,
            PLANT_ID,
            IS_ACTIVE,
            IS_DELETED,
            CREATED_BY,
            CREATED_DATE
        )
        VALUES (
            @Role,
            @PlantId,
            1,
            0,
            @UserId,
            GETDATE()
        );

        DECLARE @NewRoleId INT = SCOPE_IDENTITY();
        SELECT CAST(1 AS INT) AS Status, N'Role created successfully' AS Message, @NewRoleId AS RoleId;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_AUTH_ROLE_UPSERT failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
