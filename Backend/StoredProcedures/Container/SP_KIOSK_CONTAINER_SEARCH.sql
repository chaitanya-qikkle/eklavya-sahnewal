

--   @Term   NVARCHAR(50)  partial container number (required)
--   @Top    INT           max rows to return (default 20)
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_KIOSK_CONTAINER_SEARCH
    @Term  NVARCHAR(50),
    @Top   INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Top IS NULL OR @Top < 1  SET @Top = 20;
    IF @Top > 100                SET @Top = 100;

    SELECT TOP (@Top)
        g.INVENTORY_ID,
        g.CONTAINER_NO,
        s.SizeCode                                          AS CONTAINER_SIZE,
        c.TypeCode                                          AS CONTAINER_TYPE,
        UPPER(p.ProcessCode)                                AS CONTAINER_PROCESS,
        UPPER(g.INVENTORY_STATUS)                           AS INVENTORY_STATUS,
        g.GATE_IN_DATE,
        ISNULL(g.LAST_MOVED_DATE, g.OFFLOAD_DATE)          AS TOSS_IN_DATE,
        g.OFFLOAD_DATE,
        CASE
            WHEN UPPER(p.ProcessCode) = 'EMPTY'
             AND UPPER(g.INVENTORY_STATUS) = 'EMPTY'
             AND g.LAST_LOCATION IS NULL
                THEN 'EMPTY-YARD'
            ELSE
                CASE
                    WHEN g.CONTAINER_SIZE_ID = 1 THEN ll.ContainerLocationName1
                    ELSE ll.ContainerLocationName
                END
        END                                                  AS MASTERTABLE,
        eq.Equipment_Name                                    AS OFFLOAD_EQP,
        CAST(g.LAST_LAT AS FLOAT)                           AS OFFLOAD_LAT,
        CAST(g.LAST_LON AS FLOAT)                           AS OFFLOAD_LON,
        [dbo].[ConvertDDHHMMSS](g.GATE_IN_DATE, GETDATE()) AS TIME_IN_YARD,
        DATEDIFF(DAY, g.GATE_IN_DATE, GETDATE())            AS DWELL_DAYS,
        ll.BlockName                                         AS BLOCK_NAME,
        ll.RowNo                                             AS ROW_NO,
        ll.ColumnName                                        AS COLUMN_NAME,
        ll.StackNo                                           AS STACK_NO
    FROM TBL_CONTAINER_INVENTORY g
    LEFT JOIN TBL_MST_EQUIPMENT  eq ON eq.Eqp_ID      = g.LAST_EQP
    LEFT JOIN ESS_MST_LOCATION   ll ON ll.LocationID  = g.LAST_LOCATION
    LEFT JOIN TBL_MST_CONT_SIZE   s ON s.SizeID       = g.CONTAINER_SIZE_ID
    LEFT JOIN TBL_MST_CONT_TYPE   c ON c.TypeID       = g.CONTAINER_TYPE_ID
    LEFT JOIN TBL_MST_PROCESS     p ON p.ProcessID    = g.CONTAINER_PROCESS_ID
    WHERE g.GATE_OUT_DATE IS NULL
      AND g.CONTAINER_NO IS NOT NULL
      AND g.CONTAINER_NO <> ''
      AND g.CONTAINER_NO LIKE '%' + LTRIM(RTRIM(@Term)) + '%'
    ORDER BY
        CASE WHEN g.CONTAINER_NO LIKE LTRIM(RTRIM(@Term)) + '%' THEN 0 ELSE 1 END,
        g.CONTAINER_NO;
END;
GO
