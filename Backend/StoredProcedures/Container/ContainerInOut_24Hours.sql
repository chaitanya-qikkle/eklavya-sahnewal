-- ============================================================
-- ContainerInOut_24Hours
-- Hourly gate-in / gate-out for the last 24h (25 rolling hour slots).
-- Existing columns are unchanged; Import / Export / Empty split by size
-- (GateIn/GateOut + Import/Export/Empty + 20/40) is appended at the end.
-- Used by: /v1/container/container-inout-24h (Admin Dashboard).
-- ============================================================
USE [YMS_EKLAVYA]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER PROCEDURE [dbo].[ContainerInOut_24Hours]
AS
BEGIN

    SET NOCOUNT ON;

    DECLARE @FromDate DATETIME;
    DECLARE @ToDate DATETIME;

    SET @ToDate = GETDATE();
    SET @FromDate = DATEADD(HOUR, -24, @ToDate);

    ;WITH Hours AS
    (
        SELECT DATEADD(HOUR, DATEDIFF(HOUR, 0, @FromDate), 0) AS HourStart

        UNION ALL

        SELECT DATEADD(HOUR, 1, HourStart)
        FROM Hours
        WHERE DATEADD(HOUR, 1, HourStart)
              <= DATEADD(HOUR, DATEDIFF(HOUR, 0, @ToDate), 0)
    ),

    /* ===================== GATE IN ===================== */
    ContainerIN AS
    (
        SELECT
            DATEADD(HOUR, DATEDIFF(HOUR, 0, GateInDate), 0) AS HourStart,

            COUNT(DISTINCT CASE WHEN ContainerSize IN ('20', '20HQ') THEN ContNo END) AS GateIn20,
            COUNT(DISTINCT CASE WHEN ContainerSize IN ('40', '40HQ') THEN ContNo END) AS GateIn40,
            COUNT(DISTINCT ContNo) AS ContainerIn,

            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(Process))) = 'IMPORT' AND ContainerSize IN ('20', '20HQ') THEN ContNo END) AS GateInImport20,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(Process))) = 'IMPORT' AND ContainerSize IN ('40', '40HQ') THEN ContNo END) AS GateInImport40,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(Process))) = 'EXPORT' AND ContainerSize IN ('20', '20HQ') THEN ContNo END) AS GateInExport20,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(Process))) = 'EXPORT' AND ContainerSize IN ('40', '40HQ') THEN ContNo END) AS GateInExport40,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(Process))) = 'EMPTY'  AND ContainerSize IN ('20', '20HQ') THEN ContNo END) AS GateInEmpty20,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(Process))) = 'EMPTY'  AND ContainerSize IN ('40', '40HQ') THEN ContNo END) AS GateInEmpty40

        FROM EKL_TRN_INVENTORY
        WHERE GateInDate >= @FromDate
          AND GateInDate <= @ToDate
        GROUP BY DATEADD(HOUR, DATEDIFF(HOUR, 0, GateInDate), 0)
    ),

    /* ===================== GATE OUT ===================== */
    ContainerOUT AS
    (
        SELECT
            DATEADD(HOUR, DATEDIFF(HOUR, 0, GateOutDate), 0) AS HourStart,

            COUNT(DISTINCT CASE WHEN ContainerSize IN ('20', '20HQ') THEN ContNo END) AS GateOut20,
            COUNT(DISTINCT CASE WHEN ContainerSize IN ('40', '40HQ') THEN ContNo END) AS GateOut40,
            COUNT(DISTINCT ContNo) AS ContainerOut,

            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(Process))) = 'IMPORT' AND ContainerSize IN ('20', '20HQ') THEN ContNo END) AS GateOutImport20,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(Process))) = 'IMPORT' AND ContainerSize IN ('40', '40HQ') THEN ContNo END) AS GateOutImport40,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(Process))) = 'EXPORT' AND ContainerSize IN ('20', '20HQ') THEN ContNo END) AS GateOutExport20,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(Process))) = 'EXPORT' AND ContainerSize IN ('40', '40HQ') THEN ContNo END) AS GateOutExport40,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(Process))) = 'EMPTY'  AND ContainerSize IN ('20', '20HQ') THEN ContNo END) AS GateOutEmpty20,
            COUNT(DISTINCT CASE WHEN UPPER(LTRIM(RTRIM(Process))) = 'EMPTY'  AND ContainerSize IN ('40', '40HQ') THEN ContNo END) AS GateOutEmpty40

        FROM EKL_TRN_INVENTORY
        WHERE GateOutDate >= @FromDate
          AND GateOutDate <= @ToDate
        GROUP BY DATEADD(HOUR, DATEDIFF(HOUR, 0, GateOutDate), 0)
    )

    /* ===================== FINAL RESULT ===================== */
    SELECT
        H.HourStart,
        DATEADD(HOUR, 1, H.HourStart) AS HourEnd,

        FORMAT(H.HourStart, 'dd-MM-yyyy HH:00')
        + ' - ' +
        FORMAT(DATEADD(HOUR, 1, H.HourStart), 'HH:00')
        AS HourSlot,

        ISNULL(I.GateIn20, 0)    AS GateIn20,
        ISNULL(I.GateIn40, 0)    AS GateIn40,
        ISNULL(I.ContainerIn, 0) AS TotalGateIn,

        ISNULL(O.GateOut20, 0)    AS GateOut20,
        ISNULL(O.GateOut40, 0)    AS GateOut40,
        ISNULL(O.ContainerOut, 0) AS TotalGateOut,

        ISNULL(I.ContainerIn, 0) - ISNULL(O.ContainerOut, 0) AS NetMovement,

        /* ---- appended: process-wise split ---- */
        ISNULL(I.GateInImport20, 0)  AS GateInImport20,
        ISNULL(I.GateInImport40, 0)  AS GateInImport40,
        ISNULL(I.GateInExport20, 0)  AS GateInExport20,
        ISNULL(I.GateInExport40, 0)  AS GateInExport40,
        ISNULL(I.GateInEmpty20, 0)   AS GateInEmpty20,
        ISNULL(I.GateInEmpty40, 0)   AS GateInEmpty40,
        ISNULL(O.GateOutImport20, 0) AS GateOutImport20,
        ISNULL(O.GateOutImport40, 0) AS GateOutImport40,
        ISNULL(O.GateOutExport20, 0) AS GateOutExport20,
        ISNULL(O.GateOutExport40, 0) AS GateOutExport40,
        ISNULL(O.GateOutEmpty20, 0)  AS GateOutEmpty20,
        ISNULL(O.GateOutEmpty40, 0)  AS GateOutEmpty40

    FROM Hours H
    LEFT JOIN ContainerIN  I ON I.HourStart = H.HourStart
    LEFT JOIN ContainerOUT O ON O.HourStart = H.HourStart
    ORDER BY H.HourStart
    OPTION (MAXRECURSION 25);

END
GO
