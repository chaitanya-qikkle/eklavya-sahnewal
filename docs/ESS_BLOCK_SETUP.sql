-- ============================================================
-- ESS_MST_BLOCK table + stored procedures
-- Run this in SQL Server Management Studio
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ESS_MST_BLOCK')
BEGIN
  CREATE TABLE ESS_MST_BLOCK (
    BlockID       INT IDENTITY(1,1) PRIMARY KEY,
    YardID        INT NULL,
    PlantID       INT NOT NULL,
    BlockName     NVARCHAR(100) NOT NULL,
    BlockCode     NVARCHAR(50)  NULL,
    RowStart      NVARCHAR(5)   NULL,   -- e.g. 'A'
    RowEnd        NVARCHAR(5)   NULL,   -- e.g. 'G'
    TotalColumns  INT           NULL,
    Polygon       NVARCHAR(MAX) NULL,   -- JSON string from map
    IsActive      BIT           DEFAULT 1,
    IsDeleted     BIT           DEFAULT 0,
    CreatedBy     INT           NULL,
    CreatedDate   DATETIME      DEFAULT GETDATE(),
    ModifiedBy    INT           NULL,
    ModifiedDate  DATETIME      NULL
  );
END
GO

-- INSERT
CREATE OR ALTER PROCEDURE ESS_MST_BLOCK_INSERT
  @YardID INT, @PlantID INT, @BlockName NVARCHAR(100), @BlockCode NVARCHAR(50),
  @RowStart NVARCHAR(5), @RowEnd NVARCHAR(5), @TotalColumns INT,
  @Polygon NVARCHAR(MAX), @IsActive BIT, @CreatedBy INT
AS
BEGIN
  INSERT INTO ESS_MST_BLOCK (YardID,PlantID,BlockName,BlockCode,RowStart,RowEnd,TotalColumns,Polygon,IsActive,CreatedBy)
  VALUES (@YardID,@PlantID,@BlockName,@BlockCode,@RowStart,@RowEnd,@TotalColumns,@Polygon,@IsActive,@CreatedBy);
  SELECT SCOPE_IDENTITY() AS BlockID, 'Block saved successfully' AS Message, 1 AS Status;
END
GO

-- GET
CREATE OR ALTER PROCEDURE ESS_MST_BLOCK_GET
  @YardID INT = NULL, @PlantID INT
AS
BEGIN
  SELECT BlockID,YardID,PlantID,BlockName,BlockCode,RowStart,RowEnd,TotalColumns,Polygon,IsActive
  FROM ESS_MST_BLOCK
  WHERE PlantID=@PlantID AND ISNULL(IsDeleted,0)=0
    AND (@YardID IS NULL OR YardID=@YardID)
  ORDER BY BlockName;
END
GO

-- UPDATE
CREATE OR ALTER PROCEDURE ESS_MST_BLOCK_UPDATE
  @BlockID INT, @YardID INT, @PlantID INT, @BlockName NVARCHAR(100), @BlockCode NVARCHAR(50),
  @RowStart NVARCHAR(5), @RowEnd NVARCHAR(5), @TotalColumns INT,
  @Polygon NVARCHAR(MAX), @IsActive BIT, @ModifiedBy INT
AS
BEGIN
  UPDATE ESS_MST_BLOCK SET
    YardID=@YardID, BlockName=@BlockName, BlockCode=@BlockCode,
    RowStart=@RowStart, RowEnd=@RowEnd, TotalColumns=@TotalColumns,
    Polygon=@Polygon, IsActive=@IsActive, ModifiedBy=@ModifiedBy, ModifiedDate=GETDATE()
  WHERE BlockID=@BlockID AND PlantID=@PlantID;
  SELECT 1 AS Status, 'Updated' AS Message;
END
GO

-- DELETE
CREATE OR ALTER PROCEDURE ESS_MST_BLOCK_DELETE
  @BlockID INT, @DeletedBy INT, @PlantID INT
AS
BEGIN
  UPDATE ESS_MST_BLOCK SET IsDeleted=1,ModifiedBy=@DeletedBy,ModifiedDate=GETDATE()
  WHERE BlockID=@BlockID AND PlantID=@PlantID;
  SELECT 1 AS Status, 'Deleted' AS Message;
END
GO
