USE [YMS_EKLAVYA]
GO
/****** Object:  StoredProcedure [dbo].[GET_24HR_TRAILER_OUT_DETAIL]    Script Date: 28-08-2026 12:52:30 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO


ALTER proc [dbo].[GET_24HR_TRAILER_OUT_DETAIL]
@PlantID bigint,
@GateType bigint,
@UserID uniqueidentifier
as
begin
    select T.TrailerID,T.TrailerNo,(CASE WHEN T.OutContNo  is not null  THEN 'PICKUP' when T.InContNo is not null or T.ContainerNo is not null then 'OFFLOAD' else 'EMPTY' END) AS ActivityName,
	ContainerNo AS InContainerNo,T.OutContNo as OutContainerNo,
	CI.ContainerSize, CI.ContainerType, CI.Process, CI.ShippingLine, (CASE WHEN CI.ContainerSize like '%40%' then L.ContainerLocationName1 else L.ContainerLocationName end) as ContainerLocation,
	1 as IsSuccess,T.GateInDate,T.GateOutDate,[dbo].ConvertDDHHMMSS(T.GateInDate,isnull(T.GateOutDate,getdate())) as TrailerTAT from
	EKL_TRN_TRAILER T
	LEFT JOIN EKL_TRN_INVENTORY CI ON T.ContainerNo=CI.ContNo and CI.GateOutDate IS NULL
	LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=CI.LastLocID
	where T.Isdelete=0  and t.GateOutDate IS NOT NULL and T.GateOutDate >= DATEADD(hour,-24,GETDATE()) order by t.GateOutDate desc


end
