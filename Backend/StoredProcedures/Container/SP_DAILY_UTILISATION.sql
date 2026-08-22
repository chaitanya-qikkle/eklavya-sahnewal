-- ============================================================
-- SP_DAILY_UTILISATION
-- Daily yard utilisation metrics for a date range.
-- Returns one row per calendar day (optionally broken down by
-- a secondary grouping dimension).
--
-- Parameters:
--   @FromDate   DATE            Start of date range (inclusive)
--   @ToDate     DATE            End of date range   (inclusive)
--   @GroupBy    NVARCHAR(20)    NULL / '' = no breakdown
--                               'process'  = by process code
--                               'size'     = by container size
--                               'type'     = by container type
--                               'status'   = by inventory status
--
-- Columns returned (no grouping):
--   REPORT_DATE, GATE_IN_COUNT, GATE_OUT_COUNT,
--   IN_YARD_COUNT, AVG_DWELL_DAYS, CARBON_TONS
--
-- Columns returned (with grouping):
--   REPORT_DATE, GROUP_VALUE, GATE_IN_COUNT, GATE_OUT_COUNT,
--   IN_YARD_COUNT, AVG_DWELL_DAYS, CARBON_TONS
--
-- CARBON_TONS = IN_YARD_COUNT × AVG_DWELL_DAYS × 0.00034
--   (weighted average t CO2 per container per dwell day)
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_DAILY_UTILISATION
    @FromDate DATE,
    @ToDate   DATE,
    @GroupBy  NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Normalise grouping parameter
    SET @GroupBy = LTRIM(RTRIM(LOWER(ISNULL(@GroupBy, ''))));

    -- Validate grouping value
    IF @GroupBy NOT IN ('', 'process', 'size', 'type', 'status')
    BEGIN
        RAISERROR('Invalid @GroupBy value. Use: process, size, type, status, or NULL.', 16, 1);
        RETURN;
    END;

    -- ── No secondary grouping ─────────────────────────────────────────────────
    IF @GroupBy = ''
    BEGIN
        WITH date_series AS (
            SELECT @FromDate AS d
            UNION ALL
            SELECT DATEADD(DAY, 1, d) FROM date_series WHERE d < @ToDate
        ),
        gate_in AS (
            SELECT CAST(GATE_IN_DATE AS DATE) AS d, COUNT(*) AS cnt
            FROM TBL_CONTAINER_INVENTORY
            WHERE GATE_IN_DATE  >= @FromDate
              AND GATE_IN_DATE   < DATEADD(DAY, 1, @ToDate)
            GROUP BY CAST(GATE_IN_DATE AS DATE)
        ),
        gate_out AS (
            SELECT CAST(GATE_OUT_DATE AS DATE) AS d, COUNT(*) AS cnt
            FROM TBL_CONTAINER_INVENTORY
            WHERE GATE_OUT_DATE >= @FromDate
              AND GATE_OUT_DATE  < DATEADD(DAY, 1, @ToDate)
            GROUP BY CAST(GATE_OUT_DATE AS DATE)
        ),
        in_yard AS (
            SELECT
                CAST(ds.d AS DATE)                                      AS d,
                COUNT(i.INVENTORY_ID)                                   AS cnt,
                AVG(CAST(DATEDIFF(DAY, i.GATE_IN_DATE, ds.d) AS FLOAT)) AS avg_dwell
            FROM date_series ds
            LEFT JOIN TBL_CONTAINER_INVENTORY i
                   ON CAST(i.GATE_IN_DATE AS DATE) <= ds.d
                  AND (i.GATE_OUT_DATE IS NULL OR CAST(i.GATE_OUT_DATE AS DATE) > ds.d)
            GROUP BY ds.d
        )
        SELECT
            ds.d                                                AS REPORT_DATE,
            ISNULL(gi.cnt, 0)                                  AS GATE_IN_COUNT,
            ISNULL(go.cnt, 0)                                  AS GATE_OUT_COUNT,
            ISNULL(iy.cnt, 0)                                  AS IN_YARD_COUNT,
            ROUND(ISNULL(iy.avg_dwell, 0), 1)                  AS AVG_DWELL_DAYS,
            ROUND(ISNULL(iy.cnt, 0) * ISNULL(iy.avg_dwell, 0) * 0.00034, 4) AS CARBON_TONS
        FROM date_series ds
        LEFT JOIN gate_in  gi ON gi.d = ds.d
        LEFT JOIN gate_out go ON go.d = ds.d
        LEFT JOIN in_yard  iy ON iy.d = ds.d
        ORDER BY ds.d
        OPTION (MAXRECURSION 366);

        RETURN;
    END;

    -- ── With secondary grouping ───────────────────────────────────────────────
    -- Dynamic SQL is avoided by using four explicit branches — one per grouping.
    -- Each branch is identical except for the GROUP_VALUE expression.

    IF @GroupBy = 'process'
    BEGIN
        WITH date_series AS (
            SELECT @FromDate AS d
            UNION ALL
            SELECT DATEADD(DAY, 1, d) FROM date_series WHERE d < @ToDate
        ),
        gate_in AS (
            SELECT CAST(i.GATE_IN_DATE AS DATE) AS d, UPPER(p.ProcessCode) AS grp_val, COUNT(*) AS cnt
            FROM TBL_CONTAINER_INVENTORY i
            LEFT JOIN TBL_MST_PROCESS p ON p.ProcessID = i.CONTAINER_PROCESS_ID
            WHERE i.GATE_IN_DATE >= @FromDate AND i.GATE_IN_DATE < DATEADD(DAY, 1, @ToDate)
            GROUP BY CAST(i.GATE_IN_DATE AS DATE), UPPER(p.ProcessCode)
        ),
        gate_out AS (
            SELECT CAST(i.GATE_OUT_DATE AS DATE) AS d, UPPER(p.ProcessCode) AS grp_val, COUNT(*) AS cnt
            FROM TBL_CONTAINER_INVENTORY i
            LEFT JOIN TBL_MST_PROCESS p ON p.ProcessID = i.CONTAINER_PROCESS_ID
            WHERE i.GATE_OUT_DATE >= @FromDate AND i.GATE_OUT_DATE < DATEADD(DAY, 1, @ToDate)
            GROUP BY CAST(i.GATE_OUT_DATE AS DATE), UPPER(p.ProcessCode)
        ),
        in_yard AS (
            SELECT CAST(ds.d AS DATE) AS d, UPPER(p.ProcessCode) AS grp_val,
                   COUNT(i.INVENTORY_ID) AS cnt,
                   AVG(CAST(DATEDIFF(DAY, i.GATE_IN_DATE, ds.d) AS FLOAT)) AS avg_dwell
            FROM date_series ds
            LEFT JOIN TBL_CONTAINER_INVENTORY i
                   ON CAST(i.GATE_IN_DATE AS DATE) <= ds.d
                  AND (i.GATE_OUT_DATE IS NULL OR CAST(i.GATE_OUT_DATE AS DATE) > ds.d)
            LEFT JOIN TBL_MST_PROCESS p ON p.ProcessID = i.CONTAINER_PROCESS_ID
            GROUP BY ds.d, UPPER(p.ProcessCode)
        )
        SELECT
            ISNULL(gi.d, ISNULL(go.d, iy.d))                        AS REPORT_DATE,
            ISNULL(gi.grp_val, ISNULL(go.grp_val, iy.grp_val))      AS GROUP_VALUE,
            ISNULL(gi.cnt, 0)                                        AS GATE_IN_COUNT,
            ISNULL(go.cnt, 0)                                        AS GATE_OUT_COUNT,
            ISNULL(iy.cnt, 0)                                        AS IN_YARD_COUNT,
            ROUND(ISNULL(iy.avg_dwell, 0), 1)                        AS AVG_DWELL_DAYS,
            ROUND(ISNULL(iy.cnt, 0) * ISNULL(iy.avg_dwell, 0) * 0.00034, 4) AS CARBON_TONS
        FROM gate_in gi
        FULL OUTER JOIN gate_out go ON go.d = gi.d AND go.grp_val = gi.grp_val
        FULL OUTER JOIN in_yard  iy ON iy.d = ISNULL(gi.d, go.d) AND iy.grp_val = ISNULL(gi.grp_val, go.grp_val)
        ORDER BY REPORT_DATE, GROUP_VALUE
        OPTION (MAXRECURSION 366);
        RETURN;
    END;

    IF @GroupBy = 'size'
    BEGIN
        WITH date_series AS (
            SELECT @FromDate AS d
            UNION ALL
            SELECT DATEADD(DAY, 1, d) FROM date_series WHERE d < @ToDate
        ),
        gate_in AS (
            SELECT CAST(i.GATE_IN_DATE AS DATE) AS d, s.SizeCode AS grp_val, COUNT(*) AS cnt
            FROM TBL_CONTAINER_INVENTORY i
            LEFT JOIN TBL_MST_CONT_SIZE s ON s.SizeID = i.CONTAINER_SIZE_ID
            WHERE i.GATE_IN_DATE >= @FromDate AND i.GATE_IN_DATE < DATEADD(DAY, 1, @ToDate)
            GROUP BY CAST(i.GATE_IN_DATE AS DATE), s.SizeCode
        ),
        gate_out AS (
            SELECT CAST(i.GATE_OUT_DATE AS DATE) AS d, s.SizeCode AS grp_val, COUNT(*) AS cnt
            FROM TBL_CONTAINER_INVENTORY i
            LEFT JOIN TBL_MST_CONT_SIZE s ON s.SizeID = i.CONTAINER_SIZE_ID
            WHERE i.GATE_OUT_DATE >= @FromDate AND i.GATE_OUT_DATE < DATEADD(DAY, 1, @ToDate)
            GROUP BY CAST(i.GATE_OUT_DATE AS DATE), s.SizeCode
        ),
        in_yard AS (
            SELECT CAST(ds.d AS DATE) AS d, s.SizeCode AS grp_val,
                   COUNT(i.INVENTORY_ID) AS cnt,
                   AVG(CAST(DATEDIFF(DAY, i.GATE_IN_DATE, ds.d) AS FLOAT)) AS avg_dwell
            FROM date_series ds
            LEFT JOIN TBL_CONTAINER_INVENTORY i
                   ON CAST(i.GATE_IN_DATE AS DATE) <= ds.d
                  AND (i.GATE_OUT_DATE IS NULL OR CAST(i.GATE_OUT_DATE AS DATE) > ds.d)
            LEFT JOIN TBL_MST_CONT_SIZE s ON s.SizeID = i.CONTAINER_SIZE_ID
            GROUP BY ds.d, s.SizeCode
        )
        SELECT
            ISNULL(gi.d, ISNULL(go.d, iy.d))                        AS REPORT_DATE,
            ISNULL(gi.grp_val, ISNULL(go.grp_val, iy.grp_val))      AS GROUP_VALUE,
            ISNULL(gi.cnt, 0)                                        AS GATE_IN_COUNT,
            ISNULL(go.cnt, 0)                                        AS GATE_OUT_COUNT,
            ISNULL(iy.cnt, 0)                                        AS IN_YARD_COUNT,
            ROUND(ISNULL(iy.avg_dwell, 0), 1)                        AS AVG_DWELL_DAYS,
            ROUND(ISNULL(iy.cnt, 0) * ISNULL(iy.avg_dwell, 0) * 0.00034, 4) AS CARBON_TONS
        FROM gate_in gi
        FULL OUTER JOIN gate_out go ON go.d = gi.d AND go.grp_val = gi.grp_val
        FULL OUTER JOIN in_yard  iy ON iy.d = ISNULL(gi.d, go.d) AND iy.grp_val = ISNULL(gi.grp_val, go.grp_val)
        ORDER BY REPORT_DATE, GROUP_VALUE
        OPTION (MAXRECURSION 366);
        RETURN;
    END;

    IF @GroupBy = 'type'
    BEGIN
        WITH date_series AS (
            SELECT @FromDate AS d
            UNION ALL
            SELECT DATEADD(DAY, 1, d) FROM date_series WHERE d < @ToDate
        ),
        gate_in AS (
            SELECT CAST(i.GATE_IN_DATE AS DATE) AS d, c.TypeCode AS grp_val, COUNT(*) AS cnt
            FROM TBL_CONTAINER_INVENTORY i
            LEFT JOIN TBL_MST_CONT_TYPE c ON c.TypeID = i.CONTAINER_TYPE_ID
            WHERE i.GATE_IN_DATE >= @FromDate AND i.GATE_IN_DATE < DATEADD(DAY, 1, @ToDate)
            GROUP BY CAST(i.GATE_IN_DATE AS DATE), c.TypeCode
        ),
        gate_out AS (
            SELECT CAST(i.GATE_OUT_DATE AS DATE) AS d, c.TypeCode AS grp_val, COUNT(*) AS cnt
            FROM TBL_CONTAINER_INVENTORY i
            LEFT JOIN TBL_MST_CONT_TYPE c ON c.TypeID = i.CONTAINER_TYPE_ID
            WHERE i.GATE_OUT_DATE >= @FromDate AND i.GATE_OUT_DATE < DATEADD(DAY, 1, @ToDate)
            GROUP BY CAST(i.GATE_OUT_DATE AS DATE), c.TypeCode
        ),
        in_yard AS (
            SELECT CAST(ds.d AS DATE) AS d, c.TypeCode AS grp_val,
                   COUNT(i.INVENTORY_ID) AS cnt,
                   AVG(CAST(DATEDIFF(DAY, i.GATE_IN_DATE, ds.d) AS FLOAT)) AS avg_dwell
            FROM date_series ds
            LEFT JOIN TBL_CONTAINER_INVENTORY i
                   ON CAST(i.GATE_IN_DATE AS DATE) <= ds.d
                  AND (i.GATE_OUT_DATE IS NULL OR CAST(i.GATE_OUT_DATE AS DATE) > ds.d)
            LEFT JOIN TBL_MST_CONT_TYPE c ON c.TypeID = i.CONTAINER_TYPE_ID
            GROUP BY ds.d, c.TypeCode
        )
        SELECT
            ISNULL(gi.d, ISNULL(go.d, iy.d))                        AS REPORT_DATE,
            ISNULL(gi.grp_val, ISNULL(go.grp_val, iy.grp_val))      AS GROUP_VALUE,
            ISNULL(gi.cnt, 0)                                        AS GATE_IN_COUNT,
            ISNULL(go.cnt, 0)                                        AS GATE_OUT_COUNT,
            ISNULL(iy.cnt, 0)                                        AS IN_YARD_COUNT,
            ROUND(ISNULL(iy.avg_dwell, 0), 1)                        AS AVG_DWELL_DAYS,
            ROUND(ISNULL(iy.cnt, 0) * ISNULL(iy.avg_dwell, 0) * 0.00034, 4) AS CARBON_TONS
        FROM gate_in gi
        FULL OUTER JOIN gate_out go ON go.d = gi.d AND go.grp_val = gi.grp_val
        FULL OUTER JOIN in_yard  iy ON iy.d = ISNULL(gi.d, go.d) AND iy.grp_val = ISNULL(gi.grp_val, go.grp_val)
        ORDER BY REPORT_DATE, GROUP_VALUE
        OPTION (MAXRECURSION 366);
        RETURN;
    END;

    IF @GroupBy = 'status'
    BEGIN
        WITH date_series AS (
            SELECT @FromDate AS d
            UNION ALL
            SELECT DATEADD(DAY, 1, d) FROM date_series WHERE d < @ToDate
        ),
        gate_in AS (
            SELECT CAST(i.GATE_IN_DATE AS DATE) AS d, UPPER(i.INVENTORY_STATUS) AS grp_val, COUNT(*) AS cnt
            FROM TBL_CONTAINER_INVENTORY i
            WHERE i.GATE_IN_DATE >= @FromDate AND i.GATE_IN_DATE < DATEADD(DAY, 1, @ToDate)
            GROUP BY CAST(i.GATE_IN_DATE AS DATE), UPPER(i.INVENTORY_STATUS)
        ),
        gate_out AS (
            SELECT CAST(i.GATE_OUT_DATE AS DATE) AS d, UPPER(i.INVENTORY_STATUS) AS grp_val, COUNT(*) AS cnt
            FROM TBL_CONTAINER_INVENTORY i
            WHERE i.GATE_OUT_DATE >= @FromDate AND i.GATE_OUT_DATE < DATEADD(DAY, 1, @ToDate)
            GROUP BY CAST(i.GATE_OUT_DATE AS DATE), UPPER(i.INVENTORY_STATUS)
        ),
        in_yard AS (
            SELECT CAST(ds.d AS DATE) AS d, UPPER(i.INVENTORY_STATUS) AS grp_val,
                   COUNT(i.INVENTORY_ID) AS cnt,
                   AVG(CAST(DATEDIFF(DAY, i.GATE_IN_DATE, ds.d) AS FLOAT)) AS avg_dwell
            FROM date_series ds
            LEFT JOIN TBL_CONTAINER_INVENTORY i
                   ON CAST(i.GATE_IN_DATE AS DATE) <= ds.d
                  AND (i.GATE_OUT_DATE IS NULL OR CAST(i.GATE_OUT_DATE AS DATE) > ds.d)
            GROUP BY ds.d, UPPER(i.INVENTORY_STATUS)
        )
        SELECT
            ISNULL(gi.d, ISNULL(go.d, iy.d))                        AS REPORT_DATE,
            ISNULL(gi.grp_val, ISNULL(go.grp_val, iy.grp_val))      AS GROUP_VALUE,
            ISNULL(gi.cnt, 0)                                        AS GATE_IN_COUNT,
            ISNULL(go.cnt, 0)                                        AS GATE_OUT_COUNT,
            ISNULL(iy.cnt, 0)                                        AS IN_YARD_COUNT,
            ROUND(ISNULL(iy.avg_dwell, 0), 1)                        AS AVG_DWELL_DAYS,
            ROUND(ISNULL(iy.cnt, 0) * ISNULL(iy.avg_dwell, 0) * 0.00034, 4) AS CARBON_TONS
        FROM gate_in gi
        FULL OUTER JOIN gate_out go ON go.d = gi.d AND go.grp_val = gi.grp_val
        FULL OUTER JOIN in_yard  iy ON iy.d = ISNULL(gi.d, go.d) AND iy.grp_val = ISNULL(gi.grp_val, go.grp_val)
        ORDER BY REPORT_DATE, GROUP_VALUE
        OPTION (MAXRECURSION 366);
        RETURN;
    END;
END;
GO
