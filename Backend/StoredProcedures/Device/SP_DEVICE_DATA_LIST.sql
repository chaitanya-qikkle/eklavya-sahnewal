-- Device data search with optional filters, pagination, and sorting.
CREATE OR ALTER PROCEDURE dbo.SP_DEVICE_DATA_LIST
    @PlantId INT,
    @DeviceIdsCsv NVARCHAR(MAX) = NULL,
    @PacketId INT = NULL,
    @ContainerNo NVARCHAR(100) = NULL,
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
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
        IF @DeviceIdsCsv IS NOT NULL AND LTRIM(RTRIM(@DeviceIdsCsv)) <> N''
        BEGIN
            INSERT INTO @DeviceIds (DeviceId)
            SELECT DISTINCT UPPER(LTRIM(RTRIM(value)))
            FROM STRING_SPLIT(@DeviceIdsCsv, N',')
            WHERE LTRIM(RTRIM(value)) <> N'';
        END

        SELECT
            d.DEVICE_IMEI,
            d.KALMAR_NO,
            d.PACKET_ID,
            d.DATE_TIME,
            d.RFIDDATA,
            d.FRAMEID,
            d.Sr_No,
            TRY_CONVERT(float, d.LATITUDE) AS LATITUDE,
            TRY_CONVERT(float, d.LONGITUDE) AS LONGITUDE,
            COUNT(*) OVER() AS TOTAL_COUNT
        FROM dbo.TBL_EKDEVICE_DATA AS d
        INNER JOIN dbo.TBL_MST_EQUIPMENT AS e
            ON UPPER(LTRIM(RTRIM(e.Device_ID))) = UPPER(LTRIM(RTRIM(d.DEVICE_IMEI)))
        WHERE
            e.Plant_ID = @PlantId
            AND (
                NOT EXISTS (SELECT 1 FROM @DeviceIds)
                OR UPPER(LTRIM(RTRIM(d.DEVICE_IMEI))) IN (SELECT DeviceId FROM @DeviceIds)
            )
            AND (@PacketId IS NULL OR d.PACKET_ID = @PacketId)
            AND (
                @ContainerNo IS NULL
                OR LTRIM(RTRIM(@ContainerNo)) = N''
                OR UPPER(LTRIM(RTRIM(d.RFIDDATA))) = UPPER(LTRIM(RTRIM(@ContainerNo)))
            )
            AND (@FromDate IS NULL OR d.DATE_TIME >= @FromDate)
            AND (@ToDate IS NULL OR d.DATE_TIME <= @ToDate)
        ORDER BY d.DATE_TIME DESC, d.Sr_No DESC
        OFFSET @Offset ROWS
        FETCH NEXT @PageSize ROWS ONLY;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_DEVICE_DATA_LIST failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
