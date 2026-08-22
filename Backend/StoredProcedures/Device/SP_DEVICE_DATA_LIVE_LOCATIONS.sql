-- Latest GPS location per device plus latest unlock packet.
CREATE OR ALTER PROCEDURE dbo.SP_DEVICE_DATA_LIVE_LOCATIONS
    @PlantId INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        WITH latest_location AS (
            SELECT
                d.DEVICE_IMEI,
                d.KALMAR_NO,
                d.DATE_TIME AS LAST_AT,
                CASE
                    WHEN UPPER(LTRIM(RTRIM(CONVERT(nvarchar(10), d.LAT_DIR)))) = 'S'
                        THEN -1
                    ELSE 1
                END * TRY_CONVERT(float, d.LATITUDE) AS LAT,
                CASE
                    WHEN UPPER(LTRIM(RTRIM(CONVERT(nvarchar(10), d.LON_DIR)))) = 'W'
                        THEN -1
                    ELSE 1
                END * TRY_CONVERT(float, d.LONGITUDE) AS LNG,
                d.Sr_No,
                ROW_NUMBER() OVER (
                    PARTITION BY d.DEVICE_IMEI
                    ORDER BY d.DATE_TIME DESC, d.Sr_No DESC
                ) AS RN
            FROM dbo.TBL_EKDEVICE_DATA AS d
            INNER JOIN dbo.TBL_MST_EQUIPMENT AS e
                ON UPPER(LTRIM(RTRIM(e.Device_ID))) = UPPER(LTRIM(RTRIM(d.DEVICE_IMEI)))
            WHERE
                d.DEVICE_IMEI IS NOT NULL
                AND LTRIM(RTRIM(d.DEVICE_IMEI)) <> ''
                AND TRY_CONVERT(float, d.LATITUDE) IS NOT NULL
                AND TRY_CONVERT(float, d.LONGITUDE) IS NOT NULL
                AND e.Plant_ID = @PlantId
        )
        SELECT
            loc.DEVICE_IMEI,
            loc.KALMAR_NO,
            latest_unlock.RFIDDATA,
            latest_unlock.PACKET_ID,
            latest_unlock.LAST_UK_AT,
            loc.LAST_AT,
            loc.LAT,
            loc.LNG
        FROM latest_location AS loc
        OUTER APPLY (
            SELECT TOP 1
                uk.RFIDDATA,
                uk.PACKET_ID,
                uk.DATE_TIME AS LAST_UK_AT
            FROM dbo.TBL_EKDEVICE_DATA AS uk
            WHERE
                UPPER(LTRIM(RTRIM(uk.DEVICE_IMEI))) = UPPER(LTRIM(RTRIM(loc.DEVICE_IMEI)))
                AND uk.PACKET_ID = 8
            ORDER BY uk.DATE_TIME DESC, uk.Sr_No DESC
        ) AS latest_unlock
        WHERE loc.RN = 1;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_DEVICE_DATA_LIVE_LOCATIONS failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
