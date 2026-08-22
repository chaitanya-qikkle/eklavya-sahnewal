-- Add equipment with height settings passed as JSON.
CREATE OR ALTER PROCEDURE dbo.SP_EQUIPMENT_ADD
    @PlantId INT,
    @EquipmentName VARCHAR(50),
    @DeviceId VARCHAR(50) = NULL,
    @InstallationDate DATE = NULL,
    @OwnerName VARCHAR(100) = NULL,
    @EquipmentType VARCHAR(100) = NULL,
    @EquipmentMaker VARCHAR(100) = NULL,
    @SimId NVARCHAR(MAX) = NULL,
    @VtmImeiNo VARCHAR(200) = NULL,
    @JobAllow BIT = 0,
    @IsActive BIT = 1,
    @IsRemoveDevice INT = 0,
    @IsManualBreakdown INT = 0,
    @CreatedBy INT,
    @HeightSettingsJson NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DECLARE @HeightSettings dbo.HeightSettingType;

        IF @HeightSettingsJson IS NOT NULL AND LTRIM(RTRIM(@HeightSettingsJson)) <> N''
        BEGIN
            INSERT INTO @HeightSettings (EQUIPMENT_NAME, HEIGHT, MIN_VALUE, MAX_VALUE)
            SELECT
                JSON_VALUE(js.value, '$.equipment_name'),
                TRY_CONVERT(INT, JSON_VALUE(js.value, '$.height')),
                TRY_CONVERT(INT, JSON_VALUE(js.value, '$.min_value')),
                TRY_CONVERT(INT, JSON_VALUE(js.value, '$.max_value'))
            FROM OPENJSON(@HeightSettingsJson) AS js;
        END

        EXEC dbo.TBL_MST_EQUIPMENT_INSERT
            @Plant_ID = @PlantId,
            @Equipment_Name = @EquipmentName,
            @Device_ID = @DeviceId,
            @Installation_Date = @InstallationDate,
            @Owner_Name = @OwnerName,
            @Equipment_Type = @EquipmentType,
            @Equipment_Maker = @EquipmentMaker,
            @Sim_ID = @SimId,
            @VTM_ImeiNo = @VtmImeiNo,
            @JobAllow = @JobAllow,
            @IsActive = @IsActive,
            @IsRemoveDevice = @IsRemoveDevice,
            @IsManualBreakdown = @IsManualBreakdown,
            @CreatedBy = @CreatedBy,
            @HeightSettings = @HeightSettings;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_EQUIPMENT_ADD failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
