-- ============================================================
-- SP_INVENTORY_LIST
-- All in-yard containers with current location, size, type,
-- process, and dwell days. No pagination — returns full set.
-- Used by: Inventory Entry screen (mobile), container tracking.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_INVENTORY_LIST
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        I.INVENTORY_ID,
        I.CONTAINER_NO,
        S.SizeCode                                      AS CONTAINER_SIZE,
        T.TypeCode                                      AS CONTAINER_TYPE,
        UPPER(P.ProcessCode)                            AS CONTAINER_PROCESS,
        UPPER(I.INVENTORY_STATUS)                       AS INVENTORY_STATUS,
        I.GATE_IN_DATE,
        I.OFFLOAD_DATE,
        I.LAST_MOVED_DATE,
        L.BlockName                                     AS BLOCK_NAME,
        L.RowNo                                         AS ROW_NO,
        L.ColumnName                                    AS COLUMN_NAME,
        L.StackNo                                       AS STACK_NO,
        CASE
            WHEN I.CONTAINER_SIZE_ID = 1 THEN L.ContainerLocationName1
            ELSE L.ContainerLocationName
        END                                             AS LOCATION_NAME,
        DATEDIFF(DAY, I.GATE_IN_DATE, GETDATE())        AS DWELL_DAYS
    FROM TBL_CONTAINER_INVENTORY I
    LEFT JOIN TBL_MST_CONT_SIZE  S ON S.SizeID    = I.CONTAINER_SIZE_ID
    LEFT JOIN TBL_MST_CONT_TYPE  T ON T.TypeID    = I.CONTAINER_TYPE_ID
    LEFT JOIN TBL_MST_PROCESS    P ON P.ProcessID = I.CONTAINER_PROCESS_ID
    LEFT JOIN ESS_MST_LOCATION   L ON L.LocationID = I.LAST_LOCATION
    WHERE I.GATE_OUT_DATE IS NULL
      AND I.CONTAINER_NO IS NOT NULL
      AND I.CONTAINER_NO <> ''
    ORDER BY I.GATE_IN_DATE DESC;
END;
GO
