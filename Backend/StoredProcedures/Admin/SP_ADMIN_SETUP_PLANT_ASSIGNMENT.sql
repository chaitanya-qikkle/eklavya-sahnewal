-- Ensure a default plant exists and assign it to roles missing a plant.
CREATE OR ALTER PROCEDURE dbo.SP_ADMIN_SETUP_PLANT_ASSIGNMENT
    @DefaultPlantName NVARCHAR(200) = N'Default Plant',
    @DefaultPlantCode NVARCHAR(50) = N'DEF-001',
    @DefaultLocation NVARCHAR(200) = N'Mumbai',
    @CreatedBy INT = 1
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @PlantId INT;

        SELECT TOP 1 @PlantId = PLANT_ID
        FROM dbo.TBL_MST_PLANT;

        IF @PlantId IS NULL
        BEGIN
            INSERT INTO dbo.TBL_MST_PLANT (
                PLANT_NAME,
                PLANT_CODE,
                LOCATION,
                IS_ACTIVE,
                CREATED_BY,
                CREATED_DATE
            )
            VALUES (
                @DefaultPlantName,
                @DefaultPlantCode,
                @DefaultLocation,
                1,
                @CreatedBy,
                GETDATE()
            );

            SET @PlantId = SCOPE_IDENTITY();
        END

        UPDATE dbo.TBL_MST_ROLE
        SET PLANT_ID = @PlantId
        WHERE PLANT_ID IS NULL;

        SELECT @PlantId AS PlantId;

        SELECT ROLE_ID, ROLE, PLANT_ID
        FROM dbo.TBL_MST_ROLE
        ORDER BY ROLE_ID;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_ADMIN_SETUP_PLANT_ASSIGNMENT failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
