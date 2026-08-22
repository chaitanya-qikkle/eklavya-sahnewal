
CREATE OR ALTER PROCEDURE dbo.SP_YARD_3D_INVENTORY
AS
BEGIN
    SET NOCOUNT ON;

 
    WITH Base AS (
        SELECT
            I.INVENTORY_ID,
            I.CONTAINER_NO,
            I.CONTAINER_SIZE_ID,
            I.CONTAINER_TYPE_ID,
            I.INVENTORY_STATUS,
            I.GATE_IN_DATE,
            I.OFFLOAD_DATE,
            I.LAST_MOVED_DATE,
            L.BlockName                 AS BLOCK_NAME,
            L.RowNo                     AS ROW_NO,
            L.ColumnName                AS COLUMN_NAME,
            L.ContainerLocationName     AS LOCATION_NAME,
            L.ContainerLocationName1    AS LOCATION_NAME_20FT,
            L.SlotId                    AS SLOT_ID,
           
            ISNULL(TRY_CAST(L.StackNo AS INT), 0) AS RAW_STACK,
            SL.SlotName                 AS SLOT_NAME,
            BL.BlockName                AS SLOT_BLOCK,
            SL.[Row]                    AS SLOT_ROW,
            SL.[Column]                 AS SLOT_COL
        FROM TBL_CONTAINER_INVENTORY I
        LEFT JOIN ESS_MST_LOCATION   L  ON L.LocationID = I.LAST_LOCATION
        LEFT JOIN ESS_MST_SLOT       SL ON SL.SlotID    = L.SlotId
        LEFT JOIN ESS_MST_BLOCK      BL ON BL.BlockID   = SL.BlockId
        WHERE I.GATE_OUT_DATE IS NULL
          AND I.CONTAINER_NO  IS NOT NULL
          AND I.CONTAINER_NO  <> ''
    ),

  
    ConflictCheck AS (
        SELECT
            SLOT_ID,
            RAW_STACK,
            COUNT(*) AS cnt
        FROM Base
        WHERE SLOT_ID IS NOT NULL AND RAW_STACK BETWEEN 1 AND 4
        GROUP BY SLOT_ID, RAW_STACK
    ),

  
    Tagged AS (
        SELECT
            B.*,
            CASE
                WHEN B.SLOT_ID IS NULL        THEN 1  
                WHEN B.RAW_STACK NOT BETWEEN 1 AND 4 THEN 1 
                WHEN C.cnt > 1                THEN 1
                ELSE 0
            END AS NEEDS_REASSIGN
        FROM Base B
        LEFT JOIN ConflictCheck C
            ON  C.SLOT_ID   = B.SLOT_ID
            AND C.RAW_STACK = B.RAW_STACK
    ),

   
    Resolved AS (
        SELECT
            *,
            ROW_NUMBER() OVER (
                PARTITION BY COALESCE(CAST(SLOT_ID AS VARCHAR(20)), LOCATION_NAME, CAST(INVENTORY_ID AS VARCHAR(20)))
                ORDER BY
                
                    CASE WHEN RAW_STACK BETWEEN 1 AND 4 THEN RAW_STACK ELSE 99 END,
                    GATE_IN_DATE ASC,
                    INVENTORY_ID ASC
            ) AS DERIVED_TIER
        FROM Tagged
        WHERE NEEDS_REASSIGN = 1
    )

  
    SELECT
        T.INVENTORY_ID,
        T.CONTAINER_NO,
        S.SizeCode                      AS CONTAINER_SIZE,
        TP.TypeCode                     AS CONTAINER_TYPE,
        TP.ISOCode                      AS ISO_CODE,
        T.INVENTORY_STATUS,
        T.GATE_IN_DATE,
        T.OFFLOAD_DATE,
        T.LAST_MOVED_DATE,
        T.BLOCK_NAME,
        T.ROW_NO,
        T.COLUMN_NAME,
      
        CASE
            WHEN T.NEEDS_REASSIGN = 0
                THEN T.RAW_STACK
            ELSE
                CASE WHEN R.DERIVED_TIER <= 4 THEN R.DERIVED_TIER ELSE 4 END
        END                             AS STACK_NO,
        T.LOCATION_NAME,
        T.LOCATION_NAME_20FT,
        T.SLOT_ID,
        T.SLOT_NAME,
        T.SLOT_BLOCK,
        T.SLOT_ROW,
        T.SLOT_COL,
        DATEDIFF(DAY, T.GATE_IN_DATE, GETDATE()) AS DWELL_DAYS,
        T.RAW_STACK                     AS DB_STACK_NO,
      
        CASE WHEN R.DERIVED_TIER > 4 THEN 1 ELSE 0 END AS OVER_CAPACITY
    FROM Tagged T
    LEFT JOIN Resolved R ON R.INVENTORY_ID = T.INVENTORY_ID
    LEFT JOIN TBL_MST_CONT_SIZE S  ON S.SizeID  = T.CONTAINER_SIZE_ID
    LEFT JOIN TBL_MST_CONT_TYPE TP ON TP.TypeID = T.CONTAINER_TYPE_ID
    ORDER BY T.SLOT_ID, STACK_NO;

END;
GO
