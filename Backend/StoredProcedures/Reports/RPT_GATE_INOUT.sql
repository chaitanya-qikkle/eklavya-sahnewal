CREATE OR ALTER PROCEDURE [dbo].[RPT_GATE_INOUT]
    @fromDate    DATE         = NULL,
    @toDate      DATE         = NULL,
    @ContainerNo VARCHAR(50)  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @fromDate IS NULL SET @fromDate = CAST(GETDATE() AS DATE);
    IF @toDate   IS NULL SET @toDate   = CAST(GETDATE() AS DATE);

    IF LTRIM(RTRIM(ISNULL(@ContainerNo, ''))) = '' SET @ContainerNo = NULL;


    WITH LatestInventory AS (
        SELECT *,
            ROW_NUMBER() OVER (
                PARTITION BY CONTAINER_NO
                ORDER BY GATE_IN_DATE DESC
            ) AS rn
        FROM TBL_CONTAINER_INVENTORY
        WHERE
            (@ContainerNo IS NULL OR CONTAINER_NO LIKE '%' + @ContainerNo + '%')
            AND (
                CAST(GATE_IN_DATE  AS DATE) BETWEEN @fromDate AND @toDate
                OR CAST(GATE_OUT_DATE AS DATE) BETWEEN @fromDate AND @toDate
            )
    )
    SELECT
        LTRIM(RTRIM(ci.CONTAINER_NO))               AS CONTAINER_NO,
        ISNULL(cs.SizeCode, '')                     AS CONTAINER_SIZE,
        ISNULL(ct.TypeCode, '')                     AS CONTAINER_TYPE,
        ISNULL(cp.ProcessName, '')                  AS CONTAINER_PROCESS,
        ISNULL(cl.LINE_NAME, '')                    AS CONTAINER_LINE,
        ISNULL(ci.DOCUMENT_NO, '')                  AS DOCUMENT_NO,
        ISNULL(UPPER(ci.INVENTORY_STATUS), '')      AS INVENTORY_STATUS,
        ISNULL(ci.YARD_ID, '')                      AS YARD_ID,
        ci.GATE_IN_DATE                             AS GATE_IN_DATE,
        ci.GATE_OUT_DATE                            AS GATE_OUT_DATE,
        ci.LAST_MOVED_DATE                          AS LAST_MOVED_DATE,
        ISNULL(ci.OFFLOAD_EQP, '')                  AS OFFLOAD_EQP,
        es_in.SurveyTime                            AS OCR_GATE_IN_DATE,
        es_out.SurveyTime                           AS OCR_GATE_OUT_DATE
    FROM LatestInventory ci
    LEFT JOIN TBL_MST_CONT_SIZE  cs ON cs.SizeID    = ci.CONTAINER_SIZE_ID
    LEFT JOIN TBL_MST_CONT_TYPE  ct ON ct.TypeID    = ci.CONTAINER_TYPE_ID
    LEFT JOIN TBL_MST_LINE       cl ON cl.LINE_ID   = ci.LINE_ID
    LEFT JOIN TBL_MST_PROCESS    cp ON cp.ProcessID = ci.CONTAINER_PROCESS_ID


    OUTER APPLY (
        SELECT TOP 1 es.SurveyTime
        FROM EKL_TRN_CONTAINER_ESURVEY es
        WHERE LTRIM(RTRIM(es.ContainerNo)) = LTRIM(RTRIM(ci.CONTAINER_NO))
          AND UPPER(LTRIM(RTRIM(es.GateName))) = 'GATE_IN'
        ORDER BY ABS(DATEDIFF(SECOND, es.SurveyTime, ISNULL(ci.GATE_IN_DATE, es.SurveyTime)))
    ) es_in


    OUTER APPLY (
        SELECT TOP 1 es.SurveyTime
        FROM EKL_TRN_CONTAINER_ESURVEY es
        WHERE LTRIM(RTRIM(es.ContainerNo)) = LTRIM(RTRIM(ci.CONTAINER_NO))
          AND UPPER(LTRIM(RTRIM(es.GateName))) = 'GATE_OUT'
        ORDER BY ABS(DATEDIFF(SECOND, es.SurveyTime, ISNULL(ci.GATE_OUT_DATE, es.SurveyTime)))
    ) es_out

    WHERE ci.rn = 1
    ORDER BY ci.GATE_IN_DATE DESC;
END
