-- Transaction list with optional filters, pagination, and sorting.
CREATE OR ALTER PROCEDURE dbo.SP_MOVEMENT_TRANSACTION_LIST
    @PlantId INT = NULL,
    @DeviceIdsCsv NVARCHAR(MAX) = NULL,
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @ContainerTransType NVARCHAR(50) = NULL,
    @PacketType NVARCHAR(50) = NULL,
    @Page INT = 1,
    @PageSize INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        IF @Page IS NULL OR @Page < 1 SET @Page = 1;
        IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;
        IF @PageSize > 500 SET @PageSize = 500;

        DECLARE @Offset INT = (@Page - 1) * @PageSize;

        DECLARE @DeviceIds TABLE (DeviceId NVARCHAR(100) PRIMARY KEY);
        IF @DeviceIdsCsv IS NOT NULL AND LTRIM(RTRIM(@DeviceIdsCsv)) <> ''
        BEGIN
            INSERT INTO @DeviceIds (DeviceId)
            SELECT DISTINCT UPPER(LTRIM(RTRIM(value)))
            FROM STRING_SPLIT(@DeviceIdsCsv, ',')
            WHERE LTRIM(RTRIM(value)) <> '';
        END

        DECLARE @ContainerTransTypeNorm NVARCHAR(50) = LOWER(LTRIM(RTRIM(ISNULL(@ContainerTransType, ''))));
        DECLARE @ContainerTransTypeInt INT = TRY_CONVERT(INT, NULLIF(@ContainerTransTypeNorm, ''));
        DECLARE @PacketTypeNorm NVARCHAR(50) = LOWER(LTRIM(RTRIM(ISNULL(@PacketType, ''))));

        SELECT
            TRANSACTION_ID,
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
            CREATED_ON,
            COUNT(*) OVER() AS TOTAL_COUNT
        FROM dbo.TBL_EQUIPMENT_TRANSACTION
        WHERE
            (
                NOT EXISTS (SELECT 1 FROM @DeviceIds)
                OR UPPER(LTRIM(RTRIM(DEVICE_ID))) IN (SELECT DeviceId FROM @DeviceIds)
            )
            AND (
                @ContainerTransTypeNorm = ''
                OR @ContainerTransTypeNorm = 'all'
                OR (@ContainerTransTypeInt IS NOT NULL AND CONTAINER_TRANS_TYPE = @ContainerTransTypeInt)
            )
            AND (
                @PacketTypeNorm = ''
                OR (
                    @PacketTypeNorm = 'unlock' AND (
                        UPPER(LTRIM(RTRIM(PACKET_TYPE))) LIKE '%UNLOCK%'
                        OR TRY_CONVERT(INT, PACKET_TYPE) = 8
                    )
                )
                OR (
                    @PacketTypeNorm <> 'unlock' AND UPPER(LTRIM(RTRIM(PACKET_TYPE))) = UPPER(@PacketType)
                )
            )
            AND (@FromDate IS NULL OR COALESCE(TRANSACTION_DATE, CREATED_ON) >= @FromDate)
            AND (@ToDate IS NULL OR COALESCE(TRANSACTION_DATE, CREATED_ON) <= @ToDate)
        ORDER BY TRANSACTION_DATE DESC, CREATED_ON DESC, TRANSACTION_ID DESC
        OFFSET @Offset ROWS
        FETCH NEXT @PageSize ROWS ONLY;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_MOVEMENT_TRANSACTION_LIST failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
