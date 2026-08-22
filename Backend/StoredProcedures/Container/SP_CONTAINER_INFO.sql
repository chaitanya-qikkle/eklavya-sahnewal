-- ============================================================
-- SP_CONTAINER_INFO
-- Returns gate-in details, size, type, and last location
-- for a single container number.
-- Used by: Container info panel, mobile lookups.
--
-- Parameters:
--   @ContainerNo  NVARCHAR(20)  Container number (exact match)
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_CONTAINER_INFO
    @ContainerNo NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        I.CONTAINER_NO,
        S.SizeCode                                          AS CONTAINER_SIZE,
        S.Description                                       AS SIZE_DESC,
        T.TypeCode                                          AS CONTAINER_TYPE,
        T.TypeDesc                                          AS TYPE_DESC,
        T.ISOCode                                           AS ISO_CODE,
        I.GATE_IN_DATE,
        I.GATE_OUT_DATE,
        I.OFFLOAD_DATE,
        I.INVENTORY_STATUS,
        CASE
            WHEN I.CONTAINER_SIZE_ID = 1 THEN L.ContainerLocationName1
            ELSE L.ContainerLocationName
        END                                                 AS LAST_LOCATION_NAME
    FROM TBL_CONTAINER_INVENTORY I
    LEFT JOIN TBL_MST_CONT_SIZE S ON S.SizeID    = I.CONTAINER_SIZE_ID
    LEFT JOIN TBL_MST_CONT_TYPE T ON T.TypeID    = I.CONTAINER_TYPE_ID
    LEFT JOIN ESS_MST_LOCATION  L ON L.LocationID = I.LAST_LOCATION
    WHERE I.CONTAINER_NO = @ContainerNo
      AND I.CONTAINER_NO IS NOT NULL
      AND I.CONTAINER_NO <> ''
    ORDER BY I.GATE_IN_DATE DESC;
END;
GO
