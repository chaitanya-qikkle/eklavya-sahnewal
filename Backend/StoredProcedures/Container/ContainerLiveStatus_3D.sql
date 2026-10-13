-- ============================================================
-- ContainerLiveStatus_3D
-- In-yard container list for the realistic 3D scene.
-- Includes SlotId — a direct FK into ESS_MST_LOCATION — so the
-- frontend can place each container in its exact slot geometry
-- instead of parsing a combined location-name string.
-- Used by: /v1/container/container-live-status-3d (Yard Builder 3D view).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.ContainerLiveStatus_3D
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        g.InventoryID                                       AS INVENTORY_ID,
        g.ContNo                                             AS CONTAINER_NO,
        ISNULL(s.ContSize,  '40')                           AS CONTAINER_SIZE,
        ISNULL(t.ContTypeName, 'GP')                        AS CONTAINER_TYPE,
        UPPER(ISNULL(p.ProcessName, ''))                     AS CONTAINER_PROCESS,
        UPPER(ISNULL(g.ContainerStatus, 'FULL'))            AS INVENTORY_STATUS,
        g.GateInDate                                         AS GATE_IN_DATE,
        ISNULL(g.LastShiftDate, g.OffloadDate)              AS TOSS_IN_DATE,
        g.OffloadDate                                        AS OFFLOAD_DATE,
        ll.ContainerLocationName                             AS MASTERTABLE,
        eq.Equipment_Name                                    AS OFFLOAD_EQP,
        CAST(g.OffLatitude  AS FLOAT)                       AS OFFLOAD_LAT,
        CAST(g.OffLongitude AS FLOAT)                       AS OFFLOAD_LON,
        DATEDIFF(DAY, g.GateInDate, GETDATE())              AS DWELL_DAYS,
        ll.BlockName                                         AS SLOT_BLOCK,
        ll.RowNo                                             AS SLOT_ROW,
        ll.ColumnName                                        AS SLOT_COL,
        ll.StackNo                                           AS STACK_NO,
        ll.LocationID                                        AS LocationId,
        ll.SlotId                                            AS SlotId
    FROM EKL_TRN_INVENTORY g
    LEFT JOIN ESS_MST_EQUIPMENT       eq ON eq.EqpID        = TRY_CAST(g.EquipmentID AS BIGINT)
    LEFT JOIN ESS_MST_LOCATION        ll ON ll.LocationID   = g.LastLocID
    LEFT JOIN ESS_MST_CONTAINER_SIZE   s ON s.ContSizeID    = g.SizeID
    LEFT JOIN ESS_MST_CONTAINER_TYPE   t ON t.ContTypeID    = g.ContTypeId
    LEFT JOIN ESS_MST_PROCESS          p ON p.ProcessID     = g.ProcessID
    WHERE g.GateOutDate IS NULL
      AND g.ContNo IS NOT NULL
      AND g.ContNo <> ''
    ORDER BY g.GateInDate DESC;
END;
GO
