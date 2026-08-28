USE [YMS_EKLAVYA]
GO
/****** Object:  StoredProcedure [dbo].[GET_EKL_TRN_TRAILER_OUT_LIST]    Script Date: 28-08-2026 12:31:34 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE proc [dbo].[GET_EKL_TRN_TRAILER_OUT_LIST]
as
begin
 select T.TrailerID,T.TrailerNo,(CASE WHEN T.OutContNo is not null THEN 'PICKUP' when T.InContNo is not null or T.ContainerNo is not null then 'OFFLOAD' else 'EMPTY' END) AS ActivityName,
 ContainerNo AS InContainerNo,T.OutContNo as OutContainerNo,CI.ContainerSize, CI.ContainerType, UPPER(CI.Process) as Process, CI.ShippingLine, (CASE WHEN ci.ContainerSize like '%40%' THEN L.ContainerLocationName1 else L.ContainerLocationName end) as ContainerLocation,
 1 as IsSuccess,T.GateInDate,T.GateOutDate,[dbo].ConvertDDHHMMSS(T.GateInDate,T.GateOutDate) as TrailerTAT,
(CASE WHEN T.TrailerNo IS NOT NUll THEN T.TrailerNo +'_'+FORMAT((case when DATEPART(SECOND,T.GateInDate) <= 4 then DATEADD(minute,0,T.GateInDate) else t.GateInDate end) , 'yyyyMMddHHmmss')+'.jpg' ELSE '' END) as Vehicleimg,
(CASE WHEN T.ContainerNo IS NOT NUll THEN T.ContainerNo +'_'+FORMAT((case when DATEPART(SECOND,CI.YardInTime) <= 4 then DATEADD(minute,0,CI.YardInTime) else CI.YardInTime end) , 'yyyyMMddHHmmss')+'.jpg' ELSE '' END) as Containerimg
 from EKL_TRN_TRAILER T
  LEFT JOIN EKL_TRN_INVENTORY CI ON T.TrailerID=CI.TrailerID
  LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=CI.LastLocID
  where T.Isdelete=0  and ISNULL(t.TrailerNo,'')!=''  and T.GateOutDate IS NOT NULL and T.GateOutDate >= DATEADD(hour,-24,GETDATE())
  order by GateOutDate desc
end
