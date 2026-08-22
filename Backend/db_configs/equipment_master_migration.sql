/* Equipment master migration

This migration is designed to match the existing Eklavya DB schema.

Creates (if missing):
- dbo.TBL_MST_EQUIPMENT (BIGINT keys, IsDelete flag, CreatedBy/CreatedDate, etc.)
- dbo.TBL_EQUIPMENT_HEIGHT_SETTING (existing table used in this DB)
- dbo.HeightSettingType TVP (used by backend to pass height ranges)
- Stored procedures used by backend:
    - dbo.TBL_MST_EQUIPMENT_INSERT
    - dbo.TBL_MST_EQUIPMENT_GET
    - dbo.TBL_MST_EQUIPMENT_UPDATE
    - dbo.TBL_MST_EQUIPMENT_DELETE

Safe to run multiple times.
*/

SET NOCOUNT ON;

/* 1) Tables */
IF OBJECT_ID(N'dbo.TBL_MST_EQUIPMENT', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TBL_MST_EQUIPMENT (
        Eqp_ID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Plant_ID BIGINT NULL,
        Equipment_Name VARCHAR(50) NULL,
        Device_ID VARCHAR(50) NULL,
        Installation_Date DATE NULL,
        Owner_Name VARCHAR(100) NULL,
        Equipment_Type VARCHAR(100) NULL,
        Equipment_Maker VARCHAR(100) NULL,
        Sim_ID NVARCHAR(MAX) NULL,
        VTM_ImeiNo VARCHAR(200) NULL,
        JobAllow BIT NOT NULL CONSTRAINT DF_TBL_MST_EQUIPMENT_JobAllow DEFAULT (0),
        IsActive BIT NOT NULL CONSTRAINT DF_TBL_MST_EQUIPMENT_IsActive DEFAULT (1),
        IsDelete BIT NOT NULL CONSTRAINT DF_TBL_MST_EQUIPMENT_IsDelete DEFAULT (0),
        IsRemoveDevice INT NOT NULL CONSTRAINT DF_TBL_MST_EQUIPMENT_IsRemoveDevice DEFAULT (0),
        IsManualBreakdown INT NOT NULL CONSTRAINT DF_TBL_MST_EQUIPMENT_IsManualBreakdown DEFAULT (0),
        CreatedBy INT NULL,
        CreatedDate DATETIME NULL CONSTRAINT DF_TBL_MST_EQUIPMENT_CreatedDate DEFAULT (GETDATE()),
        ModifiedBy INT NULL,
        ModifiedDate DATETIME NULL,
        DeletedBy INT NULL,
        DeletedDate DATETIME NULL
    );
END
GO

IF OBJECT_ID(N'dbo.TBL_EQUIPMENT_HEIGHT_SETTING', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TBL_EQUIPMENT_HEIGHT_SETTING (
        HEIGHT_SETTING_ID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EQUIPMENT_ID BIGINT NULL,
        EQUIPMENT_NAME VARCHAR(100) NOT NULL,
        HEIGHT VARCHAR(50) NULL,
        MIN_HEIGHT DECIMAL(10,2) NOT NULL,
        MAX_HEIGHT DECIMAL(10,2) NOT NULL,
        IS_ACTIVE BIT NULL CONSTRAINT DF_TBL_EQUIPMENT_HEIGHT_SETTING_IS_ACTIVE DEFAULT (1),
        CREATED_BY VARCHAR(50) NULL,
        CREATED_DATE DATETIME NULL CONSTRAINT DF_TBL_EQUIPMENT_HEIGHT_SETTING_CREATED_DATE DEFAULT (GETDATE()),
        UPDATED_BY VARCHAR(50) NULL,
        UPDATED_DATE DATETIME NULL
    );
END
GO

IF OBJECT_ID(N'dbo.FK_TBL_EQUIPMENT_HEIGHT_SETTING_EQUIPMENT', N'F') IS NULL
    AND OBJECT_ID(N'dbo.TBL_EQUIPMENT_HEIGHT_SETTING', N'U') IS NOT NULL
    AND OBJECT_ID(N'dbo.TBL_MST_EQUIPMENT', N'U') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM dbo.TBL_EQUIPMENT_HEIGHT_SETTING hs
        WHERE hs.EQUIPMENT_ID IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM dbo.TBL_MST_EQUIPMENT e WHERE e.Eqp_ID = hs.EQUIPMENT_ID
          )
    )
BEGIN
    ALTER TABLE dbo.TBL_EQUIPMENT_HEIGHT_SETTING WITH CHECK
    ADD CONSTRAINT FK_TBL_EQUIPMENT_HEIGHT_SETTING_EQUIPMENT
        FOREIGN KEY (EQUIPMENT_ID) REFERENCES dbo.TBL_MST_EQUIPMENT(Eqp_ID);
END
GO

/* 2) TVP Type */
IF TYPE_ID(N'dbo.HeightSettingType') IS NULL
BEGIN
    CREATE TYPE dbo.HeightSettingType AS TABLE (
        EQUIPMENT_NAME NVARCHAR(200) NULL,
        HEIGHT FLOAT NULL,
        MIN_VALUE FLOAT NULL,
        MAX_VALUE FLOAT NULL
    );
