CREATE OR ALTER PROCEDURE dbo.SP_MONTHLY_GATE_INOUT
    @FromDate DATE = NULL,
    @ToDate   DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @FromDate IS NULL SET @FromDate = DATEADD(MONTH, -6, CAST(GETDATE() AS DATE));
    IF @ToDate   IS NULL SET @ToDate   = CAST(GETDATE() AS DATE);

    -- Gate-in counts by month (containers that entered in the window)
    SELECT
        'IN'                                          AS MOVEMENT_TYPE,
        FORMAT(ci.GATE_IN_DATE, 'yyyy-MM')           AS MONTH_KEY,
        COUNT(DISTINCT ci.CONTAINER_NO)              AS CONTAINER_COUNT
    FROM TBL_CONTAINER_INVENTORY ci
    WHERE ci.CONTAINER_NO IS NOT NULL
      AND ci.CONTAINER_NO <> ''
      AND CAST(ci.GATE_IN_DATE AS DATE) BETWEEN @FromDate AND @ToDate
    GROUP BY FORMAT(ci.GATE_IN_DATE, 'yyyy-MM')

    UNION ALL

    -- Gate-out counts by month (containers that departed in the window)
    SELECT
        'OUT'                                         AS MOVEMENT_TYPE,
        FORMAT(ci.GATE_OUT_DATE, 'yyyy-MM')          AS MONTH_KEY,
        COUNT(DISTINCT ci.CONTAINER_NO)              AS CONTAINER_COUNT
    FROM TBL_CONTAINER_INVENTORY ci
    WHERE ci.CONTAINER_NO IS NOT NULL
      AND ci.CONTAINER_NO <> ''
      AND ci.GATE_OUT_DATE IS NOT NULL
      AND CAST(ci.GATE_OUT_DATE AS DATE) BETWEEN @FromDate AND @ToDate
    GROUP BY FORMAT(ci.GATE_OUT_DATE, 'yyyy-MM')

    ORDER BY MONTH_KEY, MOVEMENT_TYPE;
END;
GO
