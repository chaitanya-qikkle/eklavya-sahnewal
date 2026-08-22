CREATE OR ALTER PROCEDURE [dbo].[GET_EKL_TRN_CONTAINER_ESURVEY]
    @FromDate    DATE        = NULL,
    @ToDate      DATE        = NULL,
    @GateType    VARCHAR(10) = NULL,   -- 'GATE_IN' | 'GATE_OUT' | NULL = all
    @ContainerNo VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @FromDate IS NULL SET @FromDate = CAST(GETDATE() AS DATE);
    IF @ToDate   IS NULL SET @ToDate   = CAST(GETDATE() AS DATE);

    SELECT
        S.SurveyId                                                          AS SurveyId,
        LTRIM(RTRIM(ISNULL(S.ContainerNo, '')))                             AS ContainerNo,
        S.GateName                                                          AS GateName,
        CASE
            WHEN UPPER(ISNULL(S.GateName,'')) LIKE '%OUT%' THEN 'GATE_OUT'
            WHEN UPPER(ISNULL(S.GateName,'')) LIKE '%IN%'  THEN 'GATE_IN'
            ELSE 'UNKNOWN'
        END                                                                 AS GateType,
        S.SurveyTime                                                        AS SurveyTime,
        S.DetectedTime                                                      AS DetectedTime,

        -- Container details from inventory (LEFT JOIN — survey may exist before gate-in)
        ISNULL(SZ.SizeCode, '')                                             AS ContSize,
        ISNULL(TY.TypeCode, '')                                             AS ContType,
        ISNULL(UPPER(I.INVENTORY_STATUS), '')                               AS Status,
        ISNULL(UPPER(P.ProcessCode), '')                                    AS Process,
        ISNULL(I.DOCUMENT_NO, '')                                           AS DocumentNo,
        I.GATE_IN_DATE                                                      AS GateInDate,

        -- Image paths
        CASE WHEN NULLIF(LTRIM(RTRIM(S.ContainerNo)),'') IS NOT NULL THEN
            'stitching_outputs/' + ISNULL(S.GateName,'') +
            '/' + FORMAT(S.SurveyTime,'yyyyMMdd') +
            '/' + LTRIM(RTRIM(S.ContainerNo)) + '/left.jpg'
        END                                                                 AS Left1,
        CASE WHEN NULLIF(LTRIM(RTRIM(S.ContainerNo)),'') IS NOT NULL THEN
            'stitching_outputs/' + ISNULL(S.GateName,'') +
            '/' + FORMAT(S.SurveyTime,'yyyyMMdd') +
            '/' + LTRIM(RTRIM(S.ContainerNo)) + '/right.jpg'
        END                                                                 AS Right1,
        CASE WHEN NULLIF(LTRIM(RTRIM(S.ContainerNo)),'') IS NOT NULL THEN
            'stitching_outputs/' + ISNULL(S.GateName,'') +
            '/' + FORMAT(S.SurveyTime,'yyyyMMdd') +
            '/' + LTRIM(RTRIM(S.ContainerNo)) + '/top.jpg'
        END                                                                 AS Top1

    FROM EKL_TRN_CONTAINER_ESURVEY S
    -- Most recent inventory record for this container
    LEFT JOIN TBL_CONTAINER_INVENTORY I
           ON I.CONTAINER_NO = LTRIM(RTRIM(S.ContainerNo))
          AND I.INVENTORY_ID = (
                SELECT TOP 1 INVENTORY_ID
                FROM TBL_CONTAINER_INVENTORY
                WHERE CONTAINER_NO = LTRIM(RTRIM(S.ContainerNo))
                ORDER BY GATE_IN_DATE DESC
              )
    LEFT JOIN TBL_MST_CONT_SIZE  SZ ON SZ.SizeID    = I.CONTAINER_SIZE_ID
    LEFT JOIN TBL_MST_CONT_TYPE  TY ON TY.TypeID    = I.CONTAINER_TYPE_ID
    LEFT JOIN TBL_MST_PROCESS    P  ON P.ProcessID  = I.CONTAINER_PROCESS_ID
    WHERE
        S.SurveyTime IS NOT NULL
        AND CAST(S.SurveyTime AS DATE) >= @FromDate
        AND CAST(S.SurveyTime AS DATE) <= @ToDate
        AND (@ContainerNo IS NULL OR S.ContainerNo LIKE '%' + @ContainerNo + '%')
        AND (
            @GateType IS NULL
            OR (@GateType = 'GATE_IN'  AND UPPER(ISNULL(S.GateName,'')) LIKE '%IN%'
                                       AND UPPER(ISNULL(S.GateName,'')) NOT LIKE '%OUT%')
            OR (@GateType = 'GATE_OUT' AND UPPER(ISNULL(S.GateName,'')) LIKE '%OUT%')
        )
    ORDER BY S.SurveyTime DESC;
END
