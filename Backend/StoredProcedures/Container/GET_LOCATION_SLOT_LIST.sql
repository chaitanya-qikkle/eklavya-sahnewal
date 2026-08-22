-- ============================================================
-- GET_LOCATION_SLOT_LIST
-- Returns all active yard slots with their GPS polygon data
-- for rendering on the 2D Container Map (Google Maps overlay).
--
-- Frontend expects:
--   SLOTNAME   → slot label text
--   SlotId     → unique slot ID
--   BLOCK      → block name
--   ROW        → row label
--   COLUMN     → column label
--   LATLONG    → "lat lng,lat lng,..." comma-separated polygon corners
--   PolygonWKT → fallback WKT polygon (POLYGON ((lng lat, ...)))
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.GET_LOCATION_SLOT_LIST
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        S.SlotId                                AS SlotId,
        S.SlotName                              AS SLOTNAME,
        B.BlockName                             AS BLOCK,
        S.[Row]                                 AS [ROW],
        S.[Column]                              AS [COLUMN],
        -- LATLONG: polygon vertices as "lat lng,lat lng,..." (same format as ESS_MST_YARD.LatLong)
        S.LatLong                               AS LATLONG,
        -- PolygonWKT: geometry polygon as WKT text for fallback parsing
        CASE
            WHEN S.Polygon IS NOT NULL
            THEN S.Polygon.STAsText()
            ELSE NULL
        END                                     AS PolygonWKT,
        B.BlockID                               AS BlockId,
        S.IsActive
    FROM ESS_MST_SLOT S
    LEFT JOIN ESS_MST_BLOCK B ON B.BlockID = S.BlockId
    WHERE S.IsActive = 1
    ORDER BY B.BlockName, S.[Row], S.[Column];
END;
GO