END
GO

/* 3) Stored Procedures */
CREATE OR ALTER PROCEDURE dbo.TBL_MST_EQUIPMENT_INSERT
    @Plant_ID BIGINT,
    @Equipment_Name NVARCHAR(200),
    @Device_ID NVARCHAR(100) = NULL,
    @Installation_Date DATE = NULL,
    @Owner_Name NVARCHAR(200) = NULL,
    @Equipment_Type NVARCHAR(100) = NULL,
    @Equipment_Maker NVARCHAR(100) = NULL,
    @Sim_ID NVARCHAR(100) = NULL,
    @VTM_ImeiNo NVARCHAR(100) = NULL,
    @JobAllow BIT = 0,
    @IsActive BIT = 1,
    @IsRemoveDevice INT = 0,
    @IsManualBreakdown INT = 0,
    @CreatedBy INT = NULL,
    @HeightSettings dbo.HeightSettingType READONLY
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewEquipmentId BIGINT;

    INSERT INTO dbo.TBL_MST_EQUIPMENT (
        Plant_ID,
        Equipment_Name,
        Device_ID,
        Installation_Date,
        Owner_Name,
        Equipment_Type,
        Equipment_Maker,
        Sim_ID,
        VTM_ImeiNo,
        JobAllow,
        IsActive,
        IsDelete,
        IsRemoveDevice,
        IsManualBreakdown,
        CreatedBy,
        CreatedDate
    )
    VALUES (
        @Plant_ID,
        LEFT(CONVERT(VARCHAR(200), @Equipment_Name), 50),
        LEFT(CONVERT(VARCHAR(100), @Device_ID), 50),
        @Installation_Date,
        LEFT(CONVERT(VARCHAR(200), @Owner_Name), 100),
        LEFT(CONVERT(VARCHAR(100), @Equipment_Type), 100),
        LEFT(CONVERT(VARCHAR(100), @Equipment_Maker), 100),
        @Sim_ID,
        LEFT(CONVERT(VARCHAR(200), @VTM_ImeiNo), 200),
        @JobAllow,
        @IsActive,
        0,
        @IsRemoveDevice,
        @IsManualBreakdown,
        @CreatedBy,
        GETDATE()
    );

    SET @NewEquipmentId = SCOPE_IDENTITY();

    IF EXISTS (SELECT 1 FROM @HeightSettings)
    BEGIN
        INSERT INTO dbo.TBL_EQUIPMENT_HEIGHT_SETTING (
            EQUIPMENT_ID,
            EQUIPMENT_NAME,
            HEIGHT,
            MIN_HEIGHT,
            MAX_HEIGHT,
            IS_ACTIVE,
            CREATED_BY,
            CREATED_DATE
        )
        SELECT
            @NewEquipmentId,
            LEFT(CONVERT(VARCHAR(200), hs.EQUIPMENT_NAME), 100),
            CONVERT(VARCHAR(50), hs.HEIGHT),
            TRY_CONVERT(DECIMAL(10,2), hs.MIN_VALUE),
            TRY_CONVERT(DECIMAL(10,2), hs.MAX_VALUE),
            1,
            CONVERT(VARCHAR(50), @CreatedBy),
            GETDATE()
        FROM @HeightSettings hs
        WHERE hs.MIN_VALUE IS NOT NULL AND hs.MAX_VALUE IS NOT NULL;
    END

    SELECT
        CAST(1 AS INT) AS Status,
        CAST('Equipment inserted successfully' AS NVARCHAR(200)) AS Message,
        @NewEquipmentId AS EquipmentID;
END
GO

CREATE OR ALTER PROCEDURE dbo.TBL_MST_EQUIPMENT_GET
    @Equipment_ID BIGINT = NULL,
    @Plant_ID BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH eq AS (
        SELECT
            Eqp_ID,
            Plant_ID,
            Equipment_Name,
            Device_ID,
            Installation_Date,
            Owner_Name,
            Equipment_Type,
            Equipment_Maker,
            Sim_ID,
            VTM_ImeiNo,
            JobAllow,
            IsActive,
            IsRemoveDevice,
            IsManualBreakdown
        FROM dbo.TBL_MST_EQUIPMENT
        WHERE Plant_ID = @Plant_ID
                    AND ISNULL(IsDelete, 0) = 0
          AND (@Equipment_ID IS NULL OR Eqp_ID = @Equipment_ID)
    )
    SELECT * FROM eq ORDER BY Eqp_ID DESC;

    SELECT
                hs.EQUIPMENT_ID,
                TRY_CONVERT(FLOAT, hs.HEIGHT) AS HEIGHT,
                TRY_CONVERT(FLOAT, hs.MIN_HEIGHT) AS MIN_VALUE,
                TRY_CONVERT(FLOAT, hs.MAX_HEIGHT) AS MAX_VALUE,
                hs.EQUIPMENT_NAME
        FROM dbo.TBL_EQUIPMENT_HEIGHT_SETTING hs
    INNER JOIN eq ON eq.Eqp_ID = hs.EQUIPMENT_ID
        WHERE ISNULL(hs.IS_ACTIVE, 1) = 1
    ORDER BY hs.EQUIPMENT_ID, hs.HEIGHT;
