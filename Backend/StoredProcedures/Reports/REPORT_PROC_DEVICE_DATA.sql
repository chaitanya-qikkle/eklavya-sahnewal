

CREATE OR ALTER PROCEDURE [dbo].[REPORT_PROC_DEVICE_DATA]
    @from_date  DATETIME       = NULL,
    @to_date    DATETIME       = NULL,
    @machine    NVARCHAR(100)  = NULL
AS
BEGIN
    SET NOCOUNT ON;

   
    SELECT
        d.PACKET_ID,
        d.GPS_FIX,
        d.DEVICE_IMEI,
        d.KALMAR_NO,
        e.Equipment_Name,
        d.DATE_TIME,
        d.LATITUDE,
        d.LONGITUDE,
        d.ANALOG1,
        d.ANALOG2,
        d.RFIDDATA,
        d.Sr_No
    FROM dbo.TBL_EKDEVICE_DATA AS d
    LEFT JOIN dbo.TBL_MST_EQUIPMENT AS e
        ON UPPER(LTRIM(RTRIM(e.VTM_ImeiNo))) = UPPER(LTRIM(RTRIM(d.KALMAR_NO)))
        AND ISNULL(e.IsDelete, 0) = 0
    WHERE
        (@from_date IS NULL OR d.DATE_TIME >= @from_date)
        AND (@to_date   IS NULL OR d.DATE_TIME <= @to_date)
        AND (
            @machine IS NULL
            OR LTRIM(RTRIM(@machine)) = N''
            OR UPPER(LTRIM(RTRIM(e.Equipment_Name))) = UPPER(LTRIM(RTRIM(@machine)))
        )
    ORDER BY d.DATE_TIME DESC, d.Sr_No DESC;
END;
