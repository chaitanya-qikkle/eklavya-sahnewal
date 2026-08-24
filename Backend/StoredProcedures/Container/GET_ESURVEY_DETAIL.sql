USE [YMS_EKLAVYA]
GO
/****** Object:  StoredProcedure [dbo].[GET_ESURVEY_DETAIL]    Script Date: 24-08-2026 11:39:27 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER PROCEDURE [dbo].[GET_ESURVEY_DETAIL]
(
    @PlantID BIGINT,
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @ContainerNo VARCHAR(50) = NULL,
    @GateName VARCHAR(50) = NULL
)
AS
BEGIN
    SET NOCOUNT ON;

    -------------------------------------------------
    -- Normalize inputs (ONLOAD SAFE)
    -------------------------------------------------
    SET @ContainerNo = NULLIF(@ContainerNo, '');

    IF @GateName IN ('', '0')
        SET @GateName = NULL;

    IF @PlantID = 0
        SET @PlantID = NULL;

    -------------------------------------------------
    -- Gate direction flags
    -------------------------------------------------
    DECLARE @IsInGate  BIT = 0;
    DECLARE @IsOutGate BIT = 0;

    IF @GateName IN ('GATECOMPLEXIN', 'EMERGENCYINGATE')
        SET @IsInGate = 1;

    IF @GateName IN ('GATECOMPLEXOUT', 'EMERGENCYOUTGATE')
        SET @IsOutGate = 1;

    -------------------------------------------------
    -- MAIN QUERY WITH DEDUPLICATION
    -------------------------------------------------
    ;WITH CTE_LATEST AS
    (
        SELECT
            I.ContMasterID,
            I.ContNo,
            I.ContainerSize,
            I.ContainerType,
            UPPER(I.Process) AS Process,
            I.ShippingLine,
            I.BookingNo,
            I.ContainerStatus,
            I.Mode,
            I.DocumentNo,
            I.GateInDate,
            I.GateOutDate,

            CASE
                WHEN I.ContainerSize LIKE '%40%'
                THEN L.ContainerLocationName1
                ELSE L.ContainerLocationName
            END AS ContainerLocationName,

            T.TrailerNo,
            T.TrailerNo AS ANPRVehicleNo,
            S.GateName,
            S.SurveyTime,s.DetectedTime,
            FORMAT(S.SurveyTime,'dd-MM-yyyy') AS SurveyDate,
            CAST(0 AS BIT) AS IsSuveryCompleted,

            'stitching_outputs/' + S.GateName + '/' +
            FORMAT(S.SurveyTime,'yyyyMMdd') + '/' +
            I.ContNo + '/left.jpg'  AS Left1,

            'stitching_outputs/' + S.GateName + '/' +
            FORMAT(S.SurveyTime,'yyyyMMdd') + '/' +
            I.ContNo + '/right.jpg' AS Right1,

            'stitching_outputs/' + S.GateName + '/' +
            FORMAT(S.SurveyTime,'yyyyMMdd') + '/' +
            I.ContNo + '/back.jpg'  AS Back1,

            'stitching_outputs/' + S.GateName + '/' +
            FORMAT(S.SurveyTime,'yyyyMMdd') + '/' +
            I.ContNo + '/top.jpg'   AS Top1,

            '' AS Left2,'' AS Left3,'' AS Right2,'' AS Right3,
            '' AS Top2,'' AS Top3,'' AS Back2,'' AS Back3,

            -------------------------------------------------
            -- DEDUPLICATION LOGIC
            -------------------------------------------------
            ROW_NUMBER() OVER
            (
                PARTITION BY I.ContNo
                ORDER BY
                    COALESCE(I.GateOutDate, I.GateInDate) DESC,
                    S.SurveyTime DESC
            ) AS RN

        FROM EKL_TRN_CONTAINER_ESURVEY S
        LEFT JOIN EKL_TRN_INVENTORY I  ON I.ContNo = S.ContainerNo
        LEFT JOIN EKL_TRN_TRAILER   T  ON I.TrailerID = T.TrailerID
        LEFT JOIN ESS_MST_LOCATION  L  ON L.LocationID = I.LastLocID

        WHERE
            -------------------------------------------------
            -- Filters
            -------------------------------------------------
            (@ContainerNo IS NULL OR I.ContNo = @ContainerNo)
            AND (@PlantID IS NULL OR I.PlantID = @PlantID)
            AND (@GateName IS NULL OR UPPER(S.GateName) = UPPER(@GateName))
            AND S.SurveyTime IS NOT NULL

            -------------------------------------------------
            -- Gate logic
            -------------------------------------------------
            AND (
                    (@GateName IS NOT NULL AND
                        (
                           (@IsInGate  = 1 AND I.GateOutDate IS NULL)
                         OR (@IsOutGate = 1 AND I.GateOutDate IS NOT NULL)
                        )
                    )
                 OR (@GateName IS NULL)
                )

            -------------------------------------------------
            -- Date logic
            -------------------------------------------------
            AND (
                    -- Date range
                    (
                        @FromDate IS NOT NULL AND @ToDate IS NOT NULL
                        AND (
                                I.GateInDate  >= @FromDate AND I.GateInDate  < DATEADD(DAY,1,@ToDate)
                             OR I.GateOutDate >= @FromDate AND I.GateOutDate < DATEADD(DAY,1,@ToDate)
                            )
                    )

                    -- Onload → TODAY
                 OR (
                        @FromDate IS NULL AND @ToDate IS NULL
                        AND S.SurveyTime >= CAST(GETDATE() AS DATE)
                        AND S.SurveyTime <  DATEADD(DAY,1,CAST(GETDATE() AS DATE))
                    )
                )
    )

    -------------------------------------------------
    -- FINAL RESULT (ONLY LATEST CONTAINER)
    -------------------------------------------------
    SELECT *
    FROM CTE_LATEST
    WHERE RN = 1
    ORDER BY SurveyTime DESC;

END
