CREATE OR ALTER PROCEDURE dbo.SP_CONTAINER_GATE_REPORT
    @FromDate DATETIME = NULL,
    @ToDate   DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @FromDate IS NULL SET @FromDate = CAST(GETDATE() - 1 AS DATE);
    IF @ToDate   IS NULL SET @ToDate   = GETDATE();

    SELECT
        I.CONTAINER_NO,
        si.SizeCode                                                         AS Cont_Size,
        ct.TypeCode                                                         AS Cont_Type,
        p.ProcessCode,
        I.Gate_In_Date,
        I.Gate_Out_Date,
        [dbo].[ConvertDDHHMMSS](I.Gate_In_Date, GETDATE())                 AS TAT,
        [dbo].[ConvertDDHHMMSS](I.Gate_In_Date, I.Gate_Out_Date)           AS OUTTAT,
        ''                                                                  AS OffLocation,
        ''                                                                  AS LastLocation
    FROM TBL_CONTAINER_INVENTORY I
    LEFT JOIN TBL_MST_CONT_SIZE si ON I.CONTAINER_SIZE_ID = si.SizeID
    LEFT JOIN TBL_MST_CONT_TYPE ct ON I.CONTAINER_TYPE_ID = ct.TypeID
    LEFT JOIN TBL_MST_PROCESS   p  ON I.CONTAINER_PROCESS_ID = p.ProcessID
    WHERE I.Gate_In_Date BETWEEN @FromDate AND @ToDate
      AND I.CONTAINER_NO IS NOT NULL
      AND I.CONTAINER_NO <> ''
    ORDER BY I.Gate_In_Date DESC;
END;
GO
