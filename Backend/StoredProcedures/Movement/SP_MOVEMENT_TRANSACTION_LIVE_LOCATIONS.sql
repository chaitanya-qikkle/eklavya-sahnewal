-- Latest GPS location per device.
CREATE OR ALTER PROCEDURE dbo.SP_MOVEMENT_TRANSACTION_LIVE_LOCATIONS
    @PlantId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        WITH ranked AS (
            SELECT
                DEVICE_ID,
                TRY_CONVERT(float, GPS_LATITUDE) AS LAT,
                TRY_CONVERT(float, GPS_LONGITUDE) AS LNG,
                LOCATION_ID,
                OCR_CONTAINER_NO,
                CONTAINER_TAG_ID,
                COALESCE(TRANSACTION_DATE, CREATED_ON) AS LAST_AT,
                ROW_NUMBER() OVER (
                    PARTITION BY DEVICE_ID
                    ORDER BY COALESCE(TRANSACTION_DATE, CREATED_ON) DESC, TRANSACTION_ID DESC
                ) AS RN
            FROM dbo.TBL_EQUIPMENT_TRANSACTION
            WHERE
                DEVICE_ID IS NOT NULL
                AND TRY_CONVERT(float, GPS_LATITUDE) IS NOT NULL
                AND TRY_CONVERT(float, GPS_LONGITUDE) IS NOT NULL
        )
        SELECT
            DEVICE_ID,
            LAT,
            LNG,
            LOCATION_ID,
            OCR_CONTAINER_NO,
            CONTAINER_TAG_ID,
            LAST_AT
        FROM ranked
        WHERE RN = 1;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT = ERROR_NUMBER();
        RAISERROR('SP_MOVEMENT_TRANSACTION_LIVE_LOCATIONS failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
