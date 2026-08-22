-- Update a transaction record.
CREATE OR ALTER PROCEDURE dbo.SP_MOVEMENT_TRANSACTION_UPDATE
    @TransactionId INT,
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
        UPDATE dbo.TBL_EQUIPMENT_TRANSACTION
        SET
            LOCATION_ID = @LocationId,
            INVENTORY_ID = @InventoryId,
            CONTAINER_TAG_ID = @ContainerTagId,
            OCR_CONTAINER_NO = @OcrContainerNo,
            GPS_LATITUDE = @GpsLatitude,
            GPS_LONGITUDE = @GpsLongitude,
            DEVICE_ID = @DeviceId,
            PACKET_TYPE = @PacketType,
            CONTAINER_TRANS_TYPE = @ContainerTransType,
            TRANSACTION_DATE = COALESCE(@TransactionDate, TRANSACTION_DATE)
        WHERE TRANSACTION_ID = @TransactionId;

        IF @@ROWCOUNT = 0
        BEGIN
            SELECT CAST(0 AS INT) AS Status, N'Equipment transaction not found' AS Message;
            RETURN;
        END

        SELECT CAST(1 AS INT) AS Status, N'Equipment transaction updated successfully' AS Message;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_MOVEMENT_TRANSACTION_UPDATE failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
