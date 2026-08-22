USE [EKLAVYA_BUDGETCFS]
GO
/****** Object:  StoredProcedure [dbo].[GET_DEVICE_LOCK_REPORT]    Script Date: 20-06-2026 14:50:08 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[GET_DEVICE_LOCK_REPORT]
@Type VARCHAR(50),
@EqpNo NVARCHAR(MAX),
@fromdate nvarchar(50),
@todate nvarchar(50),
@PlantID BIGINT,
@ddlLocation VARCHAR(50)
AS
BEGIN

 IF @Type = 'Missing'
 BEGIN
 IF UPPER(@ddlLocation) in('IMPORT','EXPORT')
 BEGIN
 select EqpTransID,TransDate as TransDate,(CASE WHEN I.ContainerSize like '%40%' THEN EL.ContainerLocationName1 else EL.ContainerLocationName end )as Location,cast(GpsLocLat as decimal(18,6)) as GpsLocLat,cast(GpsLocLon as decimal(18,6)) as GpsLocLon,
 isnull(I.ContNo,ISNULL(ET.OCRContainerNo,'00000000000')) as ContNo,Equipment_Name as EqpName,ET.DeviceID as DeviceID,ET.ContMasterID as ContainerMasterId,U.UserName,
 'https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr/'+ET.DeviceID+'_'+FORMAT(ET.TransDate , 'ddMMyyyyHHmmss')+'_cam1_1.jpg' as CameraImage1,
 'https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr/'+ET.DeviceID+'_'+FORMAT(ET.TransDate , 'ddMMyyyyHHmmss')+'_cam2_1.jpg' as CameraImage2,
 'https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr/'+ET.DeviceID+'_'+FORMAT(ET.TransDate , 'ddMMyyyyHHmmss')+'_cam3_1.jpg' as CameraImage3
 from EKL_TRN_EQUIPMENT_TRANSACTION ET
 LEFT JOIN EKL_TRN_INVENTORY I ON ET.ContMasterID=I.ContMasterID
 left join ESS_MST_LOCATION EL on EL.LocationId=ET.AreaId
 left join IND_MST_USER U ON U.UserID=ET.ModifiedBy
 LEFT JOIN ESS_MST_EQUIPMENT EE ON EE.DeviceId=ET.DeviceID
 where PacketType in ('UK') and TransDate between CONVERT(DATETIME,@fromdate,103) and CONVERT(DATETIME,@todate,103) and Equipment_Name in(SELECT VALUE FROM DBO.[Split_String](@EqpNo,','))
 and ISNULL(ET.OCRContainerNo,'00000000000') = '00000000000' and Et.UpdateStutus!='M'
 order by ET.EqpTransID asc
 END
 ELSE
 BEGIN
 select EqpTransID,TransDate as TransDate,(CASE WHEN I.ContainerSize like '%40%' THEN EL.ContainerLocationName1 else EL.ContainerLocationName end ) as Location,cast(GpsLocLat as decimal(18,6)) as GpsLocLat,cast(GpsLocLon as decimal(18,6)) as GpsLocLon,
 isnull(I.ContNo,ISNULL(ET.OCRContainerNo,'00000000000')) as ContNo,Equipment_Name as EqpName,ET.DeviceID as DeviceID,ET.ContMasterID as ContainerMasterId,U.UserName,
 'https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr/'+ET.DeviceID+'_'+FORMAT(ET.TransDate , 'ddMMyyyyHHmmss')+'_cam1_1.jpg' as CameraImage1,
 'https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr/'+ET.DeviceID+'_'+FORMAT(ET.TransDate , 'ddMMyyyyHHmmss')+'_cam2_1.jpg' as CameraImage2,
 'https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr/'+ET.DeviceID+'_'+FORMAT(ET.TransDate , 'ddMMyyyyHHmmss')+'_cam3_1.jpg' as CameraImage3
 from EKL_TRN_EQUIPMENT_TRANSACTION ET
 LEFT JOIN EKL_TRN_INVENTORY I ON ET.ContMasterID=I.ContMasterID
 left join ESS_MST_LOCATION EL on EL.LocationId=ET.AreaId
 left join IND_MST_USER U ON U.UserID=ET.ModifiedBy
 LEFT JOIN ESS_MST_EQUIPMENT EE ON EE.DeviceId=ET.DeviceID
 where PacketType in ('UK') and TransDate between CONVERT(DATETIME,@fromdate,103) and CONVERT(DATETIME,@todate,103) and Equipment_Name in(SELECT VALUE FROM DBO.[Split_String](@EqpNo,','))
 and ISNULL(ET.OCRContainerNo,'00000000000') = '00000000000' and Et.UpdateStutus!='M'
 order by ET.EqpTransID asc
 END

 END
 ELSE IF @Type = 'Non Missing'
 BEGIN
 select EqpTransID,TransDate as TransDate,(CASE WHEN I.ContainerSize like '%40%' THEN EL.ContainerLocationName1 else EL.ContainerLocationName end ) as Location,cast(GpsLocLat as decimal(18,6)) as GpsLocLat,cast(GpsLocLon as decimal(18,6)) as GpsLocLon,
 isnull(I.ContNo,ISNULL(ET.OCRContainerNo,'00000000000')) as ContNo,Equipment_Name as EqpName,ET.DeviceID as DeviceID,ET.ContMasterID as ContainerMasterId,U.UserName,
 'https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr/'+ET.DeviceID+'_'+FORMAT(ET.TransDate , 'ddMMyyyyHHmmss')+'_cam1_1.jpg' as CameraImage1,
 'https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr/'+ET.DeviceID+'_'+FORMAT(ET.TransDate , 'ddMMyyyyHHmmss')+'_cam2_1.jpg' as CameraImage2,
 'https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr/'+ET.DeviceID+'_'+FORMAT(ET.TransDate , 'ddMMyyyyHHmmss')+'_cam3_1.jpg' as CameraImage3
 from EKL_TRN_EQUIPMENT_TRANSACTION ET
 LEFT JOIN EKL_TRN_INVENTORY I ON ET.ContMasterID=I.ContMasterID
 left join ESS_MST_LOCATION EL on EL.LocationId=ET.AreaId
 left join IND_MST_USER U ON U.UserID=ET.ModifiedBy
 LEFT JOIN ESS_MST_EQUIPMENT EE ON EE.DeviceId=ET.DeviceID
 where PacketType in ('UK') and TransDate between CONVERT(DATETIME,@fromdate,103) and CONVERT(DATETIME,@todate,103) and
 Equipment_Name in(SELECT VALUE FROM DBO.[Split_String](@EqpNo,','))  and ISNULL(ET.OCRContainerNo,'00000000000') = '00000000000'
 order by EqpTransID asc
 END
 ELSE
 BEGIN
 select EqpTransID,TransDate as TransDate,(CASE WHEN I.ContainerSize like '%40%' THEN EL.ContainerLocationName1 else EL.ContainerLocationName end ) as Location,cast(GpsLocLat as decimal(18,6)) as GpsLocLat,cast(GpsLocLon as decimal(18,6)) as GpsLocLon,
 isnull(I.ContNo,ISNULL(ET.OCRContainerNo,'00000000000')) as ContNo,Equipment_Name as EqpName,ET.DeviceID as DeviceID,ET.ContMasterID as ContainerMasterId,U.UserName,
 'https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr/'+ET.DeviceID+'_'+FORMAT(ET.TransDate , 'ddMMyyyyHHmmss')+'_cam1_1.jpg' as CameraImage1,
 'https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr/'+ET.DeviceID+'_'+FORMAT(ET.TransDate , 'ddMMyyyyHHmmss')+'_cam2_1.jpg' as CameraImage2,
 'https://container-datasets.s3.ap-south-1.amazonaws.com/reach-tracker-live-ocr/'+ET.DeviceID+'_'+FORMAT(ET.TransDate , 'ddMMyyyyHHmmss')+'_cam3_1.jpg' as CameraImage3
 from EKL_TRN_EQUIPMENT_TRANSACTION ET
 LEFT JOIN EKL_TRN_INVENTORY I ON ET.ContMasterID=I.ContMasterID
 left join ESS_MST_LOCATION EL on EL.LocationId=ET.AreaId
 left join IND_MST_USER U ON U.UserID=ET.ModifiedBy
 LEFT JOIN ESS_MST_EQUIPMENT EE ON EE.DeviceId=ET.DeviceID
 where PacketType in ('UK') and TransDate between  CONVERT(DATETIME,@fromdate,103) and CONVERT(DATETIME,@todate,103)
 and Equipment_Name in(SELECT VALUE FROM DBO.[Split_String](@EqpNo,','))
 order by EqpTransID asc
 END
END
GO