END
GO

CREATE OR ALTER PROCEDURE dbo.TBL_MST_EQUIPMENT_UPDATE
    @Equipment_ID BIGINT,
    @Plant_ID BIGINT,
    @Equipment_Name NVARCHAR(200),
    @Device_ID NVARCHAR(100) = NULL,
    @Installation_Date DATE = NULL,
    @Owner_Name NVARCHAR(200) = NULL,
    @Equipment_Type NVARCHAR(100) = NULL,
    @Equipment_Maker NVARCHAR(100) = NULL,
    @Sim_ID NVARCHAR(100) = NULL,
    @VTM_ImeiNo NVARCHAR(100) = NULL,
    @JobAllow BIT = 0,
    @IsActive BIT = 1,
    @IsRemoveDevice INT = 0,
    @IsManualBreakdown INT = 0,
    @UpdatedBy INT = NULL,
    @HeightSettings dbo.HeightSettingType READONLY
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.TBL_MST_EQUIPMENT
    SET
        Equipment_Name = LEFT(CONVERT(VARCHAR(200), @Equipment_Name), 50),
        Device_ID = LEFT(CONVERT(VARCHAR(100), @Device_ID), 50),
        Installation_Date = @Installation_Date,
        Owner_Name = LEFT(CONVERT(VARCHAR(200), @Owner_Name), 100),
        Equipment_Type = LEFT(CONVERT(VARCHAR(100), @Equipment_Type), 100),
        Equipment_Maker = LEFT(CONVERT(VARCHAR(100), @Equipment_Maker), 100),
        Sim_ID = @Sim_ID,
        VTM_ImeiNo = LEFT(CONVERT(VARCHAR(200), @VTM_ImeiNo), 200),
        JobAllow = @JobAllow,
        IsActive = @IsActive,
        IsRemoveDevice = @IsRemoveDevice,
        IsManualBreakdown = @IsManualBreakdown,
        ModifiedBy = @UpdatedBy,
        ModifiedDate = GETDATE()
    WHERE Eqp_ID = @Equipment_ID
      AND Plant_ID = @Plant_ID
            AND ISNULL(IsDelete, 0) = 0;

    /* Replace height settings */
    DELETE FROM dbo.TBL_EQUIPMENT_HEIGHT_SETTING
    WHERE EQUIPMENT_ID = @Equipment_ID;

    IF EXISTS (SELECT 1 FROM @HeightSettings)
    BEGIN
        INSERT INTO dbo.TBL_EQUIPMENT_HEIGHT_SETTING (
            EQUIPMENT_ID,
            EQUIPMENT_NAME,
            HEIGHT,
            MIN_HEIGHT,
            MAX_HEIGHT,
            IS_ACTIVE,
            CREATED_BY,
            CREATED_DATE
        )
        SELECT
            @Equipment_ID,
            LEFT(CONVERT(VARCHAR(200), hs.EQUIPMENT_NAME), 100),
            CONVERT(VARCHAR(50), hs.HEIGHT),
            TRY_CONVERT(DECIMAL(10,2), hs.MIN_VALUE),
            TRY_CONVERT(DECIMAL(10,2), hs.MAX_VALUE),
            1,
            CONVERT(VARCHAR(50), @UpdatedBy),
            GETDATE()
        FROM @HeightSettings hs
        WHERE hs.MIN_VALUE IS NOT NULL AND hs.MAX_VALUE IS NOT NULL;
    END

    SELECT
        CAST(1 AS INT) AS Status,
        CAST('Equipment updated successfully' AS NVARCHAR(200)) AS Message,
        @Equipment_ID AS EquipmentID;
END
GO

CREATE OR ALTER PROCEDURE dbo.TBL_MST_EQUIPMENT_DELETE
        @Equipment_ID BIGINT,
    @DeletedBy INT = NULL,
        @Plant_ID BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.TBL_MST_EQUIPMENT
    SET
                IsDelete = 1,
                DeletedBy = @DeletedBy,
                DeletedDate = GETDATE()
    WHERE Eqp_ID = @Equipment_ID
      AND Plant_ID = @Plant_ID
            AND ISNULL(IsDelete, 0) = 0;

        UPDATE dbo.TBL_EQUIPMENT_HEIGHT_SETTING
    SET
                IS_ACTIVE = 0,
                UPDATED_BY = CONVERT(VARCHAR(50), @DeletedBy),
                UPDATED_DATE = GETDATE()
    WHERE EQUIPMENT_ID = @Equipment_ID
            AND ISNULL(IS_ACTIVE, 1) = 1;

    SELECT
        CAST(1 AS INT) AS Status,
        CAST('Equipment deleted successfully' AS NVARCHAR(200)) AS Message,
        @Equipment_ID AS EquipmentID;
END
GO
