-- Add a transaction record.
CREATE OR ALTER PROCEDURE dbo.SP_MOVEMENT_TRANSACTION_ADD
    @PlantId INT = NULL,
    @LocationId INT = NULL,
    @InventoryId INT = NULL,
    @ContainerTagId INT = NULL,
    @OcrContainerNo NVARCHAR(30) = NULL,
    @GpsLatitude DECIMAL(10, 8) = NULL,
    @GpsLongitude DECIMAL(11, 8) = NULL,
    @DeviceId VARCHAR(50) = NULL,
    @PacketType VARCHAR(50) = NULL,
    @ContainerTransType INT = NULL,
    @TransactionDate DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        INSERT INTO dbo.TBL_EQUIPMENT_TRANSACTION (
            LOCATION_ID,
            INVENTORY_ID,
            CONTAINER_TAG_ID,
            OCR_CONTAINER_NO,
            GPS_LATITUDE,
            GPS_LONGITUDE,
            DEVICE_ID,
            PACKET_TYPE,
            CONTAINER_TRANS_TYPE,
            TRANSACTION_DATE,
            CREATED_ON
        )
        VALUES (
            @LocationId,
            @InventoryId,
            @ContainerTagId,
            @OcrContainerNo,
            @GpsLatitude,
            @GpsLongitude,
            @DeviceId,
            @PacketType,
            @ContainerTransType,
            COALESCE(@TransactionDate, GETDATE()),
            GETDATE()
        );

        SELECT CAST(1 AS INT) AS Status, N'Equipment transaction added successfully' AS Message;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_MOVEMENT_TRANSACTION_ADD failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
