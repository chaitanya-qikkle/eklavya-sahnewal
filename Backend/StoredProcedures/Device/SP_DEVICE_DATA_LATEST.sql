-- Latest unlock packet per device for a plant.
CREATE OR ALTER PROCEDURE dbo.SP_DEVICE_DATA_LATEST
    @PlantId INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        WITH ranked AS (
            SELECT
                d.DEVICE_IMEI,
                d.DATE_TIME AS LAST_TRANSACTION_DATE,
                d.RFIDDATA,
                d.PACKET_ID,
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
                AND d.PACKET_ID = 8
                AND e.Plant_ID = @PlantId
        )
        SELECT
            DEVICE_IMEI,
            LAST_TRANSACTION_DATE,
            RFIDDATA,
            PACKET_ID
        FROM ranked
        WHERE RN = 1;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_DEVICE_DATA_LATEST failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
