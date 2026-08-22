-- ============================================================
-- SP_YARD_3D_SLOT_LIST
-- Returns containers with equipment-confirmed 3D positions.
-- Source: TBL_EQUIPMENT_TRANSACTION (PACKET_TYPE = 'UK' = unlock).
-- Each row is the latest unlock event per container,
-- enriched with size/type/status from TBL_CONTAINER_INVENTORY.
-- Used by: 3D Yard Visualization (equipment-positioned view).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_YARD_3D_SLOT_LIST
AS
BEGIN
    SET NOCOUNT ON;

    WITH LatestUnlock AS (
        SELECT
            OCR_CONTAINER_NO,
            LOCATION_ID,
            ROW_NUMBER() OVER (
                PARTITION BY OCR_CONTAINER_NO
                ORDER BY TRANSACTION_DATE DESC
            ) AS rn
        FROM TBL_EQUIPMENT_TRANSACTION
        WHERE PACKET_TYPE         = 'UK'
          AND OCR_CONTAINER_NO   != '00000000000'
          AND OCR_CONTAINER_NO  IS NOT NULL
          AND OCR_CONTAINER_NO   <> ''
    )
    SELECT
        lu.OCR_CONTAINER_NO                              AS CONTAINER_NO,
        l.ContainerLocationName                          AS LOCATION_NAME,
        LTRIM(RTRIM(ISNULL(l.BlockName,   '')))         AS BLOCK_NAME,
        ISNULL(l.RowNo,      '')                         AS ROW_NO,
        ISNULL(l.ColumnName, '')                         AS COLUMN_NAME,
        ISNULL(l.StackNo,     1)                         AS STACK_NO,
        l.SlotId                                         AS SLOT_ID,
        ISNULL(s.SizeCode,  '40')                        AS CONTAINER_SIZE,
        ISNULL(t.TypeCode,  'GP')                        AS CONTAINER_TYPE,
        UPPER(ISNULL(i.INVENTORY_STATUS, 'FULL'))        AS INVENTORY_STATUS,
        i.GATE_IN_DATE,
        DATEDIFF(DAY, i.GATE_IN_DATE, GETDATE())         AS DWELL_DAYS,
        ISNULL(i.INVENTORY_ID, 0)                        AS INVENTORY_ID
    FROM LatestUnlock lu
    JOIN  ESS_MST_LOCATION        l  ON l.LocationID  = lu.LOCATION_ID
    LEFT JOIN TBL_CONTAINER_INVENTORY i
           ON i.CONTAINER_NO = lu.OCR_CONTAINER_NO
          AND i.GATE_OUT_DATE IS NULL
    LEFT JOIN TBL_MST_CONT_SIZE   s  ON s.SizeID      = i.CONTAINER_SIZE_ID
    LEFT JOIN TBL_MST_CONT_TYPE   t  ON t.TypeID      = i.CONTAINER_TYPE_ID
    WHERE lu.rn = 1;
END;
GO
