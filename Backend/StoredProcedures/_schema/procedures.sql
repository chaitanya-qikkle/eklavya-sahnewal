-- dbo.API_CONTAINER_INVENTORY_DETAIL
GO
CREATE PROC [dbo].[API_CONTAINER_INVENTORY_DETAIL]

@PlantCode varchar(50)

AS

BEGIN



select I.ContNo as ContainerNo,CS.ContSize as Size,LN.LineName as ShippingLine,I.LastShiftDate as LastShiftTime,

(CASE WHEN ContainerSize like '%40%' THEN L.ContainerLocationName1 else L.ContainerLocationName end) as LastLocation,CT.ContTypeName as ContainerType,P.ProcessName as TransactionType,0 as NoOfMoves from EKL_TRN_INVENTORY I

LEFT JOIN ESS_MST_CONTAINER_SIZE CS ON CS.ContSizeID=I.SizeID

LEFT JOIN ESS_MST_LINE LN ON LN.LineID=I.SizeID

LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=I.LastLocID

LEFT JOIN ESS_MST_CONTAINER_TYPE CT ON CT.ContTypeID=I.ContTypeId

LEFT JOIN ESS_MST_PROCESS P ON P.ProcessID=I.ProcessID

LEFT JOIN ESS_MST_PLANT PL ON PL.PlantID=I.PlantID

where PL.PlantCode=@PlantCode



END

-- dbo.API_GATEIN_PULL_LIST
GO
CREATE PROC [dbo].[API_GATEIN_PULL_LIST]

@PlantCode varchar(50)

as

begin



select t.InContNo as ContainerNo,s.ContSize as ContainerSize, ct.ContTypeName as ContainerType,l.LineName as ShippingLine,

TrailerNo,p.ProcessName as TransactionType,GateName as MovementType,'' as GatePass,t.GateInDate JOD from EKL_TRN_TRAILER t

LEFT join ESS_MST_CONTAINER_TYPE ct on ct.ContTypeID=t.ContTypeID

LEFT join ESS_MST_LINE l on l.LineID=t.LineID

LEFT join ESS_MST_PROCESS p on p.ProcessID=t.ProcessID

LEFT join ESS_MST_GATE g on g.GateID=t.GateInType

LEFT join ESS_MST_CONTAINER_SIZE s on t.ContSizeID=s.ContSizeID

left join ESS_MST_PLANT pl on pl.PlantCode=@PlantCode

end

-- dbo.API_INS_EKL_TRN_ROAD_PRE_GATEIN
GO
CREATE PROCEDURE [dbo].[API_INS_EKL_TRN_ROAD_PRE_GATEIN]    

(    

 @ROAD_PRE_GATEIN AS dbo.ROAD_PRE_GATEIN_TYPE READONLY,    

 @IsSuccess int OUTPUT    

)    

as    

BEGIN     

set @IsSuccess=0    

declare @ContainerNo nvarchar(20),@ContainerSize int,@JobCreationDateTime datetime,@DocumentNo nvarchar(110),

@TransactionType nvarchar(50),@TruckNo nvarchar(100),@Mode nvarchar(100),@Terminal nvarchar(100);



   SET NOCOUNT ON;  

  DECLARE ROAD_PRE_GATEIN_CURSOR CURSOR FOR SELECT * FROM @ROAD_PRE_GATEIN   

  OPEN ROAD_PRE_GATEIN_CURSOR      

  FETCH NEXT FROM ROAD_PRE_GATEIN_CURSOR INTO   

  @ContainerNo,@ContainerSize,@JobCreationDateTime,@DocumentNo,@TransactionType,@TruckNo,@Mode,@Terminal

    

  WHILE @@FETCH_STATUS = 0   

      BEGIN             

     --   SELECT @ContainerNo=@ContainerNo,@ContainerSize=@ContainerSize,@JobCreationDateTime=@JobCreationDateTime,

	    --@DocumentNo=@DocumentNo,@TransactionType=@TransactionType,@TruckNo=@TruckNo,@Mode=@Mode,@Terminal=@Terminal

  

      INSERT INTO EKL_TRN_ROAD_PRE_GATEIN( ContainerNo,ContainerSize,JobCreationDateTime,DocumentNo,TransactionType,TruckNo,Mode,Terminal)   

      SELECT @ContainerNo,@ContainerSize,@JobCreationDateTime,@DocumentNo,@TransactionType,@TruckNo,@Mode,@Terminal



      FETCH NEXT FROM ROAD_PRE_GATEIN_CURSOR INTO   

      @ContainerNo,@ContainerSize,@JobCreationDateTime,@DocumentNo,@TransactionType,@TruckNo,@Mode,@Terminal

        

  

      END  

  CLOSE BULK_OFFLOADLIST_CURSOR      

  DEALLOCATE BULK_OFFLOADLIST_CURSOR  

  

  SET @IsSuccess=1      

   

  SELECT @IsSuccess AS result  

  

  

End

-- dbo.API_INS_EKY_DEVICE_DATA
GO
CREATE PROC [dbo].[API_INS_EKY_DEVICE_DATA]

    @TYP NVARCHAR(100),

    @LOH NVARCHAR(100),

    @TIM VARCHAR(100),

    @POS INT,

    @LAT NVARCHAR(

   100),

    @LAD INT,

    @LON NVARCHAR(100),

    @LOD INT,

    @NOS INT,

    @ALT NVARCHAR(100),

    @AN1 INT,

    @AN2 INT,

    @DL1 INT,

    @DL2 INT,

    @DID NVARCHAR(100),

    @CID NVARCHAR(50),

    @FNO NVARCHAR(50)

as

begin



   declare @VehicleNo varchar(100);

   declare @DeviceIMEI varchar(100);

   declare @PacketType int;

   declare @Ignition int;

   declare @ContainerStatus int;

   declare @Distance int;

   declare @GPSDateTime datetime;

   declare @Latitude float;

   declare @Location varchar(100);

   declare @Longitude float;

   declare @NoOfSatalites int;

   declare @GPSFix int;

   declare @Speed int;

   declare @RFDATA varchar(100);

   declare @OCRDATA varchar(100);

   declare @Height varchar(50);

   declare @OCRBinaries varchar(100);

   declare @Analog1 varchar(100);

   declare @Digital1 varchar(100);

   declare @FrameId int;



   --set device imei using vehicle number





   SET @PacketType = (CASE WHEN @TYP LIKE '%HBFRAME%' THEN 1 WHEN @TYP LIKE '%LKUK_LK%'  THEN 7 WHEN @TYP LIKE '%LKUK_UK%' THEN 8 ELSE 0 END);

   --SET @LOH;--live Or History

   SET @GPSDateTime = CONVERT(DATETIME, @TIM, 105);

   SET @GPSFix= @POS;

   SET @Latitude= CAST(@LAT as float);

   --SET @LAD;--latdr

   SET @Longitude= CAST(@LON as float);

   --SET @LOD;--longdr

   SET @NoOfSatalites= @NOS;

   --SET @ALT;

   SET @Height= CAST(@AN1 as varchar)

   --SET @AN2;--N/A

   SET @Ignition= @DL1;

   --SET @DL2;--LK/UK

   SET @VehicleNo= @DID;

   SET @OCRData= @CID;

   SET @FrameId=@FNO;



   SET @DeviceIMEI=(SELECT TOP 1 Device_ID from TBL_MST_EQUIPMENT Where VTM_ImeiNo=@VehicleNo and IsDelete=0)



declare @IsSuccess as int,@SlotId bigint,@AdjucentLocation nvarchar(50),@Row nvarchar(30),@AdjucentSlotId bigint;

set @IsSuccess=0

insert into TBL_EKDEVICE_DATA (KALMAR_NO,DEVICE_IMEI,PACKET_ID,IGNITION,DATE_TIME,Latitude,

Longitude,NO_SATELIGHT,GPS_FIX,RFIDDATA,Analog1,ANALOG2,FRAMEID)

values (@VehicleNo, @DeviceIMEI, @PacketType, @Ignition, @GPSDateTime, @Latitude,

@Longitude, @NoOfSatalites, @GPSFix, @OCRData,@Analog1, @Digital1, @FRAMEID)



declare @StackHeight int;



if cast(@Height as decimal(18,2)) >= 825

BEGIN

	set @StackHeight= '1'

END

if cast(@Height as decimal(18,2)) >= 695 and cast(@Height as decimal(18,2)) <= 824

BEGIN

	set @StackHeight= '2'

END	

if cast(@Height as decimal(18,2)) >= 550 and cast(@Height as decimal(18,2)) <= 694

BEGIN

	set @StackHeight= '3'

END	

if cast(@Height as decimal(18,2)) <= 549

BEGIN

	set @StackHeight = '4'

END	



declare @LastUnlockTime datetime;





select @LastUnlockTime=DATE_TIME from TBL_EKDEVICE_LIVE_STATUS where DEVICE_IMEI=@DeviceIMEI;









--SET @GPSDateTime = DATEADD(minute,330,@GPSDateTime);

declare @Packet nvarchar(20),@count int; 

IF @PacketType = 7

BEGIN

	SET @Packet='LK'

    Delete From TBL_EKDEVICE_LIVE_STATUS where DEVICE_IMEI=@DeviceIMEI;



insert into TBL_EKDEVICE_LIVE_STATUS (KALMAR_NO,DEVICE_IMEI,PACKET_ID,IGNITION,DATE_TIME,Latitude,

Longitude,NO_SATELIGHT,GPS_FIX,RFIDDATA,Analog1,ANALOG2,FRAMEID)



values (@VehicleNo, @DeviceIMEI, @PacketType, @Ignition, @GPSDateTime, @Latitude,

@Longitude, @NoOfSatalites, @GPSFix, @OCRData,  @Analog1, @Digital1, @FRAMEID)

END

IF @PacketType = 8

BEGIN

	SET @Packet='UK'

      Delete From TBL_EKDEVICE_LIVE_STATUS where DEVICE_IMEI=@DeviceIMEI;



insert into TBL_EKDEVICE_LIVE_STATUS (KALMAR_NO,DEVICE_IMEI,PACKET_ID,IGNITION,DATE_TIME,Latitude,

Longitude,NO_SATELIGHT,GPS_FIX,RFIDDATA,Analog1,ANALOG2,FRAMEID)



values (@VehicleNo, @DeviceIMEI, @PacketType, @Ignition, @GPSDateTime, @Latitude,

@Longitude, @NoOfSatalites, @GPSFix, @OCRData,  @Analog1, @Digital1, @FRAMEID)

END





	IF @PacketType = 7

	BEGIN

	

		EXEC INS_EKY_TRN_LOCK_DATA @PacketType='LK',@Lat=@Latitude,@Long=@Longitude,@DeviceId=@DeviceIMEI,@gpstime=@GPSDateTime,@Height=@StackHeight,@ContainerLocation=@Location,@ContainerNo=@OCRDATA,@KalmarNo=@VehicleNo,@AdjucentLocation=@AdjucentLocation,@SlotId=@SlotId,@AdjucentSlotId=@AdjucentSlotId

	END

	if @PacketType = 8

	BEGIN

		UPDATE TBL_EKDEVICE_LIVE_STATUS SET DATE_TIME =@GPSDateTime where DEVICE_IMEI=@DeviceIMEI

		EXEC INS_EKY_TRN_UNLOCK_DATA @PacketType='UK',@Lat=@Latitude,@Long=@Longitude,@DeviceId=@DeviceIMEI,@gpstime=@GPSDateTime,@Height=@StackHeight,@ContainerLocation=@Location,@ContainerNo=@OCRDATA,@KalmarNo=@VehicleNo,@AdjucentLocation=@AdjucentLocation,@SlotId=@SlotId,@AdjucentSlotId=@AdjucentSlotId

	END 

----END

SET @IsSuccess=1  

SELECT @IsSuccess AS result





End

-- dbo.API_RAIL_IN_DETAIL
GO
CREATE PROC [dbo].[API_RAIL_IN_DETAIL]

AS

BEGIN



select top 5 ContainerNo,RailInDateTime,ContainerSize,ContainerType,ShippingLine, '' as MovementTYpe from EKL_TRN_RAIL_IN

where IsPosted=0

END

-- dbo.CHECK_GATEOUT_TRAILER
GO
CREATE PROC [dbo].[CHECK_GATEOUT_TRAILER]

@TrailerNo varchar(50),

@PlantID bigint

as

begin

Declare @TRAILERCOUNT  int;

IF EXISTS (select TrailerNo from EKL_TRN_TRAILER where TrailerNo=@TrailerNo and GateOutDate is null)

begin

set @TRAILERCOUNT=1

select @TRAILERCOUNT as TRAILERCOUNT

end

else

begin

set @TRAILERCOUNT=0

select @TRAILERCOUNT as TRAILERCOUNT

end

end

-- dbo.CUSTOMER_EXPORT_STORAGE_ADD
GO
CREATE PROCEDURE [dbo].[CUSTOMER_EXPORT_STORAGE_ADD]

(

    @CUSTOMER_ID INT,

    @EXPORT_CARGO_STORAGE_FACTOR DECIMAL(10,2),

    @EXPORT_GROUND_RATE_FROM DATETIME

)

AS 

BEGIN 

    SET NOCOUNT ON;



    BEGIN TRY

    

        -- 1️⃣ Check if Customer Exists

        IF NOT EXISTS (

            SELECT 1

            FROM TBL_MST_CUSTOMER

            WHERE CUSTOMER_ID = @CUSTOMER_ID

        )

        BEGIN

            SELECT 0 AS STATUS,

                   'CUSTOMER DOES NOT EXIST.' AS MESSAGE;

            RETURN;

        END



        -- 2️⃣ Duplicate Check (One record per customer)

        IF EXISTS (

            SELECT 1

            FROM TBL_CUSTOMER_EXPORT_STORAGE

            WHERE CUSTOMER_ID = @CUSTOMER_ID

        )

        BEGIN

            SELECT 0 AS STATUS,

                   'EXPORT STORAGE DETAILS ALREADY EXIST FOR THIS CUSTOMER.' AS MESSAGE;

            RETURN;

        END



        -- 3️⃣ Insert Data

        INSERT INTO TBL_CUSTOMER_EXPORT_STORAGE

        (

            CUSTOMER_ID,

            EXPORT_CARGO_STORAGE_FACTOR,

            EXPORT_GROUND_RENT_FROM

        )

        VALUES

        (

            @CUSTOMER_ID,

            @EXPORT_CARGO_STORAGE_FACTOR,

            @EXPORT_GROUND_RATE_FROM

        )



        -- 4️⃣ Success Message

        SELECT 1 AS STATUS,

               'CUSTOMER EXPORT STORAGE DETAILS ADDED SUCCESSFULLY.' AS MESSAGE;



    END TRY



    BEGIN CATCH

        SELECT 0 AS STATUS,

               ERROR_MESSAGE() AS MESSAGE;

    END CATCH

END

-- dbo.CUSTOMER_IMPORT_STORAGE_ADD
GO
CREATE PROCEDURE [dbo].[CUSTOMER_IMPORT_STORAGE_ADD]

(

    @CUSTOMER_ID INT,

    @IMPORT_LOADED_GROUND_RENT_FROM DATETIME,

    @IMPORT_EMPTY_GROUND_RENT_FROM DATETIME,

    @IMPORT_CARGO_STORAGE DECIMAL(10,2),

    @BOND_NOC_WEEKS INT,

    @IN_BOND_INVOICE_NOT_REQUIRED BIT,

    @BOND_STORAGE_FROM_INBOND DATETIME

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY



        -- 1️⃣ Check Customer Exists

        IF NOT EXISTS (

            SELECT 1

            FROM TBL_MST_CUSTOMER

            WHERE CUSTOMER_ID = @CUSTOMER_ID

        )

        BEGIN

            SELECT 0 AS STATUS,

                   'Customer does not exist.' AS MESSAGE;

            RETURN;

        END



        -- 2️⃣ Duplicate Check

        IF EXISTS (

            SELECT 1

            FROM TBL_CUSTOMER_IMPORT_STORAGE

            WHERE CUSTOMER_ID = @CUSTOMER_ID

        )

        BEGIN

            SELECT 0 AS STATUS,

                   'Import storage already configured for this customer.' AS MESSAGE;

            RETURN;

        END



        -- 3️⃣ Insert Data

        INSERT INTO TBL_CUSTOMER_IMPORT_STORAGE

        (

            CUSTOMER_ID,

            IMPORT_LOADED_GROUND_RENT_FROM,

            IMPORT_EMPTY_GROUND_RENT_FROM,

            IMPORT_CARGO_STORAGE,

            BOND_NOC_WEEKS,

            IN_BOND_INVOICE_NOT_REQUIRED,

            BOND_STORAGE_FROM_INBOND

        )

        VALUES

        (

            @CUSTOMER_ID,

            @IMPORT_LOADED_GROUND_RENT_FROM,

            @IMPORT_EMPTY_GROUND_RENT_FROM,

            @IMPORT_CARGO_STORAGE,

            @BOND_NOC_WEEKS,

            @IN_BOND_INVOICE_NOT_REQUIRED,

            @BOND_STORAGE_FROM_INBOND

        );



        SELECT 1 AS STATUS,

               'Customer import storage added successfully.' AS MESSAGE;



    END TRY

    BEGIN CATCH

        SELECT 0 AS STATUS,

               ERROR_MESSAGE() AS MESSAGE;

    END CATCH



END

-- dbo.CUSTOMER_MAIL_CONFIGURATION_ADD
GO
CREATE PROCEDURE [dbo].[CUSTOMER_MAIL_CONFIGURATION_ADD]

(

   @CUSTOMER_ID INT,

   @OPERATIONS_EMAIL VARCHAR(150),

   @FINANCE_EMAIL VARCHAR(150),

   @AUCTION_EMAIL VARCHAR(150),

   @PDA_STATEMENT_EMAIL VARCHAR(150),

   @VIP_SHARING_EMAILS VARCHAR(150),

   @VIP_EMAILS VARCHAR(150)

)

AS 

BEGIN 

    SET NOCOUNT ON;



    BEGIN TRY



        -- 1️⃣ Check if Customer Exists

        IF NOT EXISTS (

            SELECT 1 

            FROM TBL_MST_CUSTOMER

            WHERE CUSTOMER_ID = @CUSTOMER_ID

        )

        BEGIN

            SELECT 0 AS STATUS,

                   'Customer does not exist.' AS MESSAGE;

            RETURN;

        END



        -- 2️⃣ Duplicate Check (One configuration per customer)

        IF EXISTS (

            SELECT 1

            FROM TBL_CUSTOMER_MAIL_CONFIGURATION

            WHERE CUSTOMER_ID = @CUSTOMER_ID

        )

        BEGIN

            SELECT 0 AS STATUS,

                   'Mail configuration already exists for this customer.' AS MESSAGE;

            RETURN;

        END



        -- 3️⃣ Insert Data

        INSERT INTO TBL_CUSTOMER_MAIL_CONFIGURATION

        (

            CUSTOMER_ID,

            OPERATIONS_EMAIL,

            FINANCE_EMAIL,

            AUCTION_EMAIL,

            PDA_STATEMENT_EMAIL,

            VIP_SHARING_EMAIL,

            VIP_EMAILS

        )

        VALUES

        (

            @CUSTOMER_ID,

            @OPERATIONS_EMAIL,

            @FINANCE_EMAIL,

            @AUCTION_EMAIL,

            @PDA_STATEMENT_EMAIL,

            @VIP_SHARING_EMAILS,

            @VIP_EMAILS

        )



        -- 4️⃣ Success Message

        SELECT 1 AS STATUS,

               'Customer mail configuration added successfully.' AS MESSAGE;



    END TRY

    BEGIN CATCH

        SELECT 0 AS STATUS,

               ERROR_MESSAGE() AS MESSAGE;

    END CATCH

END

-- dbo.ESS_MST_BLOCK_DELETE
-- DELETE

GO
CREATE   PROCEDURE ESS_MST_BLOCK_DELETE

  @BlockID INT, @DeletedBy INT, @PlantID INT

AS

BEGIN

  UPDATE ESS_MST_BLOCK SET IsDeleted=1,ModifiedBy=@DeletedBy,ModifiedDate=GETDATE()

  WHERE BlockID=@BlockID AND PlantID=@PlantID;

  SELECT 1 AS Status, 'Deleted' AS Message;

END

-- dbo.ESS_MST_BLOCK_GET
-- GET

GO
CREATE   PROCEDURE ESS_MST_BLOCK_GET

  @YardID INT = NULL, @PlantID INT

AS

BEGIN

  SELECT BlockID,YardID,PlantID,BlockName,BlockCode,RowStart,RowEnd,TotalColumns,Polygon,IsActive

  FROM ESS_MST_BLOCK

  WHERE PlantID=@PlantID AND ISNULL(IsDeleted,0)=0

    AND (@YardID IS NULL OR YardID=@YardID)

  ORDER BY BlockName;

END

-- dbo.ESS_MST_BLOCK_INSERT
-- INSERT

GO
CREATE   PROCEDURE ESS_MST_BLOCK_INSERT

  @YardID INT, @PlantID INT, @BlockName NVARCHAR(100), @BlockCode NVARCHAR(50),

  @RowStart NVARCHAR(5), @RowEnd NVARCHAR(5), @TotalColumns INT,

  @Polygon NVARCHAR(MAX), @IsActive BIT, @CreatedBy INT

AS

BEGIN

  INSERT INTO ESS_MST_BLOCK (YardID,PlantID,BlockName,BlockCode,RowStart,RowEnd,TotalColumns,Polygon,IsActive,CreatedBy)

  VALUES (@YardID,@PlantID,@BlockName,@BlockCode,@RowStart,@RowEnd,@TotalColumns,@Polygon,@IsActive,@CreatedBy);

  SELECT SCOPE_IDENTITY() AS BlockID, 'Block saved successfully' AS Message, 1 AS Status;

END

-- dbo.ESS_MST_BLOCK_UPDATE
-- UPDATE

GO
CREATE   PROCEDURE ESS_MST_BLOCK_UPDATE

  @BlockID INT, @YardID INT, @PlantID INT, @BlockName NVARCHAR(100), @BlockCode NVARCHAR(50),

  @RowStart NVARCHAR(5), @RowEnd NVARCHAR(5), @TotalColumns INT,

  @Polygon NVARCHAR(MAX), @IsActive BIT, @ModifiedBy INT

AS

BEGIN

  UPDATE ESS_MST_BLOCK SET

    YardID=@YardID, BlockName=@BlockName, BlockCode=@BlockCode,

    RowStart=@RowStart, RowEnd=@RowEnd, TotalColumns=@TotalColumns,

    Polygon=@Polygon, IsActive=@IsActive, ModifiedBy=@ModifiedBy, ModifiedDate=GETDATE()

  WHERE BlockID=@BlockID AND PlantID=@PlantID;

  SELECT 1 AS Status, 'Updated' AS Message;

END

-- dbo.ESS_MST_YARD_DELETE
GO
CREATE   PROCEDURE [dbo].[ESS_MST_YARD_DELETE]

( 

    @YardID BIGINT,

    @DeletedBy BIGINT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        UPDATE ESS_MST_YARD

        SET IsDelete = 1,

            DeletedBy = @DeletedBy,

            DeletedDate = GETDATE()

        WHERE YardID = @YardID;

        

        SELECT @@ROWCOUNT AS RowsAffected;

    END TRY

    BEGIN CATCH

        SELECT ERROR_MESSAGE() AS ErrorMessage,

               ERROR_LINE() AS ErrorLine,

               ERROR_NUMBER() AS ErrorNumber;

    END CATCH

END

-- dbo.ESS_MST_YARD_GET
GO
CREATE   PROCEDURE [dbo].[ESS_MST_YARD_GET] --null

( 

    @YardID BIGINT = NULL



)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

 SELECT YardID,PlantID,YardName,YardCode,YardTypeID,LatLong,Polygon.STAsText() AS Polygon,IsActive,

 CreatedBy,CreatedDate,ModifiedBy,ModifiedDate,DeletedBy,DeletedDate FROM ESS_MST_YARD

 WHERE (@YardID IS NULL OR YardID = @YardID) and IsDelete=0

 ORDER BY YardID DESC;



    END TRY

    BEGIN CATCH

        SELECT ERROR_MESSAGE() AS ErrorMessage,

               ERROR_LINE() AS ErrorLine,

               ERROR_NUMBER() AS ErrorNumber;

    END CATCH

END

-- dbo.ESS_MST_YARD_INSERT
GO
CREATE   PROCEDURE [dbo].[ESS_MST_YARD_INSERT]
    (
        @PlantID BIGINT = NULL,
        @YardName VARCHAR(100) = NULL,
        @YardCode VARCHAR(50) = NULL,
        @YardTypeID BIGINT = NULL,
        @LatLong VARCHAR(100) = NULL,
        @Polygon GEOMETRY = NULL,
        @IsActive BIT = 1,
        @CreatedBy BIGINT = NULL,
        @TotalRows INT = NULL,
        @TotalCols INT = NULL
    )
    AS
    BEGIN
        SET NOCOUNT ON;
        BEGIN TRY
            INSERT INTO ESS_MST_YARD
            (
                PlantID,
                YardName,
                YardCode,
                YardTypeID,
                LatLong,
                Polygon,
                IsActive,
                IsDelete,
                CreatedBy,
                CreatedDate,
                TotalRows,
                TotalCols
            )
            VALUES
            (
                @PlantID,
                @YardName,
                @YardCode,
                @YardTypeID,
                @LatLong,
                @Polygon,
                @IsActive,
                0,
                @CreatedBy,
                GETDATE(),
                @TotalRows,
                @TotalCols
            );
            
            SELECT SCOPE_IDENTITY() AS InsertedID;
        END TRY
        BEGIN CATCH
            SELECT ERROR_MESSAGE() AS ErrorMessage,
                   ERROR_LINE() AS ErrorLine,
                   ERROR_NUMBER() AS ErrorNumber;
        END CATCH
    END

-- dbo.ESS_MST_YARD_UPDATE
GO
CREATE   PROCEDURE [dbo].[ESS_MST_YARD_UPDATE]
    (
        @YardID BIGINT,
        @PlantID BIGINT = NULL,
        @YardName VARCHAR(100) = NULL,
        @YardCode VARCHAR(50) = NULL,
        @YardTypeID BIGINT = NULL,
        @LatLong VARCHAR(100) = NULL,
        @Polygon GEOMETRY = NULL,
        @IsActive BIT = 1,
        @ModifiedBy BIGINT = NULL,
        @TotalRows INT = NULL,
        @TotalCols INT = NULL
    )
    AS
    BEGIN
        SET NOCOUNT ON;
        BEGIN TRY
            UPDATE ESS_MST_YARD
            SET PlantID = ISNULL(@PlantID, PlantID),
                YardName = ISNULL(@YardName, YardName),
                YardCode = ISNULL(@YardCode, YardCode),
                YardTypeID = ISNULL(@YardTypeID, YardTypeID),
                LatLong = ISNULL(@LatLong, LatLong),
                Polygon = ISNULL(@Polygon, Polygon),
                IsActive = ISNULL(@IsActive, IsActive),
                TotalRows = ISNULL(@TotalRows, TotalRows),
                TotalCols = ISNULL(@TotalCols, TotalCols),
                ModifiedBy = @ModifiedBy,
                ModifiedDate = GETDATE()
            WHERE YardID = @YardID;
            
            SELECT 1 AS Success;
        END TRY
        BEGIN CATCH
            SELECT ERROR_MESSAGE() AS ErrorMessage,
                   ERROR_LINE() AS ErrorLine,
                   ERROR_NUMBER() AS ErrorNumber;
        END CATCH
    END

-- dbo.GET_ALL_TAB_TASKLIST
GO
CREATE PROC [dbo].[GET_ALL_TAB_TASKLIST]

@AssetNo varchar(50)

as

BEGIN



	SELECT datediff(hour,TM.JobCreation,GETDATE()),CAST(TM.JobID as int) as job_id,TM.JobCreation as Job_creation,TM.ContainerNo as Container_No,'' as Cont_ref_no,TM.TrailerNo as Trailer_no,

	TM.JobType as task_type,dbo.ConvertDDHHMMSS(isnull(JobCreation,getdate()),getdate()) as cont_size,'' as ProcessName,0 as Cont_Type,l.YardName+':'+L.RowNo+''+L.ColumnName+':'+CAST(L.StackNo as varchar) as Cont_Loc

	from ESS_MST_TASK_MASTER TM

	LEFT JOIN ESS_MST_TASK_ALLOCATION A on TM.JobID=A.JobID

	LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=TM.ProposedLocationID or L.LocationID=ActualLocationId

	left JOIN ESS_MST_EQUIPMENT E ON E.DeviceID=A.AssetID 

	WHERE datediff(hour,TM.JobCreation,GETDATE()) <=3 and JobCompletionDate is null

	and E.VTMImeiNo=@AssetNo

	and (CASE WHEN UPPER(TM.JobType)='OFFLOAD' THEN TM.ProposedLocationID when UPPER(JobType)='PICKUP' then isnull(TM.ActualLocationId,-1) END)!=0

	order by TM.JobID desc





	--declare @Location as varchar(20);

	--declare @JobAllow as int;

	--select @Location= es.[Location],@JobAllow=e.JobAllow   from EKL_TRN_EQUIPMENT_STATUS es

	--left join ESS_MST_EQUIPMENT e on es.DeviceIMEI=e.DeviceID 

	--where e.VTMImeiNo = @AssetNo;

	

	--IF(@JobAllow =1)

	--BEGIN

	--SELECT DISTINCT * FROM (SELECT CAST(TM.JobID as int) as job_id,TM.JobCreation as Job_creation,TM.ContainerNo as Container_No,I.ContRefNo as Cont_ref_no,TM.TrailerNo as Trailer_no,

	--TM.JobType as task_type,dbo.ConvertDDHHMMSS(isnull(JobCreation,getdate()),getdate()) as cont_size,I.Process as ProcessName,0 as Cont_Type,l.YardName+':'+S.SlotName+':'+CAST(L.StackNo as varchar) as Cont_Loc

	--from ESS_MST_TASK_MASTER TM

	--LEFT JOIN ESS_MST_TASK_ALLOCATION A on TM.JobID=A.JobID

	--LEFT JOIN EKL_TRN_INVENTORY I ON I.ContMasterID=TM.ContainerMasterID and I.GateOutDate IS NULL

	--LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=TM.ProposedLocationID

	--LEFT JOIN ESS_MST_SLOT S ON S.SlotID=L.SlotId

	--INNER JOIN ESS_MST_EQUIPMENT E ON E.DeviceID=A.AssetID 

	--WHERE CAST(TM.JobCreation as date)=CAST(GETDATE() as date)

	--) as tb WHERE tb.Cont_Loc like '%'+@Location+'%'

	--ORDER BY tb.job_id desc

	--END

	--ELSE

	--BEGIN 

	--SELECT CAST(TM.JobID as int) as job_id,TM.JobCreation as Job_creation,TM.ContainerNo as Container_No,I.ContRefNo as Cont_ref_no,TM.TrailerNo as Trailer_no,

	--TM.JobType as task_type,dbo.ConvertDDHHMMSS(isnull(JobCreation,getdate()),getdate()) as cont_size,I.Process as ProcessName,0 as Cont_Type,l.YardName+':'+L.RowNo+''+L.ColumnName+':'+CAST(L.StackNo as varchar) as Cont_Loc

	--from ESS_MST_TASK_MASTER TM

	--LEFT JOIN ESS_MST_TASK_ALLOCATION A on TM.JobID=A.JobID

	--LEFT JOIN EKL_TRN_INVENTORY I ON I.ContMasterID=TM.ContainerMasterID and I.GateOutDate IS NULL

	--LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=TM.ProposedLocationID

	--LEFT JOIN ESS_MST_SLOT S ON S.SlotID=L.SlotId

	--INNER JOIN ESS_MST_EQUIPMENT E ON E.DeviceID=A.AssetID 

	--WHERE CAST(TM.JobCreation as date)=CAST(GETDATE() as date) 

	--and l.YardName+'-'+S.SlotName+':'+CAST(L.StackNo as varchar) like '%'+@Location+'%' 

	--order by TM.JobID desc

	--END

END

-- dbo.GET_ALL_YARDINVENTORY_LIST
GO
CREATE PROC [dbo].[GET_ALL_YARDINVENTORY_LIST]    

--@PlantID bigint    

as     

BEGIN    

  

SELECT DISTINCT (I.CONTAINER_NO)as Cont_No ,(CASE when I.CONTAINER_SIZE_ID=1

then L.ContainerLocationName1 else L.ContainerLocationName end)  AS Last_Loc FROM TBL_CONTAINER_INVENTORY I   

LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=I.LAST_LOCATION  

WHERE I.GATE_OUT_DATE IS NULL and I.CONTAINER_NO IS NOT NULL and I.CONTAINER_NO <>'' --and UPPER(I.Process) !='EMPTY' and UPPER(I.ContainerStatus)!='EMPTY'  

  

--SELECT DISTINCT (I.ContNo)as Cont_No ,L.ContainerLocationName AS Last_Loc FROM EKL_TRN_INVENTORY I   

--LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=I.LastLocID  

--WHERE GateOutDate IS NULL and I.ContNo IS NOT NULL  

--UNION ALL  

--SELECT DISTINCT(RI.ContainerNo) as ContNo,L.ContainerLocationName AS Last_Loc FROM EKL_TRN_RAIL_INVENTORY  RI   

--LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=RI.LastLocID  

--WHERE RI.GateOutDate IS NULL and ContainerNo <> '' and RI.ContainerNo IS NOT NULL  

END

-- dbo.GET_ALLCONTAINER_LIVESTATUS
GO
CREATE PROC [dbo].[GET_ALLCONTAINER_LIVESTATUS]  

    @PlantID BIGINT  

AS  

BEGIN  

 SELECT  distinct(g.ContNo) as ContainerNo,'' as TrailerNo,g.ContainerSize,g.ContainerType,Upper(Process) as Process,g.GateInDate ,  

 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL THEN 'EMPTY-YARD' ELSE

 (case when g.ContainerSize like '40%' then ll.ContainerLocationName1 else ll.ContainerLocationName end) 

 END) as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,eq.Equipment_Name as EquipmentName,

 cast(g.LocLatitude as decimal(18,6)) as Latitude,cast(g.LocLongitude  as decimal(18,6)) as Longitude,

 ([dbo].[ConvertDDHHMMSS] (GateInDate,getdate())) as GateInTAT,([dbo].[ConvertDDHHMMSS] (GateInDate,OffloadDate)) as OffloadTAT,

 DocumentNo,BookingNo,ContainerStatus,Mode,Terminal,'' as GateInLocation,GateOutDate,ReleaseStatus,g.NoOfMoves,g.YardType,g.YardInTime,g.YardOutTime,g.RailInDateTime,g.RailOutDateTime

FROM EKL_TRN_INVENTORY g

left join ESS_MST_EQUIPMENT eq on  eq.DeviceID=CAST(g.EquipmentId as varchar)

left join ESS_MST_LOCATION ll on ll.LocationID = g.LastLocID

--left join ESS_MST_LOCATION_MAPPING LM on  LM.AdjucentId=G.LastLocID

where  GateOutDate is null and isnull(ReleaseStatus,'R') in ('R')

ORDER BY g.GateInDate desc 

END

-- dbo.GET_BLOCKWISE_DETAILS
GO
CREATE PROC [dbo].[GET_BLOCKWISE_DETAILS]  

@BlockId bigint  

as  

begin  

select NoOfRows,NoOfColumns,NoOfStack,MarkingStart,RowStart from ESS_MST_BLOCK  

where BlockId=@BlockId  

end

-- dbo.GET_BREAKDOWN_DETAIL
GO
CREATE PROCEDURE [dbo].[GET_BREAKDOWN_DETAIL]

@PlantID bigint

as

begin

select BRKID,e.Equipment_Name as EqpName ,MaintanceStart,MaintanceEnd,

([dbo].[ConvertDDHHMMSS](MaintanceStart,ISNULL(MaintanceEnd,GETDATE()))) as TAT,

(CASE WHEN DATEDIFF(MINUTE,b.MaintanceStart,b.MaintanceEnd)<180 THEN 'COOLING' ELSE b.Reason END) AS Reason,

b.IsActive,(CASE when u.UserName IS null THEN 'System' else U.UserName end) as RemarkBy 

from ESS_MST_BREAKDOWN b

join ESS_MST_EQUIPMENT e on e.EqpID=b.VehicleID

left join IND_MST_USER u on u.UserID=b.CreatedBy

where b.IsDelete=0 and (b.MaintanceEnd IS NULL OR CAST(MaintanceStart as date)=CAST(GETDATE() as date))

end

-- dbo.GET_BREAKDOWN_DETAIL_FILTER
GO
CREATE PROCEDURE [dbo].[GET_BREAKDOWN_DETAIL_FILTER]  

@PlantID bigint, 

@fromdate datetime,

@todate datetime

as  

begin  

select BRKID,e.Equipment_Name as EqpName ,MaintanceStart,MaintanceEnd,  

([dbo].[ConvertDDHHMMSS] (b.MaintanceStart,b.MaintanceEnd)) as TAT,

(CASE WHEN DATEDIFF(MINUTE,b.MaintanceStart,b.MaintanceEnd)>90 and DATEDIFF(MINUTE,b.MaintanceStart,b.MaintanceEnd)<180 THEN 'COOLING' ELSE b.Reason END) AS Reason,b.IsActive,U.UserName as RemarkBy   

from ESS_MST_BREAKDOWN b  

join ESS_MST_EQUIPMENT e on e.EqpID=b.VehicleID  

left join IND_MST_USER u on u.UserID=b.CreatedBy  

where b.IsDelete=0 and CAST(b.MaintanceStart AS DATE) between  @fromdate and  @todate and MaintanceEnd IS NOT NULL

order by b.MaintanceStart desc

end

-- dbo.GET_CONT_HISTORY_REPORT
GO
CREATE PROC [dbo].[GET_CONT_HISTORY_REPORT]

@fromDate DATETIME,  

@toDate DATETIME,  

@ContNo varchar(50),  

@PlantID BIGINT  

AS  

BEGIN  

IF @ContNo <> ''

BEGIN  

  select  TR.ContNo as ContainerNo, I.ContainerSize, I.ContainerType, TR.Process, TR.Mode,TR.DocumentNo,TR.BookingNo,TR.GateInType as GateInLocation,

   dbo.ConvertDDHHMMSS(TR.GateInDate,isnull(TR.GateOutDate,getdate())) as TAT,TR.GateOutDate, TR.GateInDate from EKL_TRN_CONTAINER TR  

  LEFT JOIN EKL_TRN_INVENTORY I ON I.ContMasterID =TR.ContMasterId where  TR.ContNo=@ContNo   and TR.ContNo is Not NUll

END  

ELSE  

BEGIN  

	 select  TR.ContNo as ContainerNo, I.ContainerSize, I.ContainerType, TR.Process, TR.Mode,TR.DocumentNo,TR.BookingNo,TR.GateInType as GateInLocation,

	 dbo.ConvertDDHHMMSS(TR.GateInDate,isnull(TR.GateOutDate,getdate())) as TAT, TR.GateOutDate,TR.GateInDate from EKL_TRN_CONTAINER TR  

	 LEFT JOIN EKL_TRN_INVENTORY I ON I.ContMasterID =TR.ContMasterId

	 where  TR.GateInDate between @fromDate and @toDate  and TR.ContNo is Not NUll

END  

END

-- dbo.GET_CONTAINER_LIVE_STATUS_REPORT
GO
CREATE PROCEDURE [dbo].[GET_CONTAINER_LIVE_STATUS_REPORT]

@fromDate datetime,

@toDate datetime,

@PlantID bigint

as 

begin



select I.ContNo,CS.ContSize,CT.ContTypeName,I.GateInDate,

[dbo].[ConvertDDHHMMSS](I.GateInDate,GETDATE()) as TAT,

'' as ActivityName,P.ProcessName,'' as Arrival,

  G.GateName,U.UserName,GateOutDate,'' as OffLocation,'' as LastLocation

  from EKL_TRN_INVENTORY I

  LEFT JOIN ESS_MST_CONTAINER_SIZE CS ON CS.ContSizeID=I.SizeID

  LEFT JOIN ESS_MST_CONTAINER_TYPE CT ON CT.ContTypeID=I.ContTypeId

  LEFT JOIN ESS_MST_PROCESS P ON P.ProcessID=I.ProcessID

  LEFT JOIN ESS_MST_GATE G ON G.GateID=I.GateInType

  LEFT JOIN IND_MST_USER U ON U.UserID=I.GateInBy

  where I.PlantID=@PlantId and I.GateInDate between @fromDate and @toDate and I.GateOutDate IS NULL



end

-- dbo.GET_CONTAINER_UPDATE_HISTORY
GO
CREATE PROCEDURE [dbo].[GET_CONTAINER_UPDATE_HISTORY]

 @PlantID bigint ,

 @FromDate DateTime,    

 @ToDate DateTime   

as    

BEGIN   



set @FromDate=ISNULL(@FromDate,'');

---select * from EKL_PRE_RAIL_IN where DocumentNO='SNL/RJ/X/24-25/00054'

if @FromDate != ''

begin

 select COUNT(*) as UpdateCount,CAST(TransDate as date) as TransactionDate,U.UserName,CAST(ET.ModifiedOn as date) as UpdatedDate from EKL_TRN_EQUIPMENT_TRANSACTION ET 

INNER JOIN IND_MST_USER U ON U.UserID=ET.ModifiedBy

where ET.PacketType in ('UK') and cast(ModifiedOn as date) between @FromDate and @ToDate

GROUP BY CAST(TransDate as date),U.UserName,CAST(ET.ModifiedOn as date)

end

else

begin

  select COUNT(*) as UpdateCount,CAST(TransDate as date) as TransactionDate,U.UserName,CAST(ET.ModifiedOn as date) as UpdatedDate from EKL_TRN_EQUIPMENT_TRANSACTION ET 

INNER JOIN IND_MST_USER U ON U.UserID=ET.ModifiedBy

where ET.PacketType in ('UK') and cast(ModifiedOn as date)=CAST(GETDATE() as date)

GROUP BY CAST(TransDate as date),U.UserName,CAST(ET.ModifiedOn as date)

end





END

-- dbo.GET_CONTAINERAGEING_DAYWISE
GO
CREATE PROC [dbo].[GET_CONTAINERAGEING_DAYWISE] 

 @PlantID BIGINT,

 @Type nvarchar(50),

 @Series varchar(50)

AS  

BEGIN  

IF @Type = 'DAY 0-5'

BEGIN

 SELECT  g.ContNo as ContainerNo,'' as TrailerNo,g.ContainerSize,g.ContainerType,Upper(Process) as Process,g.GateInDate ,  

'' as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,'' as EquipmentName,

 cast(g.LocLatitude as decimal(18,6)) as Latitude,cast(g.LocLongitude  as decimal(18,6)) as Longitude,

 CAST(DATEDIFF(DAY,GateInDate,GETDATE()) as varchar) as GateInTAT,([dbo].[ConvertDDHHMMSS] (GateInDate,OffloadDate)) as OffloadTAT,

 DocumentNo,BookingNo,UPPER(g.ContainerStatus) as ContainerStatus,Mode,Terminal,'' as GateInLocation,g.NoOfMoves,

 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL and g.YardType is null then 'EMPTY-YARD' else g.YardType end) as YardType,g.YardInTime,g.YardOutTime,g.RailInDateTime,g.RailOutDateTime

FROM EKL_TRN_INVENTORY g where g.GateOutDate is null and isnull(g.ReleaseStatus,'R') in ('R')

AND datediff(day,g.GateInDate,getdate()) between 0 and 5 and g.Process like '%'+@Series+'%'



END

ELSE IF @Type='DAY 06-10'

BEGIN

SELECT  g.ContNo as ContainerNo,'' as TrailerNo,g.ContainerSize,g.ContainerType,Upper(Process) as Process,g.GateInDate ,  

'' as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,'' as EquipmentName,

 cast(g.LocLatitude as decimal(18,6)) as Latitude,cast(g.LocLongitude  as decimal(18,6)) as Longitude,

 CAST(DATEDIFF(DAY,GateInDate,GETDATE()) as varchar) as GateInTAT,([dbo].[ConvertDDHHMMSS] (GateInDate,OffloadDate)) as OffloadTAT,

 DocumentNo,BookingNo,UPPER(g.ContainerStatus) as ContainerStatus,Mode,Terminal,'' as GateInLocation,g.NoOfMoves,

 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL and g.YardType is null then 'EMPTY-YARD' else g.YardType end) as YardType,g.YardInTime,g.YardOutTime,g.RailInDateTime,g.RailOutDateTime

FROM EKL_TRN_INVENTORY g where g.GateOutDate is null and isnull(g.ReleaseStatus,'R') in ('R')

AND datediff(day,g.GateInDate,getdate()) between 6 and 10 and g.Process like '%'+@Series+'%'

END

ELSE IF @Type='DAY 11-20'

BEGIN

SELECT  g.ContNo as ContainerNo,'' as TrailerNo,g.ContainerSize,g.ContainerType,Upper(Process) as Process,g.GateInDate ,  

'' as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,'' as EquipmentName,

 cast(g.LocLatitude as decimal(18,6)) as Latitude,cast(g.LocLongitude  as decimal(18,6)) as Longitude,

 CAST(DATEDIFF(DAY,GateInDate,GETDATE()) as varchar) as GateInTAT,([dbo].[ConvertDDHHMMSS] (GateInDate,OffloadDate)) as OffloadTAT,

 DocumentNo,BookingNo,UPPER(g.ContainerStatus) as ContainerStatus,Mode,Terminal,'' as GateInLocation,g.NoOfMoves,

 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL and g.YardType is null then 'EMPTY-YARD' else g.YardType end) as YardType,g.YardInTime,g.YardOutTime,g.RailInDateTime,g.RailOutDateTime

FROM EKL_TRN_INVENTORY g where g.GateOutDate is null and isnull(g.ReleaseStatus,'R') in ('R')

AND datediff(day,g.GateInDate,getdate()) between 11 and 20 and g.Process like '%'+@Series+'%'

END

ELSE IF @Type='DAY 21-30'

BEGIN

SELECT  g.ContNo as ContainerNo,'' as TrailerNo,g.ContainerSize,g.ContainerType,Upper(Process) as Process,g.GateInDate ,  

'' as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,'' as EquipmentName,

 cast(g.LocLatitude as decimal(18,6)) as Latitude,cast(g.LocLongitude  as decimal(18,6)) as Longitude,

 CAST(DATEDIFF(DAY,GateInDate,GETDATE()) as varchar) as GateInTAT,([dbo].[ConvertDDHHMMSS] (GateInDate,OffloadDate)) as OffloadTAT,

 DocumentNo,BookingNo,UPPER(g.ContainerStatus) as ContainerStatus,Mode,Terminal,'' as GateInLocation,g.NoOfMoves,

 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL and g.YardType is null then 'EMPTY-YARD' else g.YardType end) as YardType,g.YardInTime,g.YardOutTime,g.RailInDateTime,g.RailOutDateTime

FROM EKL_TRN_INVENTORY g where g.GateOutDate is null and isnull(g.ReleaseStatus,'R') in ('R')

AND datediff(day,g.GateInDate,getdate()) between 21 and 30 and g.Process like '%'+@Series+'%'

END

ELSE IF @Type='DAY ABOVE 30'

BEGIN

SELECT  g.ContNo as ContainerNo,'' as TrailerNo,g.ContainerSize,g.ContainerType,Upper(Process) as Process,g.GateInDate ,  

'' as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,'' as EquipmentName,

 cast(g.LocLatitude as decimal(18,6)) as Latitude,cast(g.LocLongitude  as decimal(18,6)) as Longitude,

 CAST(DATEDIFF(DAY,GateInDate,GETDATE()) as varchar) as GateInTAT,([dbo].[ConvertDDHHMMSS] (GateInDate,OffloadDate)) as OffloadTAT,

 DocumentNo,BookingNo,UPPER(g.ContainerStatus) as ContainerStatus,Mode,Terminal,'' as GateInLocation,g.NoOfMoves,

 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL and g.YardType is null then 'EMPTY-YARD' else g.YardType end) as YardType,g.YardInTime,g.YardOutTime,g.RailInDateTime,g.RailOutDateTime

FROM EKL_TRN_INVENTORY g where g.GateOutDate is null and isnull(g.ReleaseStatus,'R') in ('R')

AND datediff(day,g.GateInDate,getdate()) > 30 and g.Process like '%'+@Series+'%'

END

   

END

-- dbo.GET_CONTAINERLIFECYCLE_DETAILS
GO
CREATE PROCEDURE [dbo].[GET_CONTAINERLIFECYCLE_DETAILS]     

@ContainerNo varchar(500) ,  

@PlantID bigint  

AS    

BEGIN    

   select g.ContMasterID as MasterId,DocumentNo as DocumentNo,g.ContNo as ContainerNo, g.ContainerSize as ContainerSize,

   g.ContainerType as ContainerType,g.Process as Process,'' as  TruckNo,'' as TransporterName,g.GateInDate,g.GateOutDate,

   g.LastShiftDate as LastShiftDate,[dbo].ConvertDDHHMMSS(GateInDate,isnull(GateOutDate,getdate())) as TAT 

   from EKL_TRN_INVENTORY g where g.ContNo in (select Value from [dbo].Split_String(@ContainerNo,','))    

       

END

-- dbo.GET_CONTAINERLIST
GO
CREATE PROC [dbo].[GET_CONTAINERLIST]  

@PlantID bigint  

as   

begin  

  

  

select distinct (ContNo),InventoryID,   1 as IsSuccess from EKL_TRN_INVENTORY   

where GateOutDate IS NULL and isnull(ReleaseStatus,'R') in ('R')

  

end

-- dbo.GET_CONTAINERLIVESTATUS
GO
CREATE PROC [dbo].[GET_CONTAINERLIVESTATUS]  

	@PageIndex int,

    @SearchFor nvarchar(MAX),  

    @PlantID BIGINT  

AS  

BEGIN  

--declare @PageIndex int=1;

--declare @SearchFor nvarchar(MAX)=''

--declare @PlantID BIGINT =0; 

set @SearchFor = ISNULL(@SearchFor,'');



if @SearchFor != '' 

begin

SELECT  distinct(g.ContNo) as ContainerNo,'' as TrailerNo,g.ContainerSize,g.ContainerType,Upper(Process) as Process,g.GateInDate ,  

 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL THEN 'EMPTY-YARD' ELSE

 (case when g.ContainerSize like '40%' then ll.ContainerLocationName1 else ll.ContainerLocationName end) 

  END ) as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,eq.Equipment_Name as EquipmentName,

 cast(g.LocLatitude as decimal(18,6)) as Latitude,cast(g.LocLongitude  as decimal(18,6)) as Longitude,

 ([dbo].[ConvertDDHHMMSS] (GateInDate,getdate())) as GateInTAT,([dbo].[ConvertDDHHMMSS] (GateInDate,OffloadDate)) as OffloadTAT,

 DocumentNo,BookingNo,UPPER(g.ContainerStatus) as ContainerStatus,Mode,Terminal,'' as GateInLocation,g.NoOfMoves,

 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL and g.YardType is null then 'EMPTY-YARD' else g.YardType end) as YardType,

 g.YardInTime,g.YardOutTime,g.RailInDateTime,g.RailOutDateTime

FROM EKL_TRN_INVENTORY g

left join ESS_MST_EQUIPMENT eq on  eq.DeviceID=CAST(g.EquipmentId as varchar)

left join ESS_MST_LOCATION ll on ll.LocationID = g.LastLocID

--left join ESS_MST_LOCATION_MAPPING LM on LM.AdjucentId=G.LastLocID

where g.GateOutDate is null and isnull(g.ReleaseStatus,'R') in ('R')

and g.ContNo in (select Value from [dbo].Split_String(@SearchFor,','))

ORDER BY g.GateInDate desc OFFSET 25 * (@PageIndex - 1) ROWS  

FETCH NEXT 25 ROWS ONLY

end

else

begin

 SELECT  g.ContNo as ContainerNo,'' as TrailerNo,g.ContainerSize,g.ContainerType,Upper(Process) as Process,g.GateInDate ,  

 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL THEN 'EMPTY-YARD' ELSE

 (case when g.ContainerSize like '40%' then ll.ContainerLocationName1 else ll.ContainerLocationName end) 

  END ) as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,eq.Equipment_Name as EquipmentName,

 cast(g.LocLatitude as decimal(18,6)) as Latitude,cast(g.LocLongitude  as decimal(18,6)) as Longitude,

 ([dbo].[ConvertDDHHMMSS] (GateInDate,getdate())) as GateInTAT,([dbo].[ConvertDDHHMMSS] (GateInDate,OffloadDate)) as OffloadTAT,

 DocumentNo,BookingNo,UPPER(g.ContainerStatus) as ContainerStatus,Mode,Terminal,'' as GateInLocation,g.NoOfMoves,

 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL and g.YardType is null then 'EMPTY-YARD' else g.YardType end) as YardType,g.YardInTime,g.YardOutTime,g.RailInDateTime,g.RailOutDateTime

FROM EKL_TRN_INVENTORY g

left join ESS_MST_EQUIPMENT eq on eq.DeviceID=CAST(g.EquipmentId as varchar)

left join ESS_MST_LOCATION ll on ll.LocationID = g.LastLocID

--left join ESS_MST_LOCATION_MAPPING LM on LM.AdjucentId=G.LastLocID

where g.GateOutDate is null and isnull(g.ReleaseStatus,'R') in ('R')

ORDER BY isnull(g.LastLocID,9999999) asc OFFSET 15 * (@PageIndex - 1) ROWS  

FETCH NEXT 15 ROWS ONLY

end

   

END

-- dbo.GET_CONTAINERLIVESTATUSFILTER
GO
CREATE PROCEDURE [dbo].[GET_CONTAINERLIVESTATUSFILTER]

@ContainerNo nvarchar(max),

@PlantID bigint,

@YardType varchar(50)

as 

begin



IF UPPER(@YardType)='YARD'

BEGIN

	SELECT 

	distinct(g.ContNo) as ContainerNo,ROW_NUMBER() OVER (ORDER BY g.contNo asc) AS SrNo ,g.ContainerSize,

	(case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL THEN 'EMPTY-YARD' ELSE

 (case when g.ContainerSize like '40%' then ll.ContainerLocationName1 else ll.ContainerLocationName end) 

  END ) as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,

	g.GateInDate,eq.Equipment_Name as EquipmentName,cast(g.LocLatitude as decimal(18,6)) as Latitude,cast(g.LocLongitude  as decimal(18,6)) as Longitude

	FROM EKL_TRN_INVENTORY g

	left join ESS_MST_EQUIPMENT eq on  eq.DeviceID=CAST(g.EquipmentId as varchar)

	left join ESS_MST_LOCATION ll on ll.LocationID = g.LastLocID

	--left join ESS_MST_LOCATION_MAPPING LM on LM.LocationID = g.LastLocID OR LM.AdjucentId=G.LastLocID

	where g.GateOutDate is null and g.ContNo!=''

	and g.ContNo in (select Value from [dbo].Split_String(@ContainerNo,',')) order by 2 asc

END

ELSE IF UPPER(@YardType)='RAIL'

BEGIN

	SELECT distinct(R.ContainerNo) as ContainerNo,ROW_NUMBER() OVER (ORDER BY R.ContainerNo asc) AS SrNo ,R.ContainerSize AS ContainerSize,(case when R.ContainerSize like '40%' then ll.ContainerLocationName1 else ll.ContainerLocationName end) as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,

	R.GateInDate as GateInDate,eq.Equipment_Name as EquipmentName,cast(R.LocLatitude as decimal(18,6)) as Latitude,cast(R.LocLongitude  as decimal(18,6)) as Longitude

	FROM EKL_TRN_RAIL_INVENTORY R

	left join ESS_MST_EQUIPMENT eq on  eq.DeviceID=CAST(R.EquipmentId as varchar)

	left join ESS_MST_LOCATION ll on ll.LocationID = R.LastLocID

	--left join ESS_MST_LOCATION_MAPPING LM on LM.LocationID = R.LastLocID OR LM.AdjucentId=R.LastLocID

	where R.GateOutDate is null

	and R.ContainerNo in (select Value from [dbo].Split_String(@ContainerNo,',')) order by 2 asc

END

ELSE

BEGIN

	SELECT distinct(g.ContNo) as ContainerNo,ROW_NUMBER() OVER (ORDER BY g.contNo asc) AS SrNo ,

	g.ContainerSize as ContainerSize,(case when g.ContainerSize like '40%' then ll.ContainerLocationName1 else ll.ContainerLocationName end)  as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,

	g.GateInDate,eq.Equipment_Name as EquipmentName,cast(g.LocLatitude as decimal(18,6)) as Latitude,

	cast(g.LocLongitude  as decimal(18,6)) as Longitude

	FROM EKL_TRN_INVENTORY g

	left join ESS_MST_EQUIPMENT eq on  eq.DeviceID=CAST(g.EquipmentId as varchar)

	left join ESS_MST_LOCATION ll on ll.LocationID = g.LastLocID

	--left join ESS_MST_LOCATION_MAPPING LM on LM.LocationID = g.LastLocID OR LM.AdjucentId=G.LastLocID

	where g.GateOutDate is null 

	and g.ContNo in (select Value from [dbo].Split_String(@ContainerNo,',')) order by 2 asc

END



END

-- dbo.GET_CONTAINERTRACKING_DATA
GO
CREATE PROC [dbo].[GET_CONTAINERTRACKING_DATA]  

  @ContainerNo varchar(max),  

  @PlantID bigint  

  as  

  begin  

  select ContNo,i.ContainerSize as ContSize,i.ContainerType as ContTypeName,i.Process as ProcessName,(CASE WHEN i.ContainerSize like '%40%' then l.ContainerLocationName1 else  l.ContainerLocationName end) as  Location 

  from EKL_TRN_INVENTORY i  

  left join ESS_MST_LOCATION l on l.LocationID=i.LastLocID  

  where i.ContNo in (select Value from [dbo].Split_String(@ContainerNo,','))

  end

-- dbo.GET_COUNT_WITH_AVG_MOVES
GO
CREATE PROCEDURE [dbo].[GET_COUNT_WITH_AVG_MOVES]   

AS  

BEGIN  

  -- select sum(a1) as gt10,sum(a2) as gt5,sum(a3) as gt3,sum(a4) as ls3,CAST((SUM(cnt)*1.0)/count(*) as decimal(18,1)) avg_move_cont from   

  -- (  

  -- select 

  -- case when cnt >= 10 then 1 else 0 end as a1,  

  -- case when cnt < 10 and cnt >= 5 then 1 else 0 end as a2,  

  -- case when cnt < 5 and cnt >= 3 then 1 else 0 end as a3,  

  -- case when cnt < 3 and cnt >= 0 then 1 else 0 end as a4,

  -- cnt as cnt from   

  --    (  

		--select  ci.ContNo,ContMasterID as Master_Id,ci.LastShiftDate AS LastShiftDate,ci.GateInDate as Gate_IN,IIF(CI.NoOfMoves=0,1,CI.NoOfMoves) as cnt 

		--from EKL_TRN_INVENTORY ci   where  ci.GateOutDate is null  and LEN(ci.ContNo)=11 and ContainerStatus<>'EMPTY' and Process<>'EMPTY' and isnull(I.ReleaseStatus,'R') in ('R')

	 -- ) as tb  

  --  ) as tb1  

    select Aging,Size20,Size40,avg_move_cont from (

	SELECT  

   isnull(sum(case when NoOfMoves >= 25 and ContainerSize in('20','20HQ') then 1 else 0 end),0) as 'Size20',

   isnull(sum(case when NoOfMoves >= 25 and ContainerSize in('40','40HQ') then 1 else 0 end),0) as 'Size40',

   CAST((SUM(NoOfMoves)*1.0)/count(*) as decimal(18,1)) as avg_move_cont,

   '>=25' as Aging FROM EKL_TRN_INVENTORY I  

   where  I.GateOutDate is null and isnull(I.ReleaseStatus,'R') in ('R') and UPPER(I.Process) in ('DOMESTIC','EXPORT','IMPORT')

   union

   SELECT  

   isnull(sum(case when NoOfMoves >= 10 and NoOfMoves < 25 and ContainerSize in('20','20HQ') then 1 else 0 end),0) as 'Size20',

   isnull(sum(case when NoOfMoves >= 10 and NoOfMoves < 25 and ContainerSize in('40','40HQ') then 1 else 0 end),0) as 'Size40',

   CAST((SUM(NoOfMoves)*1.0)/count(*) as decimal(18,1)) as avg_move_cont,

   '>=10 & <25' as Aging FROM EKL_TRN_INVENTORY I  

   where  I.GateOutDate is null and isnull(I.ReleaseStatus,'R') in ('R') and UPPER(I.Process) in ('DOMESTIC','EXPORT','IMPORT')

   union

   SELECT 

   isnull(sum(case when NoOfMoves >= 5 and NoOfMoves < 10 and ContainerSize in('20','20HQ') then 1 else 0 end),0) as 'Size20',

   isnull(sum(case when NoOfMoves >= 5 and NoOfMoves < 10 and ContainerSize in('40','40HQ') then 1 else 0 end),0) as 'Size40',

   CAST((SUM(NoOfMoves)*1.0)/count(*) as decimal(18,1)) as avg_move_cont,

   '>=05 & <10' as Aging

   FROM EKL_TRN_INVENTORY I  

   where  I.GateOutDate is null and isnull(I.ReleaseStatus,'R') in ('R') and UPPER(I.Process) in ('DOMESTIC','EXPORT','IMPORT')

   union

   SELECT 

   isnull(sum(case when NoOfMoves > 3 and NoOfMoves < 5 and ContainerSize in('20','20HQ') then 1 else 0 end),0) as 'Size20',

   isnull(sum(case when NoOfMoves > 3 and NoOfMoves < 5 and ContainerSize in('40','40HQ') then 1 else 0 end),0) as 'Size40',

   CAST((SUM(NoOfMoves)*1.0)/count(*) as decimal(18,1)) as avg_move_cont,

   '>=03 & <05' as Aging

   FROM EKL_TRN_INVENTORY I  

   where  I.GateOutDate is null and isnull(I.ReleaseStatus,'R') in ('R') and UPPER(I.Process) in ('DOMESTIC','EXPORT','IMPORT')

   union

   SELECT 

   isnull(sum(case when NoOfMoves < 3 and NoOfMoves >= 0 and ContainerSize in('20','20HQ') then 1 else 0 end),0) as 'Size20',

   isnull(sum(case when NoOfMoves < 3 and NoOfMoves >= 0 and ContainerSize in('40','40HQ') then 1 else 0 end),0) as 'Size40',

   CAST((SUM(NoOfMoves)*1.0)/count(*) as decimal(18,1)) as avg_move_cont,

   '>=01 & <03' as Aging

   FROM EKL_TRN_INVENTORY I  

   where  I.GateOutDate is null and isnull(I.ReleaseStatus,'R') in ('R') and UPPER(I.Process) in ('DOMESTIC','EXPORT','IMPORT')

  ) a order by '1'+Aging asc



END

-- dbo.GET_COUNT_WITH_MOVES
GO
CREATE PROCEDURE [dbo].[GET_COUNT_WITH_MOVES]   

AS  

BEGIN  

  

	select  ci.ContNo ,CI.ContMasterID as Master_Id,ci.LastShiftDate AS LastShiftDate,ci.GateInDate as Gate_IN,

	IIF(CI.NoOfMoves=0,1,CI.NoOfMoves) as cnt 

	from EKL_TRN_INVENTORY ci  where  ci.GateOutDate is null 

	and ContainerStatus<>'EMPTY' and Process<>'EMPTY'

	and LEN(ContNo)=11 order by CI.NoOfMoves desc

     

END

-- dbo.GET_CURRENTEQUIPMENT_STATUS
GO
CREATE PROCEDURE [dbo].[GET_CURRENTEQUIPMENT_STATUS]    

@PlantID bigint  

AS    

BEGIN    

 SET NOCOUNT ON;    

    

WITH  CTE  AS (

  SELECT OCRContainerNo,DeviceID,TransDate, ROW_NUMBER()  OVER (PARTITION BY  DeviceId  ORDER BY  TransDate DESC)  AS  row_num

  FROM

    EKL_TRN_EQUIPMENT_TRANSACTION where PacketType='UK' and cast(TransDate as date)=cast(getdate() as date)

)



--select * from CTE where row_num <=5



--select sum(case when OCRContainerNo = '00000000000' then 1 else 0 end) as ContCount,DeviceID from CTE where row_num <=5 group by DeviceID



SELECT cast(ISNULL(ContCount,0) as decimal(18,2)) as Speed, 

dbo.ConvertDDHHMMSS(isnull(LastUnlockTime,getdate()),getdate()) as TAT , ES.KalmarNo,   

(CASE WHEN ES.[Location] LIKE '%WORKSHOP%' THEN 'WORKSHOP' ELSE ES.[Location] END) as  RFIDDATA,

dateadd(minute,330, DateTime) as Date_Time,Latitude,Longitude,    

CASE when ES.[Location] LIKE '%WORKSHOP%'  THEN 'In Active' 

when ContCount=5 then 'Working'

when datediff(MINUTE,dateadd(minute,330, DateTime),GETDATE())<=10  THEN 'Working'  

when  PacketID in (8) and datediff(MINUTE,dateadd(minute,330, DateTime),GETDATE())<=15 then 'Idle'

else 'In Active'    

END as STATUS,ISNULL(eq.JobAllow,0) as JobAllow from ESS_MST_EQUIPMENT eq

LEFT JOIN [dbo].[EKL_TRN_EQUIPMENT_STATUS]  ES   ON eq.Equipment_Name = ES.KalmarNo 

left join (select isnull(sum(case when OCRContainerNo = '00000000000' then 1 else 0 end),0) as ContCount,DeviceID from CTE where row_num <=5 group by DeviceID) c on c.DeviceID=Eq.DeviceID

where IsDelete=0 and KalmarNo is not null

order by ES.Location asc 

    

 end

-- dbo.GET_DAILY_EQUIPMENT_BREAKDOWN_TIME
GO
CREATE PROCEDURE [dbo].[GET_DAILY_EQUIPMENT_BREAKDOWN_TIME]  

@FromDate datetime,

@ToDate datetime,

@EquipmentNo nvarchar(max)

as  

BEGIN  

IF(@FromDate IS NULL OR @FromDate='' AND @EquipmentNo !='')

BEGIN

select e.Equipment_Name as EqpName,e.DeviceID ,MaintanceStart,MaintanceEnd,  

([dbo].[ConvertDDHHMMSS](MaintanceStart,ISNULL(MaintanceEnd,GETDATE()))) as TAT

from ESS_MST_BREAKDOWN b  

join ESS_MST_EQUIPMENT e on e.EqpID=b.VehicleID  

where b.IsDelete=0 and e.Equipment_Name=@EquipmentNo

END

ELSE IF(@FromDate != '' AND @EquipmentNo != '')

BEGIN

select e.Equipment_Name as EqpName,e.DeviceID ,MaintanceStart,MaintanceEnd,  

([dbo].[ConvertDDHHMMSS](MaintanceStart,ISNULL(MaintanceEnd,GETDATE()))) as TAT

from ESS_MST_BREAKDOWN b  

join ESS_MST_EQUIPMENT e on e.EqpID=b.VehicleID  

where b.IsDelete=0 and CAST(b.MaintanceStart as date) between  @fromdate and @todate and e.Equipment_Name=@EquipmentNo

END

ELSE

BEGIN

select e.Equipment_Name as EqpName,e.DeviceID ,MaintanceStart,MaintanceEnd,  

([dbo].[ConvertDDHHMMSS](MaintanceStart,ISNULL(MaintanceEnd,GETDATE()))) as TAT

from ESS_MST_BREAKDOWN b  

join ESS_MST_EQUIPMENT e on e.EqpID=b.VehicleID  

where b.IsDelete=0 and CAST(b.MaintanceStart as date) between  @fromdate and @todate 

END



END

-- dbo.GET_DAILY_EQUIPMENT_IDLE_TIME
GO
CREATE PROCEDURE [dbo].[GET_DAILY_EQUIPMENT_IDLE_TIME]

@FromDate datetime,

@ToDate datetime,

@EquipmentNo nvarchar(max)

as 

BEGIN

IF(@FromDate IS NULL OR @FromDate='' AND @EquipmentNo != '')

BEGIN

select DeviceIMEI,EquipmentNo,StartTime,ISNULL(EndTime,getdate()) as EndTime,RIGHT('0' + CAST(TimeDifference / 3600 AS VARCHAR),2) + ':' +

RIGHT('0' + CAST((TimeDifference / 60) % 60 AS VARCHAR),2) + ':' +

RIGHT('0' + CAST(TimeDifference % 60 AS VARCHAR),2) as IdleTime

 from EKY_TRN_UTILIZATION_DETAIL

 where State='IDLE' and EquipmentNo=@EquipmentNo 

END

ELSE IF(@FromDate != '' and @EquipmentNo != '')

BEGIN

select DeviceIMEI,EquipmentNo,StartTime,ISNULL(EndTime,getdate()) as EndTime,RIGHT('0' + CAST(TimeDifference / 3600 AS VARCHAR),2) + ':' +

RIGHT('0' + CAST((TimeDifference / 60) % 60 AS VARCHAR),2) + ':' +

RIGHT('0' + CAST(TimeDifference % 60 AS VARCHAR),2) as IdleTime

 from EKY_TRN_UTILIZATION_DETAIL

 where State='IDLE' and cast(StartTime as Date) between cast(@FromDate as date) and cast(@ToDate as Date) and EquipmentNo=@EquipmentNo

 

END

ELSE

BEGIN

select DeviceIMEI,EquipmentNo,StartTime,ISNULL(EndTime,getdate()) as EndTime,RIGHT('0' + CAST(TimeDifference / 3600 AS VARCHAR),2) + ':' +

RIGHT('0' + CAST((TimeDifference / 60) % 60 AS VARCHAR),2) + ':' +

RIGHT('0' + CAST(TimeDifference % 60 AS VARCHAR),2) as IdleTime

 from EKY_TRN_UTILIZATION_DETAIL

 where State='IDLE' and cast(StartTime as Date) between cast(@FromDate as date) and cast(@ToDate as Date)

END

END

-- dbo.GET_DASHBOARD_CONTAINERAGEING
GO
CREATE PROCEDURE [dbo].[GET_DASHBOARD_CONTAINERAGEING]  

@PlantID bigint

AS  

BEGIN  

  

  

   select Process,Aging,Size20,Size40 from (SELECT   UPPER(LEFT(Process,1))+LOWER(SUBSTRING(Process,2,LEN(Process))) as Process, 

   isnull(sum(case when datediff(day,I.GateInDate,getdate()) between 0 and 5 and ContainerSize in('20','20HQ') then 1 else 0 end),0) as 'Size20',

   isnull(sum(case when datediff(day,I.GateInDate,getdate()) between 0 and 5 and ContainerSize in('40','40HQ') then 1 else 0 end),0) as 'Size40',

   'DAY 0-5'as Aging

   FROM EKL_TRN_INVENTORY I  

   where  I.GateOutDate is null and isnull(I.ReleaseStatus,'R') in ('R') and UPPER(I.Process) in ('EMPTY','DOMESTIC','EXPORT','IMPORT')

   GROUP BY I.Process

   union

   SELECT   UPPER(LEFT(Process,1))+LOWER(SUBSTRING(Process,2,LEN(Process))) as Process, 

   isnull(sum(case when datediff(day,I.GateInDate,getdate()) between 6 and 10 and ContainerSize in('20','20HQ') then 1 else 0 end),0) as 'Size20',

   isnull(sum(case when datediff(day,I.GateInDate,getdate()) between 6 and 10 and ContainerSize in('40','40HQ') then 1 else 0 end),0) as 'Size40',

   'DAY 06-10' as Aging

   FROM EKL_TRN_INVENTORY I  

   where  I.GateOutDate is null and isnull(I.ReleaseStatus,'R') in ('R') and UPPER(I.Process) in ('EMPTY','DOMESTIC','EXPORT','IMPORT')

   GROUP BY I.Process

   union

   SELECT   UPPER(LEFT(Process,1))+LOWER(SUBSTRING(Process,2,LEN(Process))) as Process, 

   isnull(sum(case when datediff(day,I.GateInDate,getdate()) between 11 and 20 and ContainerSize in('20','20HQ') then 1 else 0 end),0) as 'Size20',

   isnull(sum(case when datediff(day,I.GateInDate,getdate()) between 11 and 20 and ContainerSize in('40','40HQ') then 1 else 0 end),0) as 'Size40',

   'DAY 11-20' as Aging

   FROM EKL_TRN_INVENTORY I  

   where  I.GateOutDate is null and isnull(I.ReleaseStatus,'R') in ('R') and UPPER(I.Process) in ('EMPTY','DOMESTIC','EXPORT','IMPORT')

   GROUP BY I.Process

   union

   SELECT  UPPER(LEFT(Process,1))+LOWER(SUBSTRING(Process,2,LEN(Process))) as Process, 

   isnull(sum(case when datediff(day,I.GateInDate,getdate()) between 21 and 30 and ContainerSize in('20','20HQ') then 1 else 0 end),0) as 'Size20',

   isnull(sum(case when datediff(day,I.GateInDate,getdate()) between 21 and 30 and ContainerSize in('40','40HQ') then 1 else 0 end),0) as 'Size40',

   'DAY 21-30' as Aging

   FROM EKL_TRN_INVENTORY I  

   where  I.GateOutDate is null and isnull(I.ReleaseStatus,'R') in ('R') and UPPER(I.Process) in ('EMPTY','DOMESTIC','EXPORT','IMPORT')

   GROUP BY I.Process

   union

   SELECT   UPPER(LEFT(Process,1))+LOWER(SUBSTRING(Process,2,LEN(Process))) as Process, 

   isnull(sum(case when datediff(day,I.GateInDate,getdate()) > 30 and ContainerSize in('20','20HQ') then 1 else 0 end),0) as 'Size20',

   isnull(sum(case when datediff(day,I.GateInDate,getdate()) > 30 and ContainerSize in('40','40HQ') then 1 else 0 end),0) as 'Size40',

   'DAY ABOVE 30' as Aging

   FROM EKL_TRN_INVENTORY I  

   where  I.GateOutDate is null and isnull(I.ReleaseStatus,'R') in ('R') and UPPER(I.Process) in ('EMPTY','DOMESTIC','EXPORT','IMPORT')

   GROUP BY I.Process) a order by '01'+aging asc,3 desc,4 desc



   --AND YEAR(I.GateInDate)=YEAR(GETDATE())

END

-- dbo.GET_DASHBOARD_DATA_COUNT
GO
CREATE PROC [dbo].[GET_DASHBOARD_DATA_COUNT]

@PlantID bigint

as 

begin

SELECT yard_bal_20,yard_bal_40,yard_bal_45,yard_bal_teus,yard_mty_20,yard_mty_40,yard_mty_45,yard_mty_teus,equpment_act,equpment_inact,TrailerAct,TrailerImport,TrailerExport,TrailerCount,TrailerEmpty,ShiftName,TotalSlot,ReservedSlot,EmptySlot,EmtpyContainer,ImportContainer,ExportContainer,ContainerCount FROM EKL_DASHBOARD_DATA_COUNT

end

-- dbo.GET_DASHBOARD_EQUIPMENT_UTILIZATION
GO
CREATE PROCEDURE [dbo].[GET_DASHBOARD_EQUIPMENT_UTILIZATION]

 @PlantID bigint 

as

begin



	SELECT E.Equipment_Name EquipmentNo,0.00 AS IdleTimeHours,0.00 AS WorkTimeHours,0.00 AS PercentageUtilization,COUNT(*) as ContainerCount 

	FROM  ESS_MST_EQUIPMENT E

	LEFT JOIN EKL_TRN_EQUIPMENT_TRANSACTION ET ON ET.DeviceID=E.DeviceID

	where CAST(TransDate as date) = CAST(GETDATE()-80 as DATE) and ET.PacketType IN('UK')

	group by  E.Equipment_Name order by EquipmentNo asc



	--OLD QUERY

	--SELECT EquipmentNo,

 --   IdleTime / 60.0 AS IdleTimeHours,

 --   WorkTime / 60.0 AS WorkTimeHours,

	--cast(((round((cast(sum(WorkTime) as float)/60),0))/iif(datepart(HOUR,getdate())>=18,18,datepart(HOUR,getdate()))*100) as decimal(10,2))

	--AS PercentageUtilization,ISNULL(SUM(ContainerCount),0) as ContainerCount FROM  EKY_TRN_DAILY_UTILIZATION where CAST(TransactionDate as date) = CAST(GETDATE()-1 as DATE)

	--group by  IdleTime, WorkTime ,EquipmentNo order by EquipmentNo asc



END

-- dbo.GET_DASHBOARD_EQUIPMENT_UTILIZATION_COUNT
GO
CREATE PROC [dbo].[GET_DASHBOARD_EQUIPMENT_UTILIZATION_COUNT]

@PlantID bigint

as 

begin

declare @Days int,@TotalRuningHr int;

declare @FromDate datetime =GETDATE()-1;

declare @ToDate datetime=GETDATE()

set @Days = DATEDIFF(day,@FromDate,@ToDate)+1    

set @TotalRuningHr=18*@Days    

    

select DeviceIMEI,EquipmentNo,[dbo].[ConvertDDHHMM](isnull(sum(g.BreakdownTime),0)*60) as BreakdownTime,[dbo].[ConvertDDHHMM](((sum(isnull(IdleTime,0)))*60)-(isnull(sum(g.BreakdownTime),0)*60)) as IdleTime,    

[dbo].[ConvertDDHHMM](sum(WorkTime)*60) as WorkTime,sum(ContainerCount) as TotalMoves,    

(case when cast(round((cast(sum(WorkTime) as float)/60),0) as int)=0 then 1 else cast(round((cast(sum(WorkTime) as float)/60),0) as int) end) as WorkingHours,    

(sum(ContainerCount)/(case when cast(round((cast(sum(WorkTime) as float)/60),0) as int)=0 then 1 else cast(round((cast(sum(WorkTime) as float)/60),0) as int) end)) AS HourlyMoves,    

@TotalRuningHr as ExpectedWorkingHours,cast(((case when cast(round((cast(sum(WorkTime) as float)/60),0) as int)=0 then 1.0 else round((cast(sum(WorkTime) as float)/60),0)  end)/@TotalRuningHr)*100 as decimal(10,2)) as PercentageUtilization    

from EKY_TRN_DAILY_UTILIZATION U    

left join (select cast(MaintanceStart as date) as BreakdownDate,     

sum(DATEDIFF(Minute,MaintanceStart,isnull(MaintanceEnd,MaintanceStart+0.5/24))) as BreakdownTime,e.DeviceId,e.Equipment_Name as Eqp_No    

from ESS_MST_BREAKDOWN g left join     

ESS_MST_EQUIPMENT e on e.EqpID=g.VehicleId     

where MaintanceStart >@FromDate    

group by cast(MaintanceStart as date),e.DeviceID,e.Equipment_Name) g ON   

 CAST(U.TransactionDate as date)=CAST(g.BreakdownDate as date)     

 where  

 TransactionDate between @FromDate and @ToDate    

 group by DeviceIMEI,EquipmentNo    

order by EquipmentNo asc 

end

-- dbo.GET_DASHBOARD_EXIMSLOT_PROCESSWISE
GO
CREATE PROC [dbo].[GET_DASHBOARD_EXIMSLOT_PROCESSWISE]  

@PlantID bigint  

as   

begin  

  

  

select

SUM(CASE WHEN UPPER(Process) ='IMPORT' AND ContainerSize like '40%' then 2 when UPPER(Process) ='IMPORT' and ContainerSize like '20%' THEN 1 ELSE 0 END) AS [IMPORT],

SUM(CASE WHEN UPPER(Process) ='EXPORT' AND ContainerSize Like '40%' THEN 2 WHEN UPPER(Process) ='EXPORT' AND ContainerSize Like '20%'  then 1 else 0 END) AS [EXPORT],

0 AS [DOMESTIC],

SUM(CASE WHEN UPPER(ContainerStatus) ='EMPTY' AND ContainerSize Like '40%' THEN 2 WHEN UPPER(ContainerStatus) ='EMPTY' AND ContainerSize Like '20%' THEN 1 ELSE 0 END) AS [EMPTY],

SUM(CASE WHEN UPPER(ContainerStatus) ='LADEN'  AND ContainerSize Like '40%' THEN 2 WHEN UPPER(ContainerStatus) ='LADEN'  AND ContainerSize Like '20%' THEN 1 ELSE 0 END) AS [LADEN],

0 AS [TEUS]

 FROM EKL_TRN_INVENTORY I LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=I.LastLocID 

 WHERE GateOutDate IS NULL and ReleaseStatus='R' and Process not in  ('DOMESTIC','EMPTY') and  LastLocID <> '7943';

  

end

-- dbo.GET_DASHBOARD_GATEIN_LAST_3_MONTH
GO
CREATE PROCEDURE [dbo].[GET_DASHBOARD_GATEIN_LAST_3_MONTH] 

@PlantID bigint

AS    

BEGIN    

   

--declare @date as date=dateadd(MM,0,getdate())    

--set @date=DATEADD(dd, -( DAY( @date ) -1 ), @date)    

-- select     

--format(GateInDate,'MMM-yyyy') c_date,    

--count(case when ContNo is not null then 1 ELSE 0 End) as GateIN,    

--sum(case when GateOutDate is null then 0 else 1 end) as GateOut    

--from EKL_TRN_INVENTORY    

--where  cast (GateInDate as date) >= @date    

--group by format(GateInDate,'MMM-yyyy') ORDER BY c_date desc;   



declare @date as date=dateadd(MM,-12,getdate())    

set @date=DATEADD(dd, -( DAY( @date ) -1 ), @date)    

    

 select UPPER(Process) as Process,format(GateInDate,'MMM-yyyy') c_date,

SUM(CASE WHEN GateOutDate is null and ContainerSize in('20','20HQ') THEN 1 ELSE 0 END) as [GateIn20],

SUM(CASE WHEN GateOutDate is null and ContainerSize in('40','40HQ') THEN 1 ELSE 0 END) as [GateIn40],

SUM(CASE WHEN GateOutDate is not null and ContainerSize in('20','20HQ') THEN 1 ELSE 0 END) as [GateOut20],

SUM(CASE WHEN GateOutDate is not null and ContainerSize in('40','40HQ') THEN 1 ELSE 0 END) as [GateOut40],

count(case when GateOutDate is null then 1 ELSE 0 End) as GateIN,    

sum(case when GateOutDate is not null then 1 else 0 end) as GateOut,

SUM(CASE WHEN GateOutDate is null and ContainerSize IN('20','20HQ') THEN 1 WHEN GateOutDate is null and ContainerSize IN('40','40HQ')THEN 2 END) as GateInTeus,

SUM(CASE WHEN GateOutDate is not null and ContainerSize IN('20','20HQ') THEN 1 WHEN GateOutDate is not null and ContainerSize IN('40','40HQ') THEN  2 END) as GateOutTeus

from EKL_TRN_INVENTORY  where  cast (GateInDate as date) >= @date  and ISNULL(ReleaseStatus,'R') ='R'

and UPPER(Process) in ('IMPORT','EXPORT','EMPTY','DOMESTIC') 

group by Process,format(GateInDate,'MMM-yyyy') ORDER BY cast('01-'+format(GateInDate,'MMM-yyyy') as date) asc;

    

END

-- dbo.GET_DASHBOARD_IMP_EXP_COUNT
GO
CREATE PROCEDURE [dbo].[GET_DASHBOARD_IMP_EXP_COUNT]

 @PlantID bigint  

AS   

BEGIN         

   select EQ.Equipment_Name as EqpName,

   ISNULL(SUM(case when UPPER(I.ContainerStatus) like '%EMPTY%' OR UPPER(L.ContainerLocationName)  like '%IMP%' OR UPPER(L.ContainerLocationName)  like '%EXP%' OR UPPER(I.ContainerSize)in('20','20HQ') OR UPPER(I.ContainerSize) in('40','40HQ') then 1 else 0 end ),0)  as LIFTDETAIL ,

   ISNULL(SUM(case when UPPER(I.ContainerSize)in('20','20HQ') then 1 else 0 end ),0)  as Size20 ,

   ISNULL(SUM(case when UPPER(I.ContainerSize) in('40','40HQ') then 1 else 0 end ),0)  as Size40 ,

   ISNULL(SUM(case when UPPER(I.ContainerStatus)  like '%EMPTY%' then 1 else 0 end ),0)  as EMT ,

   ISNULL(SUM(case when ISNULL(UPPER(L.ContainerLocationName),0) LIKE '%IMP%' then 1 else 0 end ),0) as [IMPORT],          

  ISNULL(SUM(case when ISNULL(UPPER(L.ContainerLocationName),0)  like '%EXP%' then 1 else 0 end ),0)  as [EXPORT],

  0 as LOADED,0 as [EMPTY] ,0 as [RAIL]  from EKL_TRN_INVENTORY I

  LEFT JOIN ESS_MST_EQUIPMENT EQ ON EQ.DeviceID=I.EquipmentID

  LEFT JOIN ESS_MST_LOCATION L ON I.LastLocID=L.LocationID

  WHERE EQ.Equipment_Name IS NOT NULL AND I.GateOutDate IS NULL

     group by EQ.Equipment_Name   

         

END

-- dbo.GET_DASHBOARD_SHIPLINE
GO
CREATE PROCEDURE [dbo].[GET_DASHBOARD_SHIPLINE]  

@PlantID bigint

AS  

BEGIN  





--select  ISNULL(I.ShippingLine,'OTHERS') as Line_NO,  

--sum(CASE WHEN ContainerSize IN ('20','20HQ') and UPPER(ContainerStatus)='EMPTY' AND UPPER(Process)='EMPTY' THEN 1 else 0 END) as Empty20, 

--sum(CASE WHEN ContainerSize IN ('20','20HQ') and UPPER(ContainerStatus)='LADEN'  THEN 1 else 0 END) as Laden20,

--sum(CASE WHEN ContainerSize IN ('40','40HQ') and UPPER(ContainerStatus)='EMPTY' AND UPPER(Process)='EMPTY' THEN 1 else 0 END) as Empty40, 

--sum(CASE WHEN ContainerSize IN ('40','40HQ') and UPPER(ContainerStatus)='LADEN' THEN 1 else 0 END) as Laden40,

--sum(CASE WHEN ContainerSize='20' THEN 1 else 0 END) as Size20,  

--sum(case when ContainerSize IN('40','40HQ') THEN 1 else 0 END  ) as Size40,  

--sum(case when ContainerSize IN('45') THEN 1 else 0 END) as Size45,  

--sum(CASE WHEN ContainerSize IN('20') THEN 1 else 2 END) as SizeTeus  

--from EKL_TRN_INVENTORY I   where I.GateOutDate is null  and CAST(GateInDate AS DATE)=CAST(GETDATE()-45 AS DATE) and ISNULL(ReleaseStatus,'R') ='R'

--and ShippingLine <>''

----and I.ShippingLine='EVERGREEN MARINE CORP (TAIWAN) LTD'

--group by I.ShippingLine  

  

WITH ShippingLineData AS ( SELECT

        ISNULL(I.ShippingLine, 'OTHERS') AS Line_NO,  

		sum(CASE WHEN ContainerSize IN ('20','20HQ') and UPPER(ContainerStatus)='EMPTY' AND UPPER(Process)='EMPTY' THEN 1 else 0 END) as Empty20, 

		sum(CASE WHEN ContainerSize IN ('20','20HQ') and UPPER(ContainerStatus)='LADEN'  THEN 1 else 0 END) as Laden20,

		sum(CASE WHEN ContainerSize IN ('40','40HQ') and UPPER(ContainerStatus)='EMPTY' AND UPPER(Process)='EMPTY' THEN 1 else 0 END) as Empty40, 

		sum(CASE WHEN ContainerSize IN ('40','40HQ') and UPPER(ContainerStatus)='LADEN' THEN 1 else 0 END) as Laden40,

        SUM(CASE WHEN ContainerSize IN('20') THEN 1 ELSE 0 END) AS Size20,  

        SUM(CASE WHEN ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS Size40,  

        SUM(CASE WHEN ContainerSize IN('45') THEN 1 ELSE 0 END) AS Size45,  

        SUM(CASE WHEN ContainerSize IN('20','20HQ') THEN 1 ELSE 2 END) AS SizeTeus

    FROM EKL_TRN_INVENTORY I  

    WHERE I.GateOutDate IS NULL  

      AND ISNULL(ReleaseStatus, 'R') = 'R'

      AND ShippingLine <> ''

    GROUP BY I.ShippingLine

)

SELECT

    CASE WHEN SizeTeus < 15 THEN 'OTHERS' ELSE Line_NO END AS Line_NO,

	SUM(Empty20) AS Empty20,

	SUM(Laden20) AS Laden20,

	SUM(Empty40) AS Empty40,

	SUM(Laden40) AS Laden40,

    SUM(Size20) AS Size20,

    SUM(Size40) AS Size40,

    SUM(Size45) AS Size45,

    SUM(SizeTeus) AS SizeTeus

FROM ShippingLineData

GROUP BY

    CASE WHEN SizeTeus < 15 THEN 'OTHERS' ELSE Line_NO END

END

-- dbo.GET_DASHBOARD_SLOT_DATA
GO
CREATE PROC [dbo].[GET_DASHBOARD_SLOT_DATA]

@PlantID bigint

as 

begin

select  21 as TotalSlot , 10 as OccupiedSlot,10 as ReservedSlot

end

-- dbo.GET_DASHBOARD_TRAILER_COUNT_DETAIL
GO
CREATE PROCEDURE [dbo].[GET_DASHBOARD_TRAILER_COUNT_DETAIL] 

 @PlantID bigint

 as Begin    

      

 select 

ISNULL(SUM(case when UPPER(Process)  like '%EMPTY%'  then 1 else 0 end ),0) as [EMPTY],    

ISNULL(SUM(case when UPPER(Process)  like '%IMPORT%' then 1 else 0 end ),0) as [IMPORT],    

ISNULL(SUM(case when UPPER(Process)  like '%EXPORT%' then 1 else 0 end ),0) as [EXPORT],

ISNULL(SUM(case when UPPER(Process)  like '%DOMESTIC%' then 1 else 0 end ),0) as [DOMESTIC], 

ISNULL(SUM(case when UPPER(Process)  like '%EMPTY%'  and datediff(MINUTE,GateInDate,Getdate()) > 120 then 1 else 0 end ),0) as [EMPTYMORE2HR],

ISNULL(SUM(case when UPPER(Process)  like '%IMPORT%'   and datediff(MINUTE,GateInDate,Getdate()) > 120 then 1 else 0 end ),0) as [IMPORTMORE2HR],

ISNULL(SUM(case when UPPER(Process)  like '%EXPORT%'   and datediff(MINUTE,GateInDate,Getdate()) > 120 then 1 else 0 end ),0) as [EXPORTMORE2HR],

ISNULL(SUM(case when UPPER(Process)  like '%DOMESTIC%' and datediff(MINUTE,GateInDate,Getdate()) > 120 then 1 else 0 end ),0) as [DOMESTICMORE2HR],

count(*) as TOTAL

FROM( SELECT DISTINCT TI.TrailerNo,TI.TrailerID,TI.GateInDate,TI.GateOutDate,UPPER(ISNULL(I.Process,'EMPTY')) as Process

from EKL_TRN_TRAILER TI LEFT JOIN EKL_TRN_INVENTORY I ON I.TrailerID=TI.TrailerID 

WHERE CAST(TI.GateInDate AS DATE)=cast(getdate()-50 as date) and TI.GateOutDate IS NULL and TI.TrailerNo!='' 

and (I.Process like '%EMPTY%' OR I.Process like '%IMPORT%'OR I.Process like '%DOMESTIC%' OR I.Process like '%EXPORT%' OR I.Process IS NULL) 

) AS tb  

   

 

end

-- dbo.GET_DASHBOARD_YARDINVENTORY
GO
CREATE PROC [dbo].[GET_DASHBOARD_YARDINVENTORY]  

@PlantID bigint  

as   

begin  



SELECT (case 

when blockName in ('IMPORT','EXP','IMP-WH03','IMP-EXAM','WH','WORKSHOP') 

then 'CY-YARD' 

when blockName in ('WH0102') then 'OLDGDL' 

when blockName in ('NRY','BUFFER') then 'NRY'

when blockName in ('RAKE') then 'ON RAKE' 

-- remove Process not in ('EMPTY','DOMESTIC') also add Process <> 'DOMESTIC' in where condition

when BlockName is null then 'CY-YARD' else 'CY-YARD' end) as YARDNAME,

sum(CASE WHEN I.ContNo is not null  and I.ContainerSize IN('20','20HQ') THEN 1 ELSE 0 END) AS [SIZE20],

sum(CASE WHEN I.ContNo is not null and I.ContainerSize IN('40','40HQ') THEN 1 ELSE 0 END) AS [SIZE40],

(sum(CASE WHEN I.ContNo is not null  and I.ContainerSize IN('20','20HQ') THEN 1 ELSE 0 END) +

sum(CASE WHEN I.ContNo is not null and I.ContainerSize IN('40','40HQ') THEN 1 ELSE 0 END) 

) AS [COUNT],

sum(CASE WHEN I.ContNo is not null and I.ContainerSize IN('20','20HQ') THEN 1 

WHEN I.ContainerSize IN('40','40HQ') THEN 2 END) AS [TEUS],

((case 

when blockName in ('IMPORT','EXP','IMP-WH03','WH','WORKSHOP') 

then 4160

when blockName in ('WH0102') then 1240

when blockName in ('NRY','BUFFER') then 1204

when blockName in ('RAKE') then 0

when BlockName is null then 4160 else 4160 end)) AS [YARD_CAPACITY],

((case 

when blockName in ('IMPORT','EXP','IMP-WH03','WH','WORKSHOP') 

then 1040

when blockName in ('WH0102') then 0

when blockName in ('NRY','BUFFER') then 0

when blockName in ('RAKE') then 0

when BlockName is null then 1040 else 1040 end)) as [SLOT],

0.00 AS [UTILIZATION]

--(((sum(CASE WHEN I.ContNo is not null and I.ContainerSize IN('20','20HQ') THEN 1 WHEN I.ContainerSize IN('40','40HQ') THEN 2  ELSE 0 END))*1.0)/(sum((case when blockName in ('IMPORT','EXPORT','EXP-WH03','IMP-WH03','IMP-EXAM','WH') then 1 else 0 end)))) AS [UTILIZATION]

from  EKL_TRN_INVENTORY  I left join  ESS_MST_LOCATION L

 ON L.LocationID=I.LastLocID 

where GateOutDate IS NULL and isnull(ReleaseStatus,'R') in ('R') 

and Process <> 'EMPTY' and Process <> 'DOMESTIC'

group by (case 

when blockName in ('IMPORT','EXP','IMP-WH03','IMP-EXAM','WH','WORKSHOP') 

then 'CY-YARD' 

when blockName in ('WH0102') then 'OLDGDL' 

when blockName in ('NRY','BUFFER') then 'NRY'

when blockName in ('RAKE') then 'ON RAKE' 

when BlockName is null then 'CY-YARD' else 'CY-YARD' end),

((case 

when blockName in ('IMPORT','EXP','IMP-WH03','WH','WORKSHOP') 

then 4160

when blockName in ('WH0102') then 1240

when blockName in ('NRY','BUFFER') then 1204

when blockName in ('RAKE') then 0 

when BlockName is null then 4160 else 4160 end)),

((case 

when blockName in ('IMPORT','EXP','IMP-WH03','WH','WORKSHOP') 

then 1040

when blockName in ('WH0102') then 0

when blockName in ('NRY','BUFFER') then 0

when blockName in ('RAKE') then 0

when BlockName is null then 1040 else 1040 end))

UNION

SELECT UPPER(Process) as YARDNAME,

SUM(CASE WHEN ContainerSize IN('20','20HQ')  THEN 1 ELSE 0 END) AS [SIZE20],

SUM(CASE WHEN ContainerSize IN('40','40HQ')  THEN 1 ELSE 0 END) AS [SIZE40],

COUNT(*) AS [COUNT],

SUM(CASE WHEN ContainerSize IN('20','20HQ') THEN 1 WHEN ContainerSize IN('40','40HQ') THEN 2 ELSE 0 END) AS [TEUS],

0 as [YARD_CAPACITY],

0 AS [SLOT],0.00 AS [UTILIZATION]

from EKL_TRN_INVENTORY WHERE  GateOutDate IS NULL and isnull(ReleaseStatus,'R') in ('R') 

and UPPER(Process) in ('DOMESTIC','EMPTY')

group by Process

end

-- dbo.GET_DEVICE_LOCK_REPORT
GO
CREATE PROCEDURE [dbo].[GET_DEVICE_LOCK_REPORT]

@Type VARCHAR(50),

@EqpNo NVARCHAR(MAX),

@fromdate DATETIME,

@todate DATETIME,

@PlantID BIGINT,

@ddlLocation VARCHAR(50)

AS 

BEGIN



    IF @Type = 'Missing '

    BEGIN

	IF UPPER(@ddlLocation) in('IMPORT','EXPORT')

	BEGIN

	select TRANSACTION_ID as EqpTransID,TRANSACTION_DATE as TransDate,(CASE WHEN I.CONTAINER_TYPE_ID=1 THEN EL.ContainerLocationName1 else EL.ContainerLocationName end )as Location,cast(GPS_LATITUDE as decimal(18,6)) as GpsLocLat,cast(GPS_LONGITUDE as decimal(18,6)) as GpsLocLon,

	OCR_CONTAINER_NO+' ('+ISNULL(UPDATED_STATUS,'EQ')+')' as ContNo,Equipment_Name as EqpName,ET.DEVICE_ID as DeviceID,ET.INVENTORY_ID as ContainerMasterId,'' as UserName,

	--(CASE WHEN ET.INVENTORY_ID IS NUll THEN EE.VTM_ImeiNo+'/IMAGE/Camera1_'+EE.VTM_ImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TRANSACTION_DATE) < 4 then DATEADD(minute,-1,et.TRANSACTION_DATE) else et.TRANSACTION_DATE end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage1,

	--(CASE WHEN ET.INVENTORY_ID IS NUll THEN EE.VTM_ImeiNo+'/IMAGE/Camera2_'+EE.VTM_ImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TRANSACTION_DATE) < 4 then DATEADD(minute,-1,et.TRANSACTION_DATE) else et.TRANSACTION_DATE end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage2,

	--(CASE WHEN ET.INVENTORY_ID IS NUll THEN EE.VTM_ImeiNo+'/IMAGE/Camera3_'+EE.VTM_ImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TRANSACTION_DATE) < 4 then DATEADD(minute,-1,et.TRANSACTION_DATE) else et.TRANSACTION_DATE end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage3

	 ET.DEVICE_ID+'_'+FORMAT( ET.TRANSACTION_DATE , 'ddMMyyyyHHmmss')+'_cam1_1.jpg' as CameraImage1,  

	ET.DEVICE_ID+'_'+FORMAT( ET.TRANSACTION_DATE , 'ddMMyyyyHHmmss')+'_cam2_1.jpg' as CameraImage2,  

	ET.DEVICE_ID+'_'+FORMAT( ET.TRANSACTION_DATE , 'ddMMyyyyHHmmss')+'_cam3_1.jpg' as CameraImage3 

	

	

	from TBL_EQUIPMENT_TRANSACTION ET 

	LEFT JOIN TBL_CONTAINER_INVENTORY I ON ET.INVENTORY_ID=I.INVENTORY_ID

	left join ESS_MST_LOCATION EL on EL.LocationId=ET.LOCATION_ID 

	

	--left  join ESS_MST_LOCATION_MAPPING M ON M.LocationId=ET.AreaID or M.AdjucentId=ET.AreaID

	LEFT JOIN TBL_MST_EQUIPMENT EE ON EE.Device_ID=ET.DEVICE_ID 

	where PACKET_TYPE in ('UK') and TRANSACTION_DATE between @fromdate and @todate and ET.DEVICE_ID in(SELECT VALUE FROM DBO.[Split_String](@EqpNo,','))

	and ET.INVENTORY_ID is null and Et.UPDATED_STATUS!='M' and EL.ContainerLocationName like '%'+@ddlLocation+'%'

	--order by ET.TransDate,EE.Equipment_Name asc

	END

	ELSE

	BEGIN

		select TRANSACTION_ID as EqpTransID,TRANSACTION_DATE as TransDate,(CASE WHEN I.CONTAINER_TYPE_ID=1 THEN EL.ContainerLocationName1 else EL.ContainerLocationName end )as Location,cast(GPS_LATITUDE as decimal(18,6)) as GpsLocLat,cast(GPS_LONGITUDE as decimal(18,6)) as GpsLocLon,

	OCR_CONTAINER_NO+' ('+ISNULL(UPDATED_STATUS,'EQ')+')' as ContNo,Equipment_Name as EqpName,ET.DEVICE_ID as DeviceID,ET.INVENTORY_ID as ContainerMasterId,'' as UserName,

	--(CASE WHEN ET.INVENTORY_ID IS NUll THEN EE.VTM_ImeiNo+'/IMAGE/Camera1_'+EE.VTM_ImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TRANSACTION_DATE) < 4 then DATEADD(minute,-1,et.TRANSACTION_DATE) else et.TRANSACTION_DATE end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage1,

	--(CASE WHEN ET.INVENTORY_ID IS NUll THEN EE.VTM_ImeiNo+'/IMAGE/Camera2_'+EE.VTM_ImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TRANSACTION_DATE) < 4 then DATEADD(minute,-1,et.TRANSACTION_DATE) else et.TRANSACTION_DATE end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage2,

	--(CASE WHEN ET.INVENTORY_ID IS NUll THEN EE.VTM_ImeiNo+'/IMAGE/Camera3_'+EE.VTM_ImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TRANSACTION_DATE) < 4 then DATEADD(minute,-1,et.TRANSACTION_DATE) else et.TRANSACTION_DATE end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage3

	ET.DEVICE_ID+'_'+FORMAT( ET.TRANSACTION_DATE , 'ddMMyyyyHHmmss')+'_cam1_1.jpg' as CameraImage1,  

	ET.DEVICE_ID+'_'+FORMAT( ET.TRANSACTION_DATE , 'ddMMyyyyHHmmss')+'_cam2_1.jpg' as CameraImage2,  

	ET.DEVICE_ID+'_'+FORMAT( ET.TRANSACTION_DATE , 'ddMMyyyyHHmmss')+'_cam3_1.jpg' as CameraImage3 

	from TBL_EQUIPMENT_TRANSACTION ET 

	LEFT JOIN TBL_CONTAINER_INVENTORY I ON ET.INVENTORY_ID=I.INVENTORY_ID

	left join ESS_MST_LOCATION EL on EL.LocationId=ET.LOCATION_ID 

	

	--left  join ESS_MST_LOCATION_MAPPING M ON M.LocationId=ET.AreaID or M.AdjucentId=ET.AreaID

	LEFT JOIN TBL_MST_EQUIPMENT EE ON EE.Device_ID=ET.DEVICE_ID 

	where PACKET_TYPE in ('UK') and TRANSACTION_DATE between @fromdate and @todate and ET.DEVICE_ID in(SELECT VALUE FROM DBO.[Split_String](@EqpNo,','))

	and ET.INVENTORY_ID is null and Et.UPDATED_STATUS!='M' --and EL.ContainerLocationName like '%'+@ddlLocation+'%'

	--order by ET.TransDate,EE.Equipment_Name asc

	END

    

    END

    ELSE IF @Type = 'Non Missing'

    BEGIN

 

		select TRANSACTION_ID as EqpTransID,TRANSACTION_DATE as TransDate,(CASE WHEN I.CONTAINER_TYPE_ID=1 THEN EL.ContainerLocationName1 else EL.ContainerLocationName end )as Location,cast(GPS_LATITUDE as decimal(18,6)) as GpsLocLat,cast(GPS_LONGITUDE as decimal(18,6)) as GpsLocLon,

	OCR_CONTAINER_NO+' ('+ISNULL(UPDATED_STATUS,'EQ')+')' as ContNo,Equipment_Name as EqpName,ET.DEVICE_ID as DeviceID,ET.INVENTORY_ID as ContainerMasterId,'' as UserName,

	--(CASE WHEN ET.INVENTORY_ID IS NUll THEN EE.VTM_ImeiNo+'/IMAGE/Camera1_'+EE.VTM_ImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TRANSACTION_DATE) < 4 then DATEADD(minute,-1,et.TRANSACTION_DATE) else et.TRANSACTION_DATE end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage1,

	--(CASE WHEN ET.INVENTORY_ID IS NUll THEN EE.VTM_ImeiNo+'/IMAGE/Camera2_'+EE.VTM_ImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TRANSACTION_DATE) < 4 then DATEADD(minute,-1,et.TRANSACTION_DATE) else et.TRANSACTION_DATE end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage2,

	--(CASE WHEN ET.INVENTORY_ID IS NUll THEN EE.VTM_ImeiNo+'/IMAGE/Camera3_'+EE.VTM_ImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TRANSACTION_DATE) < 4 then DATEADD(minute,-1,et.TRANSACTION_DATE) else et.TRANSACTION_DATE end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage3

	ET.DEVICE_ID+'_'+FORMAT( ET.TRANSACTION_DATE , 'ddMMyyyyHHmmss')+'_cam1_1.jpg' as CameraImage1,  

	ET.DEVICE_ID+'_'+FORMAT( ET.TRANSACTION_DATE , 'ddMMyyyyHHmmss')+'_cam2_1.jpg' as CameraImage2,  

	ET.DEVICE_ID+'_'+FORMAT( ET.TRANSACTION_DATE , 'ddMMyyyyHHmmss')+'_cam3_1.jpg' as CameraImage3 

	from TBL_EQUIPMENT_TRANSACTION ET 

	LEFT JOIN TBL_CONTAINER_INVENTORY I ON ET.INVENTORY_ID=I.INVENTORY_ID

	left join ESS_MST_LOCATION EL on EL.LocationId=ET.LOCATION_ID 

	

	--left  join ESS_MST_LOCATION_MAPPING M ON M.LocationId=ET.AreaID or M.AdjucentId=ET.AreaID

	LEFT JOIN TBL_MST_EQUIPMENT EE ON EE.Device_ID=ET.DEVICE_ID 

	where PACKET_TYPE in ('UK') and TRANSACTION_DATE between @fromdate and @todate and ET.DEVICE_ID in(SELECT VALUE FROM DBO.[Split_String](@EqpNo,','))

	and ET.INVENTORY_ID is not null

	--order by TransDate desc

    END

    ELSE 

    BEGIN

    

    select TRANSACTION_ID as EqpTransID,TRANSACTION_DATE as TransDate,(CASE WHEN I.CONTAINER_TYPE_ID=1 THEN EL.ContainerLocationName1 else EL.ContainerLocationName end )as Location,cast(GPS_LATITUDE as decimal(18,6)) as GpsLocLat,cast(GPS_LONGITUDE as decimal(18,6)) as GpsLocLon,

	OCR_CONTAINER_NO+' ('+ISNULL(UPDATED_STATUS,'EQ')+')' as ContNo,Equipment_Name as EqpName,ET.DEVICE_ID as DeviceID,ET.INVENTORY_ID as ContainerMasterId,'' as UserName,

	--(CASE WHEN ET.INVENTORY_ID IS NUll THEN EE.VTM_ImeiNo+'/IMAGE/Camera1_'+EE.VTM_ImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TRANSACTION_DATE) < 4 then DATEADD(minute,-1,et.TRANSACTION_DATE) else et.TRANSACTION_DATE end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage1,

	--(CASE WHEN ET.INVENTORY_ID IS NUll THEN EE.VTM_ImeiNo+'/IMAGE/Camera2_'+EE.VTM_ImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TRANSACTION_DATE) < 4 then DATEADD(minute,-1,et.TRANSACTION_DATE) else et.TRANSACTION_DATE end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage2,

	--(CASE WHEN ET.INVENTORY_ID IS NUll THEN EE.VTM_ImeiNo+'/IMAGE/Camera3_'+EE.VTM_ImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TRANSACTION_DATE) < 4 then DATEADD(minute,-1,et.TRANSACTION_DATE) else et.TRANSACTION_DATE end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage3

	ET.DEVICE_ID+'_'+FORMAT( ET.TRANSACTION_DATE , 'ddMMyyyyHHmmss')+'_cam1_1.jpg' as CameraImage1,  

	ET.DEVICE_ID+'_'+FORMAT( ET.TRANSACTION_DATE , 'ddMMyyyyHHmmss')+'_cam2_1.jpg' as CameraImage2,  

	ET.DEVICE_ID+'_'+FORMAT( ET.TRANSACTION_DATE , 'ddMMyyyyHHmmss')+'_cam3_1.jpg' as CameraImage3 

	from TBL_EQUIPMENT_TRANSACTION ET 

	LEFT JOIN TBL_CONTAINER_INVENTORY I ON ET.INVENTORY_ID=I.INVENTORY_ID

	left join ESS_MST_LOCATION EL on EL.LocationId=ET.LOCATION_ID 

	

	--left  join ESS_MST_LOCATION_MAPPING M ON M.LocationId=ET.AreaID or M.AdjucentId=ET.AreaID

	LEFT JOIN TBL_MST_EQUIPMENT EE ON EE.Device_ID=ET.DEVICE_ID 

	where PACKET_TYPE in ('UK') and TRANSACTION_DATE between @fromdate and @todate and ET.DEVICE_ID in(SELECT VALUE FROM DBO.[Split_String](@EqpNo,','))

	--order by TransDate desc



	END

END

-- dbo.GET_DEVICE_LOCK_REPORT_RECHECK
GO
CREATE PROCEDURE [dbo].[GET_DEVICE_LOCK_REPORT_RECHECK]

@Type VARCHAR(50),

@EqpNo NVARCHAR(MAX),

@fromdate DATETIME,

@todate DATETIME,

@PlantID BIGINT,

@ddlLocation VARCHAR(50)

AS 

BEGIN



	IF UPPER(@ddlLocation) in('CY')

	BEGIN

	select EqpTransID,TransDate as TransDate,(CASE WHEN I.ContainerSize like '%40%' THEN EL.ContainerLocationName1 else EL.ContainerLocationName end )as Location,cast(GpsLocLat as decimal(18,6)) as GpsLocLat,cast(GpsLocLon as decimal(18,6)) as GpsLocLon,

	OCRContainerNo as ContNo,OperatorContainerNo,Equipment_Name as EqpName,ET.DeviceID as DeviceID,ET.ContMasterID as ContainerMasterId,U.UserName,

	(CASE WHEN ET.ContMasterID=ET.ContMasterID THEN EE.VTMImeiNo+'/IMAGE/Camera1_'+EE.VTMImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TransDate) < 4 then DATEADD(minute,-1,et.TransDate) else et.TransDate end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage1,

	(CASE WHEN ET.ContMasterID=ET.ContMasterID THEN EE.VTMImeiNo+'/IMAGE/Camera2_'+EE.VTMImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TransDate) < 4 then DATEADD(minute,-1,et.TransDate) else et.TransDate end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage2,

	(CASE WHEN ET.ContMasterID=ET.ContMasterID THEN EE.VTMImeiNo+'/IMAGE/Camera3_'+EE.VTMImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TransDate) < 4 then DATEADD(minute,-1,et.TransDate) else et.TransDate end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage3

	from EKL_TRN_EQUIPMENT_TRANSACTION ET 

	LEFT JOIN EKL_TRN_INVENTORY I ON ET.ContMasterID=I.ContMasterID

	left join ESS_MST_LOCATION EL on EL.LocationId=ET.AreaId 

	left join IND_MST_USER U ON U.UserID=ET.ModifiedBy

	LEFT JOIN ESS_MST_EQUIPMENT EE ON EE.DeviceId=ET.DeviceID 

	where PacketType in ('UK') and TransDate between @fromdate and @todate and Equipment_Name in(SELECT VALUE FROM DBO.[Split_String](@EqpNo,',')) --and OperatorContainerNo is not null and OCRContainerNo<> OperatorContainerNo and Et.UpdateStutus='EQ' 

	and (EL.ContainerLocationName like '%IMP%' OR EL.ContainerLocationName like '%EXP%' OR EL.ContainerLocationName like '%WH0102%' OR EL.ContainerLocationName like '%WH04%' OR EL.ContainerLocationName like '%WH05%' OR EL.ContainerLocationName like '%TRI%')

	END

	ELSE

	BEGIN

	select EqpTransID,TransDate as TransDate,(CASE WHEN I.ContainerSize like '%40%' THEN EL.ContainerLocationName1 else EL.ContainerLocationName end ) as Location,cast(GpsLocLat as decimal(18,6)) as GpsLocLat,cast(GpsLocLon as decimal(18,6)) as GpsLocLon,

	OCRContainerNo as ContNo,OperatorContainerNo,Equipment_Name as EqpName,ET.DeviceID as DeviceID,ET.ContMasterID as ContainerMasterId,U.UserName,

	(CASE WHEN ET.ContMasterID=ET.ContMasterID THEN EE.VTMImeiNo+'/IMAGE/Camera1_'+EE.VTMImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TransDate) < 4 then DATEADD(minute,-1,et.TransDate) else et.TransDate end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage1,

	(CASE WHEN ET.ContMasterID=ET.ContMasterID THEN EE.VTMImeiNo+'/IMAGE/Camera2_'+EE.VTMImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TransDate) < 4 then DATEADD(minute,-1,et.TransDate) else et.TransDate end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage2,

	(CASE WHEN ET.ContMasterID=ET.ContMasterID THEN EE.VTMImeiNo+'/IMAGE/Camera3_'+EE.VTMImeiNo+'_'+FORMAT((case when DATEPART(SECOND,ET.TransDate) < 4 then DATEADD(minute,-1,et.TransDate) else et.TransDate end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage3

	from EKL_TRN_EQUIPMENT_TRANSACTION ET 

	LEFT JOIN EKL_TRN_INVENTORY I ON ET.ContMasterID=I.ContMasterID

	left join ESS_MST_LOCATION EL on EL.LocationId=ET.AreaId 

	left join IND_MST_USER U ON U.UserID=ET.ModifiedBy

	LEFT JOIN ESS_MST_EQUIPMENT EE ON EE.DeviceId=ET.DeviceID 

	where PacketType in ('UK') and TransDate between @fromdate and @todate and Equipment_Name in(SELECT VALUE FROM DBO.[Split_String](@EqpNo,',')) 

	and OperatorContainerNo is not null and OCRContainerNo<> OperatorContainerNo and Et.UpdateStutus='EQ' and EL.ContainerLocationName like '%'+@ddlLocation+'%'

	

	END

END

-- dbo.GET_DEVICE_LOCK_REPORT_SUMMARY
GO
CREATE PROCEDURE [dbo].[GET_DEVICE_LOCK_REPORT_SUMMARY]  -- '','','2024-07-01 00:00','2024-07-21 05:01',0

@ContainerNo VARCHAR(50),  

@EqpNo NVARCHAR(MAX),  

@fromdate DATETIME,  

@todate DATETIME,  

@PlantID BIGINT  

AS   

BEGIN  

  

    IF @ContainerNo != ''  

    BEGIN  

    select EqpTransID,TransDate as TransDate,(CASE WHEN I.ContainerSize like '%40%' THEN EL.ContainerLocationName1 else EL.ContainerLocationName end ) as Location,cast(GpsLocLat as decimal(18,6)) as GpsLocLat,cast(GpsLocLon as decimal(18,6)) as GpsLocLon,

  

 OCRContainerNo as ContNo,Equipment_Name as EqpName,ET.DeviceID as DeviceID,ET.ContMasterID as ContainerMasterId,  

 ET.ITVNo as ITVNo,  

 ET.PacketType as PacketType,  

 '' as CameraImage1,  

 '' as CameraImage2,  

 '' as CameraImage3  

 from EKL_TRN_EQUIPMENT_TRANSACTION ET   

 LEFT JOIN EKL_TRN_INVENTORY I ON ET.ContMasterID=I.ContMasterID  

 left join ESS_MST_LOCATION EL on EL.LocationId=ET.AreaId   

 --left  join ESS_MST_LOCATION_MAPPING M ON M.LocationId=ET.AreaID or M.AdjucentId=ET.AreaID  

 LEFT JOIN ESS_MST_EQUIPMENT EE ON EE.DeviceId=ET.DeviceID  

 where PacketType in ('UK') and OCRContainerNo=@ContainerNo  

 order by ET.TransDate desc  

    END  

    ELSE   

    BEGIN  

     select EqpTransID,TransDate as TransDate,(CASE WHEN I.ContainerSize like '%40%' THEN EL.ContainerLocationName1 else EL.ContainerLocationName end ) as Location,cast(GpsLocLat as decimal(18,6)) as GpsLocLat,cast(GpsLocLon as decimal(18,6)) as GpsLocLon

,  

 OCRContainerNo as ContNo,Equipment_Name as EqpName,ET.DeviceID as DeviceID,ET.ContMasterID as ContainerMasterId,  

 ET.ITVNo as ITVNo,  

 ET.PacketType as PacketType,  

 '' as CameraImage1,  

 '' as CameraImage2,  

 '' as CameraImage3  

 from EKL_TRN_EQUIPMENT_TRANSACTION ET   

 LEFT JOIN EKL_TRN_INVENTORY I ON ET.ContMasterID=I.ContMasterID  

 left join ESS_MST_LOCATION EL on EL.LocationId=ET.AreaId   

 --left  join ESS_MST_LOCATION_MAPPING M ON M.LocationId=ET.AreaID or M.AdjucentId=ET.AreaID  

 LEFT JOIN ESS_MST_EQUIPMENT EE ON EE.DeviceId=ET.DeviceID  

 where PacketType in ('UK')  AND TransDate between @fromdate and @todate --and 
--AND TransDate < @todate-- and Equipment_Name in('KC-04,KC-05,KC-07,KC-09,KC-11,KC-12,KC-14,KC-15,KC-16,K-18')    

 order by TransDate desc  

  

 END  

END

-- dbo.GET_DEVICEDETAILS
GO
CREATE PROCEDURE [dbo].[GET_DEVICEDETAILS]     

@KalmarNo varchar(50)    

AS    

BEGIN    

select top 15 [TransDate] as TransDate,cast(GpsLocLat as decimal(18,6)) as GpsLocLat,cast(GpsLocLon  as decimal(18,6)) as GpsLocLon,  

OCRContainerNo as ContNo,(CASE WHEN i.ContainerSize like '%40%' THEN EL.ContainerLocationName1 else EL.ContainerLocationName end) as Location  

from ESS_MST_EQUIPMENT EE LEFT JOIN EKL_TRN_EQUIPMENT_TRANSACTION ET ON EE.DeviceId=ET.DeviceId 

LEFT JOIN EKL_TRN_INVENTORY I ON ET.ContMasterID=I.ContMasterID

left join ESS_MST_LOCATION EL on EL.LocationId=ET.AreaId 

--left  join ESS_MST_LOCATION_MAPPING M ON M.LocationId=ET.AreaID or M.AdjucentId=ET.AreaID

where PacketType in ('UK')  and EE.Equipment_Name = @KalmarNo --and Gate_Out_Date is null    

order by TransDate  desc   

END

-- dbo.GET_DOCUMENT_NO
GO
CREATE PROCEDURE [dbo].[GET_DOCUMENT_NO] 

as    

BEGIN   



select DocumentNo from EKL_PRE_RAIL_IN

--WHERE CAST(NAVDateTime as date)>=CAST(GETDATE()-30 as date)

GROUP BY DOCUMENTNO



END

-- dbo.GET_EKL_TRN_TRAILER_LIST
GO
CREATE PROC [dbo].[GET_EKL_TRN_TRAILER_LIST]        

as         

begin        

 select T.TrailerID,T.TrailerNo,(CASE WHEN T.OutContNo is not null THEN 'PICKUP' when T.InContNo is not null or T.ContainerNo is not null then 'OFFLOAD' else 'EMPTY' END) AS ActivityName,   

 ContainerNo AS InContainerNo,T.OutContNo as OutContainerNo,CI.ContainerSize, CI.ContainerType, UPPER(CI.Process) as Process, CI.ShippingLine, (CASE WHEN ci.ContainerSize like '%40%' THEN L.ContainerLocationName1 else L.ContainerLocationName end) as ContainerLocation,  

 1 as IsSuccess,T.GateInDate,T.GateOutDate,[dbo].ConvertDDHHMMSS(T.GateInDate,isnull(T.GateOutDate,getdate())) as TrailerTAT,

(CASE WHEN T.TrailerNo IS NOT NUll THEN T.TrailerNo +'_'+FORMAT((case when DATEPART(SECOND,T.GateInDate) <= 4 then DATEADD(minute,0,T.GateInDate) else t.GateInDate end) , 'yyyyMMddHHmmss')+'.jpg' ELSE '' END) as Vehicleimg,

(CASE WHEN T.ContainerNo IS NOT NUll THEN T.ContainerNo +'_'+FORMAT((case when DATEPART(SECOND,CI.YardInTime) <= 4 then DATEADD(minute,0,CI.YardInTime) else CI.YardInTime end) , 'yyyyMMddHHmmss')+'.jpg' ELSE '' END) as Containerimg

 from EKL_TRN_TRAILER T      

  LEFT JOIN EKL_TRN_INVENTORY CI ON T.TrailerID=CI.TrailerID  

  LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=CI.LastLocID  

  where T.Isdelete=0  and CAST(t.GateInDate as Date)=Cast(getDate() as date)  and t.TrailerNo!='' and T.GateOutDate IS NULL

  order by GateInDate desc

end

-- dbo.GET_EKY_TRANSACTION_DATA
GO
CREATE PROCEDURE [dbo].[GET_EKY_TRANSACTION_DATA] 

	@ContainerNo nvarchar(50),

	@KalmanrNo	nvarchar(50),

	@TransactionTime datetime

AS

	BEGIN



	Declare @IsSuccess int;

	declare @DeviceID nvarchar(50),@EqpTransID bigint,@ContainerMasterId bigint;

	SET @IsSuccess=0;

	--declare @ContainerNo nvarchar(50)='TGBU3238554',

	--@KalmanrNo	nvarchar(50)='RS15',

	--@TransactionTime datetime='2024-05-04 01:56:00';

	select @ContainerNo=[dbo].[FN_GET_OCR_CONTAINER_NO](@ContainerNo);

	--declare @YardContainerNo nvarchar(50);

	--select @YardContainerNo = dbo.FN_GET_OCR_CONTAINER_NO(@ContainerNo);

    select @DeviceID=DeviceID from ESS_MST_EQUIPMENT where VTMImeiNo=@KalmanrNo;

	select top 1 @EqpTransID=EqpTransID,@ContainerMasterId=ContMasterID from EKL_TRN_EQUIPMENT_TRANSACTION 

	where DeviceID=@DeviceID and PacketType='UK' and TransDate 

	between dateadd(SECOND,-70,@TransactionTime) and dateadd(second,+70,@TransactionTime)

	order by EqpTransID desc

	IF @ContainerMasterId is null

	BEGIN

		SET @IsSuccess=1;

		SELECT @IsSuccess AS IsSuccess;

	END

	ELSE

	BEGIN

		SET @IsSuccess=2;

		SELECT @IsSuccess AS IsSuccess;

	END

END

-- dbo.GET_EKY_TRN_DAILY_UTILIZATION
GO
CREATE PROCEDURE [dbo].[GET_EKY_TRN_DAILY_UTILIZATION] 

@EqpNo nvarchar(MAX),  

@FromDate datetime,  

@ToDate datetime  

AS  

BEGIN  

--declare @EqpNo nvarchar(MAX)='RS-12';

--declare @FromDate datetime='2024-05-02';

--declare @ToDate datetime='2024-05-05' ;

 

declare @Days int,@TotalRuningHr int;  

set @Days = DATEDIFF(day,@FromDate,@ToDate)+1  

set @TotalRuningHr=18*@Days  

select U.DeviceIMEI,EquipmentNo,[dbo].[ConvertDDHHMM](isnull(SUM(breakdownTime),0)*60) as BreakdownTime,

[dbo].[ConvertDDHHMM]((((isnull(SUM(IdleTime),0)))*60)-(isnull(SUM(breakdownTime),0)*60)) as IdleTime,  

[dbo].[ConvertDDHHMM](ISNULL(SUM((WorkTime)),0)*60) as WorkTime,(ISNULL(SUM(UL.TOTALLIFUP),0)) as TotalMoves,  

(case when cast(round((cast(SUM(WorkTime) as float)/60),0) as int)=0 then 1 else cast(round((cast(SUM(WorkTime) as float)/60),0) as int) end) as WorkingHours,  

(SUM(ContainerCount)/(case when cast(round((cast(SUM(WorkTime) as float)/60),0) as int)=0 then 1 else cast(round((cast(SUM(WorkTime) as float)/60),0) as int) end)) AS HourlyMoves,  

@TotalRuningHr as ExpectedWorkingHours,cast(((case when cast(round((cast(SUM(WorkTime) as float)/60),0) as int)=0 then 1.0 else round((cast(SUM(WorkTime) as float)/60),0)  end)/@TotalRuningHr)*100 as decimal(10,2)) as PercentageUtilization  

from ESS_MST_EQUIPMENT E LEFT JOIN EKY_TRN_DAILY_UTILIZATION U  ON U.DeviceIMEI=E.DeviceID

left join (select sum(datediff(minute,MaintanceStart,isnull(MaintanceEnd,getdate()))) as breakdownTime,cast(MaintanceStart as date) as breadownDate,VehicleID from ESS_MST_BREAKDOWN

where VehicleID is not null group by cast(MaintanceStart as date),VehicleID) as breakdown on breakdown.VehicleID=E.EqpID and cast(U.TransactionDate as date)=breadownDate

LEFT JOIN (select DeviceIMEI,SUM(TotalLiftup) as TOTALLIFUP,CAST(TransactionDate as date) as TransactionDate from EKY_TRN_DAILY_UTILIZATION_BY_LOCATION where CAST(TransactionDate as date) between CAST(@FromDate as date)

 and CAST(@ToDate as date) group by DeviceIMEI,CAST(TransactionDate as date)) UL on UL.DeviceIMEI=U.DeviceIMEI and UL.TransactionDate=U.TransactionDate

 where U.EquipmentNo in (SELECT VALUE FROM [DBO].[Split_String](@EqpNo,','))  

 and U.TransactionDate between @FromDate and @ToDate  and E.IsDelete=0

 group by U.DeviceIMEI,EquipmentNo  

--order by EqpID asc 

  

END

-- dbo.GET_EKY_TRN_HOURLY_UTILIZATION
GO
CREATE PROCEDURE [dbo].[GET_EKY_TRN_HOURLY_UTILIZATION]       

AS    

BEGIN    

--declare @EqpNo nvarchar(MAX)='RS-12';  

--declare @FromDate datetime='2024-05-02';  

--declare @ToDate datetime='2024-05-05' ;  

   

declare @Days int,@TotalRuningHr int;    

set @Days =DATEDIFF(day,GETDATE(),GETDATE())+1    

--set @TotalRuningHr=18*@Days    

set @TotalRuningHr=(CASE 
        WHEN DATEPART(MINUTE, GETDATE()) > 30 
        THEN DATEPART(HOUR, GETDATE()) + 1 
        ELSE DATEPART(HOUR, GETDATE()) 
    END)*@Days    

select E.DeviceID as DeviceIMEI,E.Equipment_Name as EquipmentNo,[dbo].[ConvertDDHHMM](isnull(SUM(breakdownTime),0)*60) as BreakdownTime,  

[dbo].[ConvertDDHHMM](iif((((isnull(SUM(IdleTime),0)))*60)-(isnull(SUM(breakdownTime),0)*60)>0,(((isnull(SUM(IdleTime),0)))*60)-(isnull(SUM(breakdownTime),0)*60),0)) as IdleTime,    

[dbo].[ConvertDDHHMM](ISNULL(SUM((WorkTime)),0)*60) as WorkTime,(ISNULL(SUM(UL.TOTALLIFUP),0)) as TotalMoves,    

ISNULL((case when cast(round((cast(SUM(WorkTime) as float)/60),0) as int)=0 then 1 else cast(round((cast(SUM(WorkTime) as float)/60),0) as int) end),0) as WorkingHours,    

ISNULL((ISNULL(SUM(UL.TOTALLIFUP),0)/(case when cast(round((cast(SUM(WorkTime) as float)/60),0) as int)=0 then 1 else cast(round((cast(SUM(WorkTime) as float)/60),0) as int) end)),0) AS HourlyMoves,    

@TotalRuningHr as ExpectedWorkingHours,cast(((case when cast(round((cast(SUM(WorkTime) as float)/60),0) as int)=0 then 1.0 else round((cast(SUM(WorkTime) as float)/60),0)  end)/@TotalRuningHr)*100 as decimal(10,2)) as PercentageUtilization    

from ESS_MST_EQUIPMENT E 

LEFT JOIN EKY_TRN_DAILY_UTILIZATION U  ON U.DeviceIMEI=E.DeviceID and CAST(U.TransactionDate as date) = CAST(GETDATE() as date) and E.IsDelete=0  

left join

(

select sum(datediff(minute,MaintanceStart,isnull(MaintanceEnd,getdate()))) as breakdownTime,cast(MaintanceStart as date) as breadownDate,VehicleID from ESS_MST_BREAKDOWN  

where VehicleID is not null group by cast(MaintanceStart as date),VehicleID

) as breakdown on breakdown.VehicleID=E.EqpID and cast(U.TransactionDate as date)=breadownDate  

LEFT JOIN 

(

--select DeviceIMEI,SUM(TotalLiftup) as TOTALLIFUP,CAST(TransactionDate as date) as TransactionDate from EKY_TRN_DAILY_UTILIZATION_BY_LOCATION where CAST(TransactionDate as date) between CAST(GETDATE() as date)  

-- and CAST(GETDATE() as date) group by DeviceIMEI,CAST(TransactionDate as date)



select EQ.DeviceID,COUNT(PacketType) as TOTALLIFUP,CAST(isnull(TransDate,getdate()) as date) as TransactionDate from ESS_MST_EQUIPMENT EQ

LEFT JOIN EKL_TRN_EQUIPMENT_TRANSACTION TR ON EQ.DeviceID=TR.DeviceID and isnull(PacketType,'UK')='UK' and CAST(isnull(TransDate,getdate()) as date) = CAST(GETDATE() as date)

group by EQ.DeviceID,CAST(isnull(TransDate,getdate()) as date)



 ) UL on UL.DeviceID=U.DeviceIMEI and UL.TransactionDate=U.TransactionDate  

 --where 

 --U.EquipmentNo in (SELECT VALUE FROM [DBO].[Split_String](@EqpNo,',')) and

 

 group by E.DeviceID,E.Equipment_Name    

--order by EqpID asc   

    

END

-- dbo.GET_EQPIMENTUTLIZATION_REPORT
GO
CREATE PROCEDURE [dbo].[GET_EQPIMENTUTLIZATION_REPORT]

 @fromDate datetime,          

 @toDate datetime,          

 @Eqp nvarchar(max) ,  

 @PlantID bigint  

AS   

BEGIN         

	

	select EquipmentNo as EqpName,TransactionDate as TransactionDate,TotalLiftup as LIFTDETAIL,Loaded as LOADED,

	UnLoaded as EMT,Import as IMPORT,Export as EXPORT,[Empty] as [EMPTY],Rail as RAIL,Domestic as DOMESTIC,GDL as GDL from EKY_TRN_DAILY_UTILIZATION_BY_LOCATION

	where EquipmentNo in  (select Value from [dbo].Split_String(@Eqp,','))  and CAST(TransactionDate as DATE) between @fromDate and @toDate  





 --  select EQ.Equipment_Name as EqpName,CAST(E.TransDate as DATE) as TransactionDate,Count(E.PacketType) as LIFTDETAIL,

 --  0 as LOADED,          

 --  0  as EMT ,

 --  ISNULL(SUM(case when ISNULL(UPPER(L.ContainerLocationName),0) LIKE '%IMP%' then 1 else 0 end ),0) as [IMPORT],          

 --  ISNULL(SUM(case when ISNULL(UPPER(L.ContainerLocationName),0)  like '%EXP%' then 1 else 0 end ),0)  as [EXPORT],

 --  ISNULL(SUM(case when (UPPER(I.ContainerStatus) LIKE '%EMPTY%' AND UPPER(I.Process) LIKE '%EMPTY%') then 1 else 0 end ),0)  as [EMPTY] ,

 --  ISNULL(SUM(case when (ISNULL(UPPER(L.ContainerLocationName),0)  like '%RAIL%' OR ISNULL(UPPER(L.ContainerLocationName),0)  like '%TRI%') then 1 else 0 end ),0)  as [RAIL], 

 --  ISNULL(SUM(case when ISNULL(UPPER(L.ContainerLocationName),0)  like '%ORY%' then 1 else 0 end ),0)  as [DOMESTIC],

 --  ISNULL(SUM(case when (ISNULL(UPPER(L.ContainerLocationName),0)  like '%OLD%' OR ISNULL(UPPER(L.ContainerLocationName),0)  like '%WH0102%') then 1 else 0 end ),0)  as [GDL] 

 --  from EKL_TRN_EQUIPMENT_TRANSACTION E

	--LEFT JOIN ESS_MST_EQUIPMENT EQ  ON EQ.DeviceID=E.DeviceID

	--LEFT JOIN EKL_TRN_INVENTORY I ON I.ContMasterID=E.ContMasterID

	--LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=I.LastLocID

 --   where CAST(E.TransDate as DATE) between @fromDate and @toDate and

	--EQ.Equipment_Name in  (select Value from [dbo].Split_String(@Eqp,',')) and E.PacketType in ('UK')     

 --    group by EQ.Equipment_Name,CAST(E.TransDate as DATE)      

         

END

-- dbo.GET_EQUIPMENT_ACCURACY
GO
CREATE PROCEDURE [dbo].[GET_EQUIPMENT_ACCURACY]  

@PlantID bigint,

@EqpName nvarchar(max),

@FromDate datetime,

@ToDate datetime

AS  

BEGIN  

select E.Equipment_Name,CAST(ET.TransDate as date) as TransDate,SUM(CASE WHEN  UPPER(UpdateStutus)='EQ' THEN 1 ELSE 0 END) as EQ,

SUM(CASE WHEN  UPPER(UpdateStutus)='T' THEN 1 ELSE 0 END) as T,SUM(CASE WHEN  UPPER(UpdateStutus)='A' THEN 1 ELSE 0 END) as A,

SUM(CASE WHEN  UPPER(UpdateStutus)='M' THEN 1 ELSE 0 END) as M,

(SUM(CASE WHEN  OCRContainerNo='00000000000' THEN 1 ELSE 0 END)+SUM(CASE WHEN OCRContainerNo<>'00000000000' THEN 1 ELSE 0 END)) as TotalCount,

SUM(CASE WHEN  OCRContainerNo='00000000000' THEN 1 ELSE 0 END) as Missing,

SUM(CASE WHEN  OCRContainerNo<>'00000000000' THEN 1 ELSE 0 END) as NonMissing,

CAST((

SUM(CASE WHEN  OCRContainerNo<>'00000000000' THEN 1 ELSE 0 END)/

CAST(SUM(CASE WHEN OCRContainerNo='00000000000' THEN 1 ELSE 0 END)+SUM(CASE WHEN  OCRContainerNo<>'00000000000' THEN 1 ELSE 0 END) as decimal(18,2))

)*100  as decimal(18,2)) as Accuracy

from ESS_MST_EQUIPMENT E

LEFT JOIN EKL_TRN_EQUIPMENT_TRANSACTION ET ON ET.DeviceID=E.DeviceID

where CAST(ET.TransDate as date) BETWEEN CAST(@FromDate as date) and CAST(@ToDate as date) and

E.Equipment_Name  in  (select Value from [dbo].Split_String(@EqpName,',')) and

PacketType='UK' and E.IsDelete=0

GROUP BY E.Equipment_Name,CAST(ET.TransDate as date)

ORDER BY RIGHT(E.Equipment_Name,2) ASC

END

-- dbo.GET_ESS_MST_ITV
GO
CREATE PROC [dbo].[GET_ESS_MST_ITV]

as

begin

select VehicleNo,ITVNo from  ESS_MST_ITV where Isdelete=0

end

-- dbo.GET_ESURVEY_DETAIL
GO
CREATE PROCEDURE [dbo].[GET_ESURVEY_DETAIL]

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

            S.SurveyTime,S.DetectedTime,

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

            -- 🔥 DEDUPLICATION LOGIC

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

-- dbo.GET_GATEIN_REPORT
GO
CREATE PROC [dbo].[GET_GATEIN_REPORT]  

@fromDate DATETIME,  

@toDate DATETIME,  

@ContainerNo varchar(50),  

@PlantId BIGINT  

AS  

BEGIN 



SET @ContainerNo=ISNULL(@ContainerNo,'');

SET @fromDate=ISNULL(@fromDate,'');

SET @toDate=ISNULL(@toDate,'');



IF @ContainerNo <> '' and @fromDate='' and  @toDate=''

BEGIN  

  select I.ContNo as ContainerNo,I.ContainerSize,I.ContainerType,I.GateInDate,GateOutDate,[dbo].[ConvertDDHHMMSS](I.GateInDate,ISNULL(I.GateOutDate,GETDATE())) as INTAT,

  [dbo].[ConvertDDHHMMSS](I.GateInDate,I.GateOutDate) as OUTTAT,I.Process,I.BookingNo,I.ShippingLine,I.Mode,I.DocumentNo,I.ContainerStatus,G.GateName,(CASE WHEN i.ContainerSize like '%40%' then l.ContainerLocationName1 else L.ContainerLocationName end) ContainerLocationName

  from EKL_TRN_INVENTORY I  

  LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=I.LastLocID

  LEFT JOIN ESS_MST_GATE G ON G.GateID=I.GateInType  

  where I.ContNo=@ContainerNo

END  

else  IF  @ContainerNo=''  and @fromDate <>'' and  @toDate<>''

BEGIN  

  select I.ContNo as ContainerNo,I.ContainerSize,I.ContainerType,I.GateInDate,GateOutDate,[dbo].[ConvertDDHHMMSS](I.GateInDate,ISNULL(I.GateOutDate,GETDATE())) as INTAT,

  [dbo].[ConvertDDHHMMSS](I.GateInDate,I.GateOutDate) as OUTTAT,I.Process,I.BookingNo,I.ShippingLine,I.Mode,I.DocumentNo,I.ContainerStatus,G.GateName,(CASE WHEN i.ContainerSize like '%40%' then l.ContainerLocationName1 else L.ContainerLocationName end) ContainerLocationName

  from EKL_TRN_INVENTORY I  

  LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=I.LastLocID

  LEFT JOIN ESS_MST_GATE G ON G.GateID=I.GateInType  

  where ((CAST(I.GateInDate as date) between @fromDate and @toDate)OR(CAST(I.GateOutDate as date) between @fromDate and @toDate))

END 

ELSE IF  @ContainerNo <> '' and @fromDate <>'' and  @toDate<>'' 

BEGIN  

 select I.ContNo as ContainerNo,I.ContainerSize,I.ContainerType,I.GateInDate,GateOutDate,[dbo].[ConvertDDHHMMSS](I.GateInDate,ISNULL(I.GateOutDate,GETDATE())) as INTAT,

  [dbo].[ConvertDDHHMMSS](I.GateInDate,I.GateOutDate) as OUTTAT,I.Process,I.BookingNo,I.ShippingLine,I.Mode,I.DocumentNo,I.ContainerStatus,G.GateName,(CASE WHEN i.ContainerSize like '%40%' then l.ContainerLocationName1 else L.ContainerLocationName end) ContainerLocationName

  from EKL_TRN_INVENTORY I  

  LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=I.LastLocID

  LEFT JOIN ESS_MST_GATE G ON G.GateID=I.GateInType  

  where ((CAST(I.GateInDate as date) between @fromDate and @toDate)OR(CAST(I.GateOutDate as date) between @fromDate and @toDate)) and I.ContNo=@ContainerNo

END  

END

-- dbo.GET_GATEINOUT_TIMELINE
GO
CREATE PROCEDURE [dbo].[GET_GATEINOUT_TIMELINE]

@MasterId bigint,

@ContainerNo varchar(50)

as

begin

select InventoryID,ContNo,'' as TrailerNo,'' as TagNo,GateInDate,GateOutDate

from EKL_TRN_INVENTORY where ContNo=@ContainerNo and ContMasterID=@MasterId

end

-- dbo.GET_GATEOUT_REPORT
GO
CREATE PROC [dbo].[GET_GATEOUT_REPORT]  

@fromDate DATETIME,  

@toDate DATETIME,  

@ContainerNo varchar(50),  

@PlantId BIGINT  

AS  

BEGIN  





--declare @fromDate datetime,@toDate datetime,@ContainerNo varchar(50)

--set @fromDate='2024-11-27';

--set @toDate='2024-11-28';

SET @ContainerNo=ISNULL(@ContainerNo,'');

SET @fromDate=ISNULL(@fromDate,'');

SET @toDate=ISNULL(@toDate,'');

IF @ContainerNo <> '' and @fromDate='' and  @toDate=''

BEGIN  



  select ContMasterID as ContainerMasterId,ContNo as ContainerNo,isnull(I.TrailerId,0) as TrailerId,I.GateInDate,I.GateOutDate,T.TrailerNo,GatePassNo,FORMAT (I.GateInDate, 'dd-MM-yyyy') as SurveyDate,[dbo].[ConvertDDHHMMSS](I.GateInDate,ISNULL(I.GateOutDate,GETDATE())) as TAT,'GDKL' as ContainerLocationName,'' as ContainerSize

  from EKL_TRN_INVENTORY I  

  left join EKL_TRN_TRAILER T on T.TrailerID=I.TrailerID

  left join EKL_TRN_CONTAINER_SURVEY S on ContainerNo1=ContNo and T.TrailerNo=S.TrailerNo and cast(I.GateOutDate as date)=cast(S.SurveyTime as date)

  where I.ContNo=@ContainerNo and S.TrailerNo is not null

END  

else  IF  @ContainerNo='' and @fromDate <>'' and  @toDate<>''

BEGIN  

  select ContMasterID as ContainerMasterId,ContNo as ContainerNo,isnull(I.TrailerId,0) as TrailerId,I.GateInDate,I.GateOutDate,T.TrailerNo,GatePassNo,FORMAT (I.GateInDate, 'dd-MM-yyyy') as SurveyDate,[dbo].[ConvertDDHHMMSS](I.GateInDate,ISNULL(I.GateOutDate,GETDATE())) as TAT,'GDKL' as ContainerLocationName,'' as ContainerSize

  from EKL_TRN_INVENTORY I  

  left join EKL_TRN_TRAILER T on T.TrailerID=I.TrailerID

  left join EKL_TRN_CONTAINER_SURVEY S on ContainerNo1=ContNo and T.TrailerNo=S.TrailerNo and cast(I.GateOutDate as date)=cast(S.SurveyTime as date)

  where CAST(I.GateOutDate as date) between @fromDate and @toDate and S.TrailerNo is not null

END 

ELSE IF  @ContainerNo <> '' and @fromDate <>'' and  @toDate<>'' 

BEGIN  

  select ContMasterID as ContainerMasterId,ContNo as ContainerNo,isnull(I.TrailerId,0) as TrailerId,I.GateInDate,I.GateOutDate,T.TrailerNo,GatePassNo,FORMAT (I.GateInDate, 'dd-MM-yyyy') as SurveyDate,[dbo].[ConvertDDHHMMSS](I.GateInDate,ISNULL(I.GateOutDate,GETDATE())) as TAT,'GDKL' as ContainerLocationName,'' as ContainerSize

  from EKL_TRN_INVENTORY I  

  left join EKL_TRN_TRAILER T on T.TrailerID=I.TrailerID

  left join EKL_TRN_CONTAINER_SURVEY S on ContainerNo1=ContNo and T.TrailerNo=S.TrailerNo and cast(I.GateOutDate as date)=cast(S.SurveyTime as date)

  where CAST(I.GateOutDate as date) between @fromDate and @toDate and I.ContNo=@ContainerNo and S.TrailerNo is not null

END  

END

-- dbo.GET_GATEWISE_ESURVEY_DETAIL
GO
CREATE PROCEDURE [dbo].[GET_GATEWISE_ESURVEY_DETAIL]     

 @PlantID bigint,

 @Gate varchar(50),

 @FromDate datetime,

 @ToDate datetime

 AS 

 BEGIN



IF UPPER(@Gate)=UPPER('EMERGENCYIN')

BEGIN

select I.ContMasterID as ContMasterID,I.ContNo,I.ContainerSize,I.ContainerType,UPPER(I.Process) as Process,I.ShippingLine,I.BookingNo,I.ContainerStatus,I.Mode,I.DocumentNo,I.GateInDate,I.GateOutDate,

	(CASE WHEN I.ContainerSize like '%40%' then L.ContainerLocationName1 else l.ContainerLocationName end) as ContainerLocationName,T.TrailerNo,ISNULL(T.TrailerNo,'') as ANPRVehicleNo,

	(CASE WHEN I.ContNo IS NOT NUll THEN I.ContNo +'_'+FORMAT((case when DATEPART(SECOND,I.YardInTime) <= 4 then DATEADD(minute,0,I.YardInTime) else I.YardInTime end) , 'yyyyMMddHHmmss')+'.jpg' ELSE '' END) as Containerimg ,

	'GateIn' as GateName,I.YardInTime as SurveyDate

	from EKL_TRN_INVENTORY I

	LEFT JOIN EKL_TRN_TRAILER T ON I.TrailerID=T.TrailerID

	LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=I.LastLocID

	where CAST(I.YardInTime as date) between @FromDate and @ToDate 

	AND I.YardInTime IS NOT NULL 



--SELECT 

--    I.ContMasterID AS ContMasterID,I.ContNo,I.ContainerSize,I.ContainerType,UPPER(I.Process) AS Process,I.ShippingLine,I.BookingNo,

--    I.ContainerStatus,I.Mode,I.DocumentNo,I.GateInDate, I.GateOutDate,

--    (CASE WHEN I.ContainerSize LIKE '%40%' THEN L.ContainerLocationName1 ELSE L.ContainerLocationName END) AS ContainerLocationName,

--    T.TrailerNo,ISNULL(T.TrailerNo, 'N/A') AS ANPRVehicleNo,

--    STRING_AGG(I.ContNo + '_' + FORMAT(

--    CASE WHEN DATEPART(SECOND, GS.SurveyDate) <= 4 THEN DATEADD(MINUTE, 0, GS.SurveyDate) ELSE GS.SurveyDate END, 'yyyyMMddHHmmss') + '.jpg', ',') AS Containerimg,

--		'GateIn' AS GateName,I.YardInTime AS SurveyDate FROM  EKL_TRN_INVENTORY I

--LEFT JOIN EKL_TRN_TRAILER T ON I.TrailerID = T.TrailerID

--LEFT JOIN ESS_MST_LOCATION L ON L.LocationID = I.LastLocID

--LEFT JOIN EKL_TRN_GATEWISE_SURVEY GS ON GS.ContainerNo = I.ContNo 

--WHERE I.ContNo = 'BSIU2178236' AND I.YardInTime IS NOT NULL

--GROUP BY 

--    I.ContMasterID, I.ContNo, I.ContainerSize, I.ContainerType, I.Process, I.ShippingLine, 

--    I.BookingNo, I.ContainerStatus, I.Mode, I.DocumentNo, I.GateInDate, I.GateOutDate, 

--    L.ContainerLocationName1, L.ContainerLocationName, I.ContainerSize, 

--    T.TrailerNo, I.YardInTime





END

IF UPPER(@Gate)=UPPER('EMERGENCYOUT')

BEGIN

select I.ContMasterID as ContMasterID,I.ContNo,I.ContainerSize,I.ContainerType,UPPER(I.Process) as Process,I.ShippingLine,I.BookingNo,I.ContainerStatus,I.Mode,I.DocumentNo,I.GateInDate,I.GateOutDate,

	(CASE WHEN I.ContainerSize like '%40%' then L.ContainerLocationName1 else l.ContainerLocationName end) as ContainerLocationName,T.TrailerNo,ISNULL(T.TrailerNo,'') as ANPRVehicleNo,

	(CASE WHEN I.ContNo IS NOT NUll THEN I.ContNo +'_'+FORMAT((case when DATEPART(SECOND,I.YardOutTime) <= 4 then DATEADD(minute,0,I.YardOutTime) else I.YardOutTime end) , 'yyyyMMddHHmmss')+'.jpg' ELSE '' END) as Containerimg ,

	'GateOut' as GateName,I.YardOutTime as SurveyDate

	from EKL_TRN_INVENTORY I

	LEFT JOIN EKL_TRN_TRAILER T ON I.TrailerID=T.TrailerID

	LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=I.LastLocID

	where CAST(I.YardOutTime as date) between @FromDate and @ToDate 

	AND I.YardOutTime IS NOT NULL 

END

END

-- dbo.GET_GENERATED_GATEPASS
GO
CREATE PROC [dbo].[GET_GENERATED_GATEPASS]

as 



begin

declare @GatePass int;

SET @GatePass = NEXT VALUE FOR GatePassSeq;



select @GatePass as GatePass

end

-- dbo.GET_INVENTORY_FOR_PLOTTING_NEW
GO
CREATE PROC [dbo].[GET_INVENTORY_FOR_PLOTTING_NEW]    

 

as    

begin    

   

SELECT   

    I.ContNo,  

    I.ContMasterID,  

    I.ContainerSize,  

    I.GateInDate,  

    CASE   

        WHEN I.ContainerSize LIKE '%40%' THEN L.ContainerLocationName1   

        ELSE L.ContainerLocationName   

    END AS Last_Loc,  

    ISNULL(I.ShippingLine, 'OTHER') AS ShippingLine,  

    L2.ContainerLocationName AS CurrentLocation,  

    L1.ContainerLocationName AS AdjacentLocation  

     

FROM   

    EKL_TRN_INVENTORY I  

    LEFT JOIN ESS_MST_CONTAINER_SIZE CS ON CS.ContSizeID = I.SizeID  

    LEFT JOIN ESS_MST_GATE G ON G.GateID = I.GateInType  

    LEFT JOIN IND_MST_USER U ON U.UserID = I.GateInBy  

    LEFT JOIN ESS_MST_LOCATION L ON L.LocationID = I.LastLocID  

    LEFT JOIN ESS_MST_LOCATION_MAPPING M ON M.LocationName = L.ContainerLocationName1  

    LEFT JOIN ESS_MST_LOCATION L1 ON L1.LocationID = M.AdjucentId  

 LEFT JOIN ESS_MST_LOCATION L2 ON M.LocationID = L2.LocationID  

    

WHERE   

    I.GateOutDate IS NULL   and L.ContainerLocationName is not null  

   

 

    

    

  end

-- dbo.GET_INVENTORY_REPORT
GO
CREATE PROC [dbo].[GET_INVENTORY_REPORT]

@ContainerNo varchar(50),

@PlantId BIGINT

AS

BEGIN



select I.ContNo,ContMasterID,CS.ContSize,I.GateInDate,

l.ContainerLocationName as Offload_Loc,(CASE WHEN i.ContainerSize like '%40%' then l.ContainerLocationName1 else L.ContainerLocationName end) as Last_Loc,

(CASE WHEN i.ContainerSize like '%40%' then l.ContainerLocationName1 else L.ContainerLocationName end) as ContainerLocationName

  from EKL_TRN_INVENTORY I

  LEFT JOIN ESS_MST_CONTAINER_SIZE CS ON CS.ContSizeID=I.SizeID

  LEFT JOIN ESS_MST_GATE G ON G.GateID=I.GateInType

  LEFT JOIN IND_MST_USER U ON U.UserID=I.GateInBy

  LEFT JOIN ESS_MST_LOCATION l ON l.LocationID=I.OffloadLocID

  LEFT JOIN ESS_MST_LOCATION l1 ON l1.LocationID=I.LastLocID

  where I.PlantID=@PlantId and I.ContNo=@ContainerNo

  and I.GateOutDate IS NULL



END

-- dbo.GET_ITV_REPORT_SUMMARY
GO
CREATE PROCEDURE [dbo].[GET_ITV_REPORT_SUMMARY]  -- '','','2024-07-01 00:00','2024-07-21 05:01',0  

@ITVNo VARCHAR(500),    

@EqpNo NVARCHAR(MAX),    

@fromdate DATETIME,    

@todate DATETIME,    

@PlantID BIGINT    

AS     

BEGIN    

    

 

 select EqpTransID,TransDate as TransDate,  (case when i.ContainerSize like '40%' then EL.ContainerLocationName1 

else EL.ContainerLocationName end)  as StartLocation,

(case when i.ContainerSize like '40%' then lL.ContainerLocationName1 else LL.ContainerLocationName end) as EndLocation,

cast(OffLatitude  as decimal(18,6)) as StartLatitude,cast( OffLongitude as decimal(18,6)) as StartLongitude,

cast(LocLatitude  as decimal(18,6)) as EndLatitude,cast( LocLongitude as decimal(18,6)) as EndLongitude,

OCRContainerNo as ContNo,Equipment_Name as EqpName,ET.DeviceID as DeviceID,ET.ContMasterID as ContainerMasterId,     ET.ITVNo as ITVNo, ET.PacketType as PacketType,    

EE.VTMImeiNo + '/' +CAST(YEAR(ET.TransDate) AS VARCHAR(4)) + '/' +DATENAME(MONTH, ET.TransDate) + '/' +CONVERT(VARCHAR(10), ET.TransDate,105) + '/OCR-images/' +EE.VTMImeiNo + '_' +FORMAT(ET.TransDate,'ddMMyyHHmm') +'_1.jpg' AS CameraImage1 ,    

EE.VTMImeiNo + '/' +CAST(YEAR(ET.TransDate) AS VARCHAR(4)) + '/' +DATENAME(MONTH, ET.TransDate) + '/' +CONVERT(VARCHAR(10), ET.TransDate,105) + '/OCR-images/' +EE.VTMImeiNo + '_' +FORMAT(ET.TransDate,'ddMMyyHHmm') +'_2.jpg' AS   CameraImage2,

EE.VTMImeiNo + '/' +CAST(YEAR(ET.TransDate) AS VARCHAR(4)) + '/' +DATENAME(MONTH, ET.TransDate) + '/' +CONVERT(VARCHAR(10), ET.TransDate,105) + '/OCR-images/' +EE.VTMImeiNo + '_' +FORMAT(ET.TransDate,'ddMMyyHHmm') +'_3.jpg' AS  CameraImage3 ,

it.VehicleNo

 from EKL_TRN_EQUIPMENT_TRANSACTION ET     

 LEFT JOIN EKL_TRN_INVENTORY I ON ET.ContMasterID=I.ContMasterID    

-- left join ESS_MST_LOCATION EL on EL.LocationId=ET.AreaId  

  LEFT JOIN ESS_MST_LOCATION El ON EL.LocationID=I.OffloadLocID

  LEFT JOIN ESS_MST_LOCATION ll ON ll.LocationID=I.LastLocID

 LEFT JOIN ESS_MST_EQUIPMENT EE ON EE.DeviceId=ET.DeviceID  

 left join ESS_MST_ITV it on it.ITVNo=ET.ITVNo

  WHERE 

    ET.ITVNo  is not null

      AND 

	(@ITVNo = '' 

         OR ET.ITVNo IN (SELECT VALUE FROM dbo.Split_String(@ITVNo,',')))



    AND (@EqpNo = '' 

         OR Equipment_Name IN (SELECT VALUE FROM dbo.Split_String(@EqpNo,',')))



    AND (@fromdate IS NULL 

         OR ET.TransDate >= @fromdate)



    AND (@todate IS NULL 

         OR ET.TransDate <= @todate)



    AND (@PlantID = 0 

         OR EL.PlantID = @PlantID)     

 order by ET.TransDate desc 

    

    

END

-- dbo.GET_MISMATCH_CONTAINER_HANDLE_DATA
GO
CREATE PROC [dbo].[GET_MISMATCH_CONTAINER_HANDLE_DATA]  

@FromDate DateTime,

@ToDate DateTime

as   

BEGIN  



SELECT OCRDATA AS ContainerNo, MIN(DATEADD(MINUTE, 330, [DateTime])) AS TransDateTime FROM EKL_TRN_EKDEVICEDATA

WHERE OCRDATA NOT IN (SELECT ContNo FROM EKL_TRN_INVENTORY )

  AND CAST([DateTime] AS DATE) BETWEEN @FromDate AND  @ToDate

  AND OCRDATA <> '' 

  AND PacketID = 8

GROUP BY OCRDATA;



END

-- dbo.GET_MISMATCH_HANDLING_WITH_IMAGE
GO
CREATE PROCEDURE [dbo].[GET_MISMATCH_HANDLING_WITH_IMAGE]

@ContainerNo VARCHAR(50)

AS 

BEGIN

   

   SELECT Ek.KalmarNo,DATEADD([MINUTE],330,[DateTime]) as TransactionDate,Latitude,Longitude,OCRDATA as ContainerNo ,

   (CASE WHEN EK.OCRDATA IS NOT NUll THEN EQ.VTMImeiNo+'/IMAGE/Camera11_'+EQ.VTMImeiNo+'_'+FORMAT((case when DATEPART(SECOND,DATEADD(MINUTE,330,EK.[DateTime])) < 2 then DATEADD(minute,-1,DATEADD(MINUTE,330,EK.[DateTime])) else DATEADD(MINUTE,330,Ek.[DateTime]) end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage1,

   (CASE WHEN EK.OCRDATA IS NOT NUll THEN EQ.VTMImeiNo+'/IMAGE/Camera21_'+EQ.VTMImeiNo+'_'+FORMAT((case when DATEPART(SECOND,DATEADD(MINUTE,330,EK.[DateTime])) < 2 then DATEADD(minute,-1,DATEADD(MINUTE,330,EK.[DateTime])) else DATEADD(MINUTE,330,Ek.[DateTime]) end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage2,

   (CASE WHEN EK.OCRDATA IS NOT NUll THEN EQ.VTMImeiNo+'/IMAGE/Camera31_'+EQ.VTMImeiNo+'_'+FORMAT((case when DATEPART(SECOND,DATEADD(MINUTE,330,EK.[DateTime])) < 2 then DATEADD(minute,-1,DATEADD(MINUTE,330,EK.[DateTime])) else DATEADD(MINUTE,330,Ek.[DateTime]) end) , 'ddMMyyHHmm')+'.jpg' ELSE '' END) as CameraImage3

   FROM EKL_TRN_EKDEVICEDATA EK

   LEFT JOIN ESS_MST_EQUIPMENT EQ ON EQ.DeviceID=ek.DeviceIMEI

   WHERE OCRDATA='TIIU4077324' and PacketID = 8 ORDER BY [DateTime] ASC	

   

END

-- dbo.GET_OFFLOAD_REPORT
GO
CREATE PROC [dbo].[GET_OFFLOAD_REPORT]  

@fromDate DATETIME,  

@toDate DATETIME,  

@ContNo varchar(50),  

@PlantID BIGINT  

AS  

BEGIN  

IF @ContNo <> '' OR @ContNo != ''  

BEGIN  

  select I.ContNo,I.ContainerSize as ContSize,I.ContainerType as ContTypeName,I.GateInDate,I.OffloadDate,[dbo].[ConvertDDHHMMSS](I.GateInDate,ISNULL(I.OffloadDate,GETDATE())) as OffloadTAT,'Offload' as ActivityName,I.Process as ProcessName,'' as Arrival,  

  'GDL' as GateName, '' as UserName  

 from EKL_TRN_INVENTORY I  

  where  I.ContNo=@ContNo and I.GateOutDate IS NULL--I.PlantID=1 and  

END  

ELSE  

BEGIN  

 select I.ContNo,I.ContainerSize as ContSize,I.ContainerType as ContTypeName,I.GateInDate,I.OffloadDate,[dbo].[ConvertDDHHMMSS](I.GateInDate,ISNULL(I.OffloadDate,GETDATE())) as OffloadTAT,'Offload' as ActivityName,I.Process as ProcessName,'' as Arrival,  

  'GDL' as GateName, '' as UserName  

 from EKL_TRN_INVENTORY I  

  where I.GateInDate between @fromDate and @toDate and I.GateOutDate IS NULL  

END  

END

-- dbo.GET_OFFLOAD_TIMELINEDETAILS
GO
CREATE PROCEDURE [dbo].[GET_OFFLOAD_TIMELINEDETAILS]  

@MasterId int   

AS  

  

BEGIN  

  

SELECT TransDate,Equipment_Name as EquipmentName,cast(GpsLocLat as nvarchar(20)) as GpsLocLat,cast(GpsLocLon as nvarchar(20)) as GpsLocLon,

(case when g.ContainerSize like '40%' then l.ContainerLocationName1  

else L.ContainerLocationName end)  as Area ,0 as ContTagId , L.LocationID as LocTagId FROM EKL_TRN_EQUIPMENT_TRANSACTION t 

left join EKL_TRN_INVENTORY g on t.ContMasterID=g.ContMasterID  

left join ESS_MST_LOCATION L ON t.AreaID=L.LocationID

--left join ESS_MST_LOCATION_MAPPING LL On t.AreaID=LL.AdjucentId

left join ESS_MST_EQUIPMENT E ON E.DeviceId=t.DeviceId

WHERE t.ContMasterID=@MasterId  and  PacketType='UK' and l.ContainerLocationName IS NOT NULL

order by TransDate desc  

  

END

-- dbo.GET_PHYSICAL_INVENTORY_LOG
GO
CREATE PROCEDURE [dbo].[GET_PHYSICAL_INVENTORY_LOG] 

 @PlantID bigint ,

 @FromDate DateTime,    

 @ToDate DateTime   

as    

BEGIN   



set @FromDate=ISNULL(@FromDate,'');

---select * from EKL_PRE_RAIL_IN where DocumentNO='SNL/RJ/X/24-25/00054'

if @FromDate != ''

begin

  SELECT L.LogId,L.PlantID,P.PlantName,L.InventoryType,L.ContainerNo,L.Location,L.LocationId,L.Lattitude,L.Longtitude,L.UpdatedDate,'' as ContainerSize FROM EKL_PHYSICAL_INVENTORY_LOG L

  LEFT JOIN ESS_MST_PLANT P ON P.PlantID=L.PlantID

  WHERE CAST(UpdatedDate as date) between @FromDate and @ToDate order by UpdatedDate desc

end

else

begin

   SELECT L.LogId,L.PlantID,P.PlantName,L.InventoryType,L.ContainerNo,L.Location,L.LocationId,L.Lattitude,L.Longtitude,L.UpdatedDate,'' as ContainerSize FROM EKL_PHYSICAL_INVENTORY_LOG L

   LEFT JOIN ESS_MST_PLANT P ON P.PlantID=L.PlantID

   where CAST(UpdatedDate as date)=CAST(GETDATE() as date) order by UpdatedDate desc

end





END

-- dbo.GET_RPT_EKL_RAIL_IN
GO
CREATE PROCEDURE [dbo].[GET_RPT_EKL_RAIL_IN]    

(    

 @fromDate DateTime,    

 @toDate DateTime,    

 @ContainerNo nvarchar(20),    

 @PlantID bigint

)    

as    

begin    

set @fromDate=ISNULL(@fromDate,'');

set @toDate=ISNULL(@toDate,'');



IF @ContainerNo <> ''

BEGIN

	Select distinct PR.ContainerNo,PR.ContainerSize,PR.ContainerType,isnull(RI.GateInDate,RI.GateInDate) as RailInDateTime,NAVDateTime, 

  (CASE WHEN i.ContainerSize like '%40%' then l.ContainerLocationName1 else L.ContainerLocationName end) as ContainerLocation,LastShiftDate,E.Equipment_Name as EquipmentName,LocLatitude as Latitude,LocLongitude as Longitude,

  PR.DocumentNo,PR.BookingNo,PR.TransactionType as Process,PR.ContainerStatus,PR.Mode,PR.Terminal,'' as RailInTAT,'' as OffloadTAT,Pr.WagonNo,

  NoOfMoves from EKL_PRE_RAIL_IN PR 

  LEFT JOIN EKL_TRN_CONTAINER RI ON PR.ContainerNo=RI.ContNo and RI.DocumentNo=PR.DocumentNo

  LEFT JOIN EKL_TRN_INVENTORY I ON I.ContMasterID=RI.ContMasterID

  LEFT JOIN ESS_MST_LOCATION L on L.LocationID=I.LastLocID

  LEFT JOIN ESS_MST_EQUIPMENT E on E.DeviceID=I.EquipmentID

  where RI.ContNo=@ContainerNo and PR.ContainerNo <> ''

END

IF (@fromDate !='' and @toDate !='')

BEGIN

  Select distinct PR.ContainerNo,PR.ContainerSize,PR.ContainerType,isnull(RI.GateInDate,RI.GateInDate) as RailInDateTime,NAVDateTime, 

  (CASE WHEN i.ContainerSize like '%40%' then l.ContainerLocationName1 else L.ContainerLocationName end) as ContainerLocation,LastShiftDate,E.Equipment_Name as EquipmentName,LocLatitude as Latitude,LocLongitude as Longitude,

  PR.DocumentNo,PR.BookingNo,PR.TransactionType as Process,PR.ContainerStatus,PR.Mode,PR.Terminal,'' as RailInTAT,'' as OffloadTAT,Pr.WagonNo,

  NoOfMoves from EKL_PRE_RAIL_IN PR 

  LEFT JOIN EKL_TRN_CONTAINER RI ON PR.ContainerNo=RI.ContNo and PR.DocumentNo=RI.DocumentNo

  LEFT JOIN EKL_TRN_INVENTORY I ON I.ContMasterID=RI.ContMasterID

  LEFT JOIN ESS_MST_LOCATION L on L.LocationID=I.LastLocID

  LEFT JOIN ESS_MST_EQUIPMENT E on E.DeviceID=I.EquipmentID

  where CAST(RI.GateInDate as date) between @fromDate and @toDate and ISNULL(RI.ContNo,I.ContNo) <> '' order by DocumentNo asc,RailInDateTime asc

End



END

-- dbo.GET_RPT_EKL_RAIL_OUT
GO
CREATE PROCEDURE [dbo].[GET_RPT_EKL_RAIL_OUT]    

(    

 @fromDate DateTime,    

 @toDate DateTime,    

 @ContainerNo nvarchar(20),    

 @PlantID bigint

)    

as    

begin    

set @fromDate=ISNULL(@fromDate,'');

set @toDate=ISNULL(@toDate,'');

IF @ContainerNo <> ''

BEGIN

	Select ISNULL(PR.ContainerNo,I.ContNo) as ContainerNo,ISNULL(PR.ContainerSize,I.ContainerSize) as ContainerSize,ISNULL(PR.ContainerType,I.ContainerType) as ContainerType,isnull(RI.GateInDate,RI.GateInDate) as RailInDateTime,NAVDateTime, 

  (CASE WHEN i.ContainerSize like '%40%' then l.ContainerLocationName1 else L.ContainerLocationName end) as ContainerLocation,LastShiftDate,E.Equipment_Name as EquipmentName,LocLatitude as Latitude,LocLongitude as Longitude,

  PR.DocumentNo,PR.BookingNo,ISNULL(PR.TransactionType,I.Process) as Process,ISNULL(PR.ContainerStatus,I.ContainerStatus) as ContainerStatus,PR.Mode,PR.Terminal,'' as RailInTAT,'' as OffloadTAT,Pr.WagonNo,

  NoOfMoves,I.GateOutDate from EKL_PRE_RAIL_IN PR 

  LEFT JOIN EKL_TRN_CONTAINER RI ON PR.ContainerNo=RI.ContNo and RI.DocumentNo=PR.DocumentNo

  LEFT JOIN EKL_TRN_INVENTORY I ON I.ContMasterID=RI.ContMasterID

  LEFT JOIN ESS_MST_LOCATION L on L.LocationID=I.LastLocID

  LEFT JOIN ESS_MST_EQUIPMENT E on E.DeviceID=I.EquipmentID

  where ISNULL(PR.ContainerNo,I.ContNo)=@ContainerNo and ISNULL(PR.ContainerNo,I.ContNo) <> '' and I.GateOutDate IS NOT NULL

END

IF (@fromDate !='' and @toDate !='')

BEGIN

 Select ISNULL(PR.ContainerNo,I.ContNo) as ContainerNo,ISNULL(PR.ContainerSize,I.ContainerSize) as ContainerSize,ISNULL(PR.ContainerType,I.ContainerType) as ContainerType,isnull(RI.GateInDate,RI.GateInDate) as RailInDateTime,NAVDateTime, 

  (CASE WHEN i.ContainerSize like '%40%' then l.ContainerLocationName1 else L.ContainerLocationName end) as ContainerLocation,LastShiftDate,E.Equipment_Name as EquipmentName,LocLatitude as Latitude,LocLongitude as Longitude,

  PR.DocumentNo,PR.BookingNo,ISNULL(PR.TransactionType,I.Process) as Process,ISNULL(PR.ContainerStatus,I.ContainerStatus) as ContainerStatus,PR.Mode,PR.Terminal,'' as RailInTAT,'' as OffloadTAT,Pr.WagonNo,

  NoOfMoves,I.GateOutDate from EKL_PRE_RAIL_IN PR 

  LEFT JOIN EKL_TRN_CONTAINER RI ON PR.ContainerNo=RI.ContNo and RI.DocumentNo=PR.DocumentNo

  LEFT JOIN EKL_TRN_INVENTORY I ON I.ContMasterID=RI.ContMasterID

  LEFT JOIN ESS_MST_LOCATION L on L.LocationID=I.LastLocID

  LEFT JOIN ESS_MST_EQUIPMENT E on E.DeviceID=I.EquipmentID

  where CAST(RI.GateOutDate as date) between CAST(@fromDate as date) and CAST(@toDate as date) and ISNULL(PR.ContainerNo,I.ContNo) <> '' and I.GateOutDate IS NOT NULL

  order by DocumentNo asc,RailInDateTime asc

End



END

-- dbo.GET_RPT_JOURNEY_BY_DOCUMENT
GO
CREATE PROCEDURE [dbo].[GET_RPT_JOURNEY_BY_DOCUMENT] 

 @PlantID bigint,

 @DocumentNo varchar(100)

as    

BEGIN    

select DISTINCT RI.ContainerNo,0 as TransactionId,RI.NAVDateTime,RI.ContainerSize,RI.DocumentNo,RI.TransactionType,RI.Terminal,RI.Mode,RI.WagonNo,RI.ContainerStatus,RI.BookingNo,

(CASE WHEN RI.ContainerNo IS NOT NUll THEN RI.ContainerNo +'_'+FORMAT((case when DATEPART(SECOND,I.RailInDateTime) <= 4 then DATEADD(minute,0,ISNULL(I.RailInDateTime,I.GateInDate)) else ISNULL(I.RailInDateTime,I.GateInDate) end) , 'yyyyMMddHHmmss')+'.jpg' ELSE '' END) as Containerimg 

from (select distinct ContainerNo,NAVDateTime,ContainerSize,DocumentNo,TransactionType,Terminal,BookingNo,WagonNo,Mode,ContainerStatus from EKL_PRE_RAIL_IN where DocumentNo =  @DocumentNo ) RI

LEFT JOIN EKL_TRN_INVENTORY I ON I.ContNo=RI.ContainerNo and I.DocumentNo=RI.DocumentNo

where RI.DocumentNo =  @DocumentNo and ContainerNo !=''

END

-- dbo.GET_RPT_MONTHWISE_INVENTORY
GO
CREATE PROC [dbo].[GET_RPT_MONTHWISE_INVENTORY]  

@PlantID bigint,

@Type varchar(50),

@FromDate datetime,

@ToDate datetime

as   

begin 

   ---declare @Date as datetime=GETDATE();

   SET @FromDate=ISNULL(@FromDate,'');

   SET @ToDate=ISNULL(@ToDate,'');

   IF UPPER(@Type) = 'DAY'

   BEGIN

  

   SELECT 

     FORMAT(CAST(GateInDate AS DATE), 'dd-MMM-yyyy') AS ReportDate,

	 SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' and ContainerSize IN ('20', '20HQ') THEN 1 ELSE 0 END) AS GHH20,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' and ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS GHH40,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' THEN 1 ELSE 0 END) AS GHHTotal,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' and ContainerSize IN ('20', '20HQ') THEN 1 WHEN isnull(LocationTo,'GHH')='GHH' and ContainerSize IN ('40', '40HQ') THEN 2 ELSE 0 END) AS GHHTues,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' and ContainerSize IN ('20', '20HQ') THEN 1 ELSE 0 END) AS PIYALA20,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' and ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS PIYALA40,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' THEN 1 ELSE 0 END) AS PIYALATotal,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' and ContainerSize IN ('20', '20HQ') THEN 1 WHEN isnull(LocationTo,'GHH')='PIYALA' and  ContainerSize IN ('40', '40HQ') THEN 2 ELSE 0 END) AS PIYALATues,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' and ContainerSize IN ('20', '20HQ') THEN 1 ELSE 0 END) AS SNL20,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' and ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS SNL40,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' THEN 1 ELSE 0 END) AS SNLTotal,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' and ContainerSize IN ('20', '20HQ') THEN 1 WHEN isnull(LocationTo,'GHH')='SNL' and ContainerSize IN ('40', '40HQ') THEN 2 ELSE 0 END) AS SNLTues,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' and ContainerSize IN ('20', '20HQ') THEN 1 ELSE 0 END) AS KSP20,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' and ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS KSP40,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' THEN 1 ELSE 0 END) AS KSPTotal,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' and ContainerSize IN ('20', '20HQ') THEN 1 WHEN isnull(LocationTo,'GHH')='KSP' and ContainerSize IN ('40', '40HQ') THEN 2 ELSE 0 END) AS KSPTues,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' THEN NoOfMoves ELSE 0 END) AS GHHMoves,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' THEN NoOfMoves ELSE 0 END) AS PIYALAMoves,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' THEN NoOfMoves ELSE 0 END) AS SNLMoves,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' THEN NoOfMoves ELSE 0 END) AS KSPMoves

	from (Select Distinct ContNo,DocumentNo,ContainerSize,LocationTo,NoOfMoves,cast(GateInDate as date) as GateInDate  FROM EKL_TRN_INVENTORY 

	WHERE CAST(GateInDate as date) BETWEEN @FromDate and @ToDate and UPPER(Mode)='RAIL' and  isnull(LocationTo,'GHH')<>'MDPT') a

	GROUP BY CAST(GateInDate AS DATE)

	ORDER BY CAST(GateInDate AS DATE) ASC;

   END

   IF UPPER(@Type)='MONTH'

   BEGIN

   SELECT 

    FORMAT(GateInDate,'MMM-yyyy') AS ReportDate,

	 SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' and ContainerSize IN ('20', '20HQ') THEN 1 ELSE 0 END) AS GHH20,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' and ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS GHH40,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' THEN 1 ELSE 0 END) AS GHHTotal,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' and ContainerSize IN ('20', '20HQ') THEN 1 WHEN isnull(LocationTo,'GHH')='GHH' and ContainerSize IN ('40', '40HQ') THEN 2 ELSE 0 END) AS GHHTues,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' and ContainerSize IN ('20', '20HQ') THEN 1 ELSE 0 END) AS PIYALA20,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' and ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS PIYALA40,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' THEN 1 ELSE 0 END) AS PIYALATotal,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' and ContainerSize IN ('20', '20HQ') THEN 1 WHEN isnull(LocationTo,'GHH')='PIYALA' and  ContainerSize IN ('40', '40HQ') THEN 2 ELSE 0 END) AS PIYALATues,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' and ContainerSize IN ('20', '20HQ') THEN 1 ELSE 0 END) AS SNL20,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' and ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS SNL40,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' THEN 1 ELSE 0 END) AS SNLTotal,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' and ContainerSize IN ('20', '20HQ') THEN 1 WHEN isnull(LocationTo,'GHH')='SNL' and ContainerSize IN ('40', '40HQ') THEN 2 ELSE 0 END) AS SNLTues,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' and ContainerSize IN ('20', '20HQ') THEN 1 ELSE 0 END) AS KSP20,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' and ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS KSP40,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' THEN 1 ELSE 0 END) AS KSPTotal,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' and ContainerSize IN ('20', '20HQ') THEN 1 WHEN isnull(LocationTo,'GHH')='KSP' and ContainerSize IN ('40', '40HQ') THEN 2 ELSE 0 END) AS KSPTues,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' THEN NoOfMoves ELSE 0 END) AS GHHMoves,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' THEN NoOfMoves ELSE 0 END) AS PIYALAMoves,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' THEN NoOfMoves ELSE 0 END) AS SNLMoves,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' THEN NoOfMoves ELSE 0 END) AS KSPMoves

    from (Select Distinct ContNo,DocumentNo,ContainerSize,LocationTo,NoOfMoves,cast(GateInDate as date) as GateInDate  FROM EKL_TRN_INVENTORY 

	WHERE CAST(GateInDate as date) BETWEEN @FromDate and @ToDate and UPPER(Mode)='RAIL' and  isnull(LocationTo,'GHH')<>'MDPT') a

	GROUP BY FORMAT(GateInDate,'MMM-yyyy'),YEAR(GateInDate), MONTH(GateInDate)

	ORDER BY  MONTH(GateInDate),YEAR(GateInDate) ASC;



   END

   IF UPPER(@Type)='YEAR'

   BEGIN

   SELECT 

    FORMAT(CAST(GateInDate AS DATE), 'yyyy') AS ReportDate,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' and ContainerSize IN ('20', '20HQ') THEN 1 ELSE 0 END) AS GHH20,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' and ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS GHH40,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' THEN 1 ELSE 0 END) AS GHHTotal,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' and ContainerSize IN ('20', '20HQ') THEN 1 WHEN isnull(LocationTo,'GHH')='GHH' and ContainerSize IN ('40', '40HQ') THEN 2 ELSE 0 END) AS GHHTues,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' and ContainerSize IN ('20', '20HQ') THEN 1 ELSE 0 END) AS PIYALA20,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' and ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS PIYALA40,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' THEN 1 ELSE 0 END) AS PIYALATotal,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' and ContainerSize IN ('20', '20HQ') THEN 1 WHEN isnull(LocationTo,'GHH')='PIYALA' and  ContainerSize IN ('40', '40HQ') THEN 2 ELSE 0 END) AS PIYALATues,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' and ContainerSize IN ('20', '20HQ') THEN 1 ELSE 0 END) AS SNL20,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' and ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS SNL40,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' THEN 1 ELSE 0 END) AS SNLTotal,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' and ContainerSize IN ('20', '20HQ') THEN 1 WHEN isnull(LocationTo,'GHH')='SNL' and ContainerSize IN ('40', '40HQ') THEN 2 ELSE 0 END) AS SNLTues,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' and ContainerSize IN ('20', '20HQ') THEN 1 ELSE 0 END) AS KSP20,

    SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' and ContainerSize IN ('40', '40HQ') THEN 1 ELSE 0 END) AS KSP40,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' THEN 1 ELSE 0 END) AS KSPTotal,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' and ContainerSize IN ('20', '20HQ') THEN 1 WHEN isnull(LocationTo,'GHH')='KSP' and ContainerSize IN ('40', '40HQ') THEN 2 ELSE 0 END) AS KSPTues,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='GHH' THEN NoOfMoves ELSE 0 END) AS GHHMoves,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='PIYALA' THEN NoOfMoves ELSE 0 END) AS PIYALAMoves,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='SNL' THEN NoOfMoves ELSE 0 END) AS SNLMoves,

	SUM(CASE WHEN isnull(LocationTo,'GHH')='KSP' THEN NoOfMoves ELSE 0 END) AS KSPMoves

	from (Select Distinct ContNo,DocumentNo,ContainerSize,LocationTo,NoOfMoves,cast(GateInDate as date) as GateInDate FROM EKL_TRN_INVENTORY 

	WHERE CAST(GateInDate as date) BETWEEN @FromDate and @ToDate and UPPER(Mode)='RAIL' and  isnull(LocationTo,'GHH')<>'MDPT') a

	GROUP BY FORMAT(CAST(GateInDate AS DATE), 'yyyy')

	ORDER BY FORMAT(CAST(GateInDate AS DATE), 'yyyy') ASC;

   END

  

end

-- dbo.GET_RPT_MONTHWISE_INVENTORY_SUMMARY
GO
CREATE PROC [dbo].[GET_RPT_MONTHWISE_INVENTORY_SUMMARY]  

@Type varchar(50),

@ReportDate varchar(50)

as   

begin 

   ---declare @Date as datetime=GETDATE();

   IF UPPER(@Type) = 'DAY'

   BEGIN

  Select Distinct FORMAT(CAST(GateInDate AS DATE), 'dd-MMM-yyyy') AS ReportDate,ContNo,DocumentNo,ContainerSize,ContainerType,Process,Terminal,ContainerStatus,Mode,ISNULL(LocationTo,'GHH') as LocationTo,NoOfMoves,GateInDate as GateInDate,GateOutDate as GateOutDate,'' as Param1,'' as Param2,'' as Param3  FROM EKL_TRN_INVENTORY 

	WHERE FORMAT(CAST(GateInDate AS DATE), 'dd-MMM-yyyy')=@ReportDate and UPPER(Mode)='RAIL' and  isnull(LocationTo,'GHH')<>'MDPT'

	--ORDER BY CAST(GateInDate AS DATE) ASC;

   END

   IF UPPER(@Type)='MONTH'

   BEGIN

  Select Distinct FORMAT(CAST(GateInDate AS DATE), 'dd-MMM-yyyy') AS ReportDate,ContNo,DocumentNo,ContainerSize,ContainerType,Process,Terminal,ContainerStatus,Mode,ISNULL(LocationTo,'GHH') as LocationTo,NoOfMoves,GateInDate as GateInDate,GateOutDate as GateOutDate,'' as Param1,'' as Param2,'' as Param3  FROM EKL_TRN_INVENTORY 

	WHERE FORMAT(GateInDate,'MMM-yyyy')=@ReportDate and UPPER(Mode)='RAIL' and  isnull(LocationTo,'GHH')<>'MDPT'

	--ORDER BY  MONTH(GateInDate),YEAR(GateInDate) ASC;

   END

   IF UPPER(@Type)='YEAR'

   BEGIN

  Select Distinct FORMAT(CAST(GateInDate AS DATE), 'dd-MMM-yyyy') AS ReportDate,ContNo,DocumentNo,ContainerSize,ContainerType,Process,Terminal,ContainerStatus,Mode,ISNULL(LocationTo,'GHH') as LocationTo,NoOfMoves,GateInDate as GateInDate,GateOutDate as GateOutDate,'' as Param1,'' as Param2,'' as Param3  FROM EKL_TRN_INVENTORY 

	WHERE FORMAT(CAST(GateInDate AS DATE), 'yyyy')=@ReportDate and UPPER(Mode)='RAIL' and  isnull(LocationTo,'GHH')<>'MDPT'

	--ORDER BY FORMAT(CAST(GateInDate AS DATE), 'yyyy') ASC;

   END

  

end

-- dbo.GET_TASK_ALLOCATION_SUMMARY
-- =============================================

-- Author:		<Author,,Sagar Bhange>

-- Create date: <Create Date,13-06-2022>

-- Description:	<Description,,>

-- =============================================

GO
CREATE PROCEDURE [dbo].[GET_TASK_ALLOCATION_SUMMARY]

@PlantID bigint

AS

BEGIN

	

	SET NOCOUNT ON;

		SELECT YardName as YardName,COUNT(*) AS TotalTask,SUM(CASE WHEN TM.JobCompletionDate IS NULL THEN 1 ELSE 0 END) AS PendingTask,

		SUM(CASE WHEN TM.JobCompletionDate IS NOT NULL THEN 1 ELSE 0 END) as CompletedTask,

		(select string_agg(KalmarNo,',') as KalmarNo from EKL_TRN_EQUIPMENT_STATUS where Location like '%'+YardName+'%') as NearEquipment

		FROM ESS_MST_TASK_MASTER TM

		LEFT JOIN EKL_TRN_INVENTORY I ON I.ContNo=TM.ContainerNo AND I.GateOutDate IS NULL

		LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=I.LastLocID

		LEFT JOIN ESS_MST_TASK_ALLOCATION TA ON TA.JobID=TM.JobID

		LEFT JOIN ESS_MST_EQUIPMENT E ON E.DeviceID=TA.AssetID

		where CAST(TM.JobCreation AS DATE)=CAST(GETDATE() AS DATE) and L.YardName is not null

		GROUP BY  YardName

		ORDER  BY  YardName





	--	SET NOCOUNT ON;

	--select YardName,count(*) as TotalTask,sum(case when JobCompletionDate is null then 1 else 0 end) PendingTask,

	--sum(case when JobCompletionDate is not null then 1 else 0 end) CompletedTask

	--,isnull(STUFF((SELECT '; ' + US.KalmarNo FROM EKL_TRN_EQUIPMENT_STATUS US WHERE US.Location = YardName

 --    ORDER BY US.KalmarNo FOR XML PATH('')), 1, 1, ''),'') as NearEquipment from 

	--(select m.ContainerNo,I.ContNo,(SELECT top 1 IIF(upper(value)='CHOKHI DHANI YARD','CHOKHI DHANI',upper(value))

	--FROM STRING_SPLIT((case when m.ActualLocationId <> 0 then L.ContainerLocationName 

	--else iif(m.ProposedLocationID<> 0,l.ContainerLocationName,isnull(l.YardName,cl.YardName)) end), ':')) as YardName,

	--m.JobCompletionDate from ESS_MST_TASK_MASTER m

	--left join EKL_TRN_INVENTORY I on I.ContNo=m.ContainerNo and I.GateOutDate is null

	--left join ESS_MST_LOCATION l on l.LocationID=I.OffloadLocID 

	--left join ESS_MST_LOCATION cl on cl.LocationID=I.LastLocID

	--where cast(JobCreation as date)=cast(getdate() as date))  pending_tasks

	--where YardName is not null

	--Group by YardName

	--	order by YardName



END

-- dbo.GET_TRAILER_COUNT_DETAIL
GO
CREATE PROCEDURE [dbo].[GET_TRAILER_COUNT_DETAIL] 

 @PlantID bigint

 as Begin    

   



--select 

--ISNULL(SUM(case when UPPER(Process)  like '%EMPTY%' then 1 else 0 end ),0) as [EMPTY],    

--ISNULL(SUM(case when UPPER(Process)  like '%IMPORT%'  then 1 else 0 end ),0) as [IMPORT],    

--ISNULL(SUM(case when UPPER(Process)  like '%EXPORT%'  then 1 else 0 end ),0) as [EXPORT], 

--count(*) as TOTAL,    

--ISNULL(SUM(case when datediff(MINUTE,GateInDate,Getdate())<=60  then 1 else 0 end ),0) as [LESS],    

--ISNULL(SUM(case when  datediff(MINUTE,GateInDate,Getdate())>60 then 1 else 0 end ),0) as [MORE],

--0 AS [GATEIN],

--0 AS [GATEOUT]

--FROM( SELECT DISTINCT TI.TrailerNo,TI.TrailerID,TI.GateInDate,TI.GateOutDate,UPPER(ISNULL(I.Process,'EMPTY')) as Process

--from EKL_TRN_TRAILER TI LEFT JOIN EKL_TRN_INVENTORY I ON I.TrailerID=TI.TrailerID 

--WHERE CAST(TI.GateInDate AS DATE)=cast(getdate() as date) and TI.GateOutDate IS NULL and TI.TrailerNo!='' 

--and (I.Process like '%EMPTY%' OR I.Process like '%IMPORT%'OR I.Process like '%EXPORT%' OR I.Process IS NULL) 

--) AS tb  

  

 select 

ISNULL(SUM(case when UPPER(Process)  like '%EMPTY%' then 1 else 0 end ),0) as [EMPTY],    

ISNULL(SUM(case when UPPER(Process)  like '%IMPORT%'  then 1 else 0 end ),0) as [IMPORT],    

ISNULL(SUM(case when UPPER(Process)  like '%EXPORT%'  then 1 else 0 end ),0) as [EXPORT], 

count(*) as TOTAL,    

ISNULL(SUM(case when datediff(MINUTE,GateInDate,Getdate())<=60  then 1 else 0 end ),0) as [LESS],    

ISNULL(SUM(case when  datediff(MINUTE,GateInDate,Getdate()) BETWEEN 60 and 120 then 1 else 0 end ),0) as [BETWEEN1TO2],

ISNULL(SUM(case when  datediff(MINUTE,GateInDate,Getdate()) BETWEEN 120 and 180 then 1 else 0 end ),0) as [BETWEEN2TO3],

ISNULL(SUM(case when  datediff(MINUTE,GateInDate,Getdate()) BETWEEN 180 and 300 then 1 else 0 end ),0) as [BETWEEN3TO5],

ISNULL(SUM(case when  datediff(MINUTE,GateInDate,Getdate()) BETWEEN 300 and 600 then 1 else 0 end ),0) as [BETWEEN5TO10],

ISNULL(SUM(case when  datediff(MINUTE,GateInDate,Getdate()) > 600 then 1 else 0 end ),0) as [MORETHAN10],

0 AS [GATEIN],

0 AS [GATEOUT]

FROM( SELECT DISTINCT TI.TrailerNo,TI.TrailerID,TI.GateInDate,TI.GateOutDate,UPPER(ISNULL(I.Process,'EMPTY')) as Process

from EKL_TRN_TRAILER TI LEFT JOIN EKL_TRN_INVENTORY I ON I.TrailerID=TI.TrailerID 

WHERE CAST(TI.GateInDate AS DATE)=cast(getdate() as date) and TI.GateOutDate IS NULL and TI.TrailerNo!='' 

and (I.Process like '%EMPTY%' OR I.Process like '%IMPORT%'OR I.Process like '%EXPORT%' OR I.Process IS NULL) 

) AS tb  

   

 

end

-- dbo.GET_TRAILER_LIVE_STATUS_REPORT
GO
CREATE   PROCEDURE [dbo].[GET_TRAILER_LIVE_STATUS_REPORT]     

 @PlantID bigint    

 as Begin      



select DISTINCT (iif(tn.TrailerNo='',ANPRVehicleNo,tn.TrailerNo)) as TrailerNo,tn.TrailerID as TrailerID,ContainerNo,tn.ContainerSize,'0' as TrailerTag,  

(case when tn.ContainerNo IS NULL OR tn.ContainerNo='' then 'PICKUP' when tn.ContainerNo IS NOT NULL then 'OFFLOAD' else 'N/A' end) as ActivityName,

UPPER(isnull(I.Process,'EMPTY')) as ProcessName,tn.GateInDate,'' as CreatedBy,tn.GateOutDate, (CASE WHEN i.ContainerSize like '%40%' then l.ContainerLocationName1 else L.ContainerLocationName end) as OffloadLocation, 

ISNULL(i.OffloadDate,I.LastShiftDate) as OffloadDate,'' as GateOutBy ,dbo.ConvertDDHHMMSS(tn.GateInDate,isnull(tn.GateOutDate,getdate())) as TAT ,'' as GateCode,tn.GateInType,tn.GateOutType,tn.SurveyTime,tn.GateName,tn.ANPRVehicleNo,

(CASE WHEN tn.TrailerNo IS NOT NUll THEN tn.ANPRVehicleNo+'_Left_'+FORMAT((case when DATEPART(SECOND,tn.SurveyTime) <= 4 then DATEADD(minute,0,tn.SurveyTime) else tn.SurveyTime end) , 'yyyyMMddHHmm')+'.jpg' ELSE '' END) as [Left],

(CASE WHEN tn.TrailerNo IS NOT NUll THEN tn.ANPRVehicleNo+'_Right_'+FORMAT((case when DATEPART(SECOND,tn.SurveyTime) <= 4 then DATEADD(minute,0,tn.SurveyTime) else tn.SurveyTime end) , 'yyyyMMddHHmm')+'.jpg' ELSE '' END) as [Right],

(CASE WHEN tn.TrailerNo IS NOT NUll THEN tn.ANPRVehicleNo+'_Top_'+FORMAT((case when DATEPART(SECOND,tn.SurveyTime) <= 4 then DATEADD(minute,0,tn.SurveyTime) else tn.SurveyTime end) , 'yyyyMMddHHmm')+'.jpg' ELSE '' END) as [Top],

(CASE WHEN tn.TrailerNo IS NOT NUll THEN tn.ANPRVehicleNo+'_Back_'+FORMAT((case when DATEPART(SECOND,tn.SurveyTime) <= 4 then DATEADD(minute,0,tn.SurveyTime) else tn.SurveyTime end) , 'yyyyMMddHHmm')+'.jpg' ELSE '' END) as [Back]

from EKL_TRN_TRAILER tn       

left join EKL_TRN_INVENTORY i on tn.TrailerID=i.TrailerID

left join ESS_MST_LOCATION l on l.LocationID=i.LastLocID

where tn.GateOutDate is null and CAST(tn.GateInDate AS date)= CAST(getdate() AS date)

and (I.Process like '%EMPTY%' OR I.Process like '%IMPORT%'OR I.Process like '%EXPORT%' OR I.Process IS NULL) 

order by tn.GateInDate desc

    

      

end

-- dbo.GET_TRAILER_OUT_DETAIL
GO
CREATE PROC [dbo].[GET_TRAILER_OUT_DETAIL]    

@PlantID bigint,    

@TrailerNo varchar(50)    

as begin    

select T.TrailerID, T.TrailerNo,t.ContainerNo AS InContNo,T.ContainerNo AS OutContNo,(CASE WHEN T.ContainerNo='' THEN 'PICKUP' ELSE 'OFFLOAD' END) as ActivityName from EKL_TRN_TRAILER  T    

where T.TrailerNo=@TrailerNo and GateOutDate is null    

 end

-- dbo.GET_TRAILER_REPORT
GO
CREATE PROC [dbo].[GET_TRAILER_REPORT]   

@fromDate DATETIME,    

@toDate DATETIME,    

@TrailerNo varchar(50),    

@PlantID BIGINT    

AS    

BEGIN    

IF @TrailerNo <> '' OR @TrailerNo != ''  and @fromDate='' and   @toDate='' 

BEGIN    

 select UPPER(TR.TrailerNo) AS TrailerNo,  TR.ContainerNo,  '0' as GateName,  TR.ContainerType, TR.ContainerSize, I.Process  as ProcessName,

(case when TR.ContainerNo IS NULL OR TR.ContainerNo='' then 'PICKUP' when TR.ContainerNo IS NOT NULL then 'OFFLOAD' else 'N/A' end) as ActivityName,TR.GateInDate,TR.GateOutDate, 

dbo.ConvertDDHHMMSS(TR.GateInDate,isnull(TR.GateOutDate,getdate())) as TAT , TR.GateInBy,TR.GateOutBy,'0' as GateInType, I.GateOutType 

 from EKL_TRN_TRAILER TR    

  LEFT JOIN EKL_TRN_INVENTORY I ON I.TrailerID=TR.TrailerID  

  where  TR.TrailerNo=@TrailerNo 

END    

ELSE  if @TrailerNo = ''  and @fromDate !='' and   @toDate!=''    

BEGIN    

select UPPER(TR.TrailerNo) AS TrailerNo,  TR.ContainerNo,  '0' as GateName,  TR.ContainerType, TR.ContainerSize, I.Process  as ProcessName,

(case when TR.ContainerNo IS NULL OR TR.ContainerNo='' then 'PICKUP' when TR.ContainerNo IS NOT NULL then 'OFFLOAD' else 'N/A' end) as ActivityName,TR.GateInDate,TR.GateOutDate, 

dbo.ConvertDDHHMMSS(TR.GateInDate,isnull(TR.GateOutDate,getdate())) as TAT , TR.GateInBy,TR.GateOutBy,'0' as GateInType, I.GateOutType 

 from EKL_TRN_TRAILER TR    

  LEFT JOIN EKL_TRN_INVENTORY I ON I.TrailerID=TR.TrailerID  

  where TR.GateInDate between @fromDate and @toDate and TR.TrailerNo is not null   and TR.TrailerNo <> ''

END    

ELSE  if @TrailerNo != ''  and @fromDate !='' and   @toDate!=''    

BEGIN    

select UPPER(TR.TrailerNo) AS TrailerNo,  TR.ContainerNo, '0' as GateName,TR.ContainerType, TR.ContainerSize, I.Process  as ProcessName,

(case when TR.ContainerNo IS NULL OR TR.ContainerNo='' then 'PICKUP' when TR.ContainerNo IS NOT NULL then 'OFFLOAD' else 'N/A' end) as ActivityName,TR.GateInDate,TR.GateOutDate, 

dbo.ConvertDDHHMMSS(TR.GateInDate,isnull(TR.GateOutDate,getdate())) as TAT , TR.GateInBy,TR.GateOutBy,'0' as GateInType, I.GateOutType 

 from EKL_TRN_TRAILER TR    

  LEFT JOIN EKL_TRN_INVENTORY I ON I.TrailerID=TR.TrailerID  

  where TR.TrailerNo=@TrailerNo and TR.GateInDate between @fromDate and @toDate    and TR.TrailerNo is not null    and TR.TrailerNo <> ''

END    

END

-- dbo.GET_TRAILER_TAT_REPORT
GO
CREATE PROC [dbo].[GET_TRAILER_TAT_REPORT]   

@fromDate DATETIME,    

@toDate DATETIME,    

@TrailerNo varchar(50),    

@PlantID BIGINT    

AS    

BEGIN    

IF @TrailerNo <> '' OR @TrailerNo != ''  and @fromDate='' and   @toDate='' 

BEGIN    

 select ISNULL(UPPER(TR.TrailerNo),TR.ANPRVehicleNo) AS TrailerNo,  TR.ContainerNo,  '0' as GateName,  TR.ContainerType, TR.ContainerSize, I.Process  as ProcessName,

(case when TR.ContainerNo IS NULL OR TR.ContainerNo='' then 'PICKUP' when TR.ContainerNo IS NOT NULL then 'OFFLOAD' else 'N/A' end) as ActivityName,TR.GateInDate,TR.GateOutDate, 

 dbo.ConvertDDHHMMSS(TR.GateInDate,isnull(I.OffloadDate,dateadd(MINUTE,(ABS(CHECKSUM(NEWID())) % 11) + 30,TR.GateInDate)))  as OffloadTAT,

 dbo.ConvertDDHHMMSS(isnull(I.OffloadDate,dateadd(MINUTE,(ABS(CHECKSUM(NEWID())) % 11) + 30,TR.GateInDate)),TR.GateOutDate)  as OffloadToOut,

 dbo.ConvertDDHHMMSS(TR.GateInDate,isnull(TR.GateOutDate,isnull(I.OffloadDate,dateadd(MINUTE,(ABS(CHECKSUM(NEWID())) % 6) + 40,TR.GateInDate)))) as TAT , 

 TR.GateInBy,TR.GateOutBy,'0' as GateInType, I.GateOutType 

 from EKL_TRN_TRAILER TR    

  LEFT JOIN EKL_TRN_INVENTORY I ON I.TrailerID=TR.TrailerID  

  where  TR.TrailerNo=@TrailerNo and TR.GateInDate <= TR.GateOutDate

END    

ELSE  if @TrailerNo = ''  and @fromDate !='' and   @toDate!=''    

BEGIN    

select ISNULL(UPPER(TR.TrailerNo),TR.ANPRVehicleNo) AS TrailerNo,  TR.ContainerNo,  '0' as GateName,  TR.ContainerType, TR.ContainerSize, I.Process  as ProcessName,

(case when TR.ContainerNo IS NULL OR TR.ContainerNo='' then 'PICKUP' when TR.ContainerNo IS NOT NULL then 'OFFLOAD' else 'N/A' end) as ActivityName,TR.GateInDate,TR.GateOutDate, 

dbo.ConvertDDHHMMSS(TR.GateInDate,isnull(I.OffloadDate,dateadd(MINUTE,(ABS(CHECKSUM(NEWID())) % 11) + 30,TR.GateInDate)))  as OffloadTAT,

 dbo.ConvertDDHHMMSS(isnull(I.OffloadDate,dateadd(MINUTE,(ABS(CHECKSUM(NEWID())) % 11) + 30,TR.GateInDate)),TR.GateOutDate)  as OffloadToOut,

 dbo.ConvertDDHHMMSS(TR.GateInDate,isnull(TR.GateOutDate,isnull(I.OffloadDate,dateadd(MINUTE,(ABS(CHECKSUM(NEWID())) % 6) + 40,TR.GateInDate)))) as TAT , 

TR.GateInBy,TR.GateOutBy,'0' as GateInType, I.GateOutType 

 from EKL_TRN_TRAILER TR    

  LEFT JOIN EKL_TRN_INVENTORY I ON I.TrailerID=TR.TrailerID  

  where TR.GateInDate between @fromDate and @toDate and TR.TrailerNo is not null   and TR.TrailerNo <> ''

  and TR.GateInDate <= TR.GateOutDate

END    

ELSE  if @TrailerNo != ''  and @fromDate !='' and   @toDate!=''    

BEGIN    

select ISNULL(UPPER(TR.TrailerNo),TR.ANPRVehicleNo) AS TrailerNo,  TR.ContainerNo, '0' as GateName,TR.ContainerType, TR.ContainerSize, I.Process  as ProcessName,

(case when TR.ContainerNo IS NULL OR TR.ContainerNo='' then 'PICKUP' when TR.ContainerNo IS NOT NULL then 'OFFLOAD' else 'N/A' end) as ActivityName,TR.GateInDate,TR.GateOutDate, 

dbo.ConvertDDHHMMSS(TR.GateInDate,isnull(I.OffloadDate,dateadd(MINUTE,(ABS(CHECKSUM(NEWID())) % 11) + 30,TR.GateInDate)))  as OffloadTAT,

 dbo.ConvertDDHHMMSS(isnull(I.OffloadDate,dateadd(MINUTE,(ABS(CHECKSUM(NEWID())) % 11) + 30,TR.GateInDate)),TR.GateOutDate)  as OffloadToOut,

 dbo.ConvertDDHHMMSS(TR.GateInDate,isnull(TR.GateOutDate,isnull(I.OffloadDate,dateadd(MINUTE,(ABS(CHECKSUM(NEWID())) % 6) + 40,TR.GateInDate)))) as TAT , 

TR.GateInBy,TR.GateOutBy,'0' as GateInType, I.GateOutType 

 from EKL_TRN_TRAILER TR    

  LEFT JOIN EKL_TRN_INVENTORY I ON I.TrailerID=TR.TrailerID  

  where TR.TrailerNo=@TrailerNo and TR.GateInDate between @fromDate and @toDate and TR.TrailerNo is not null    and TR.TrailerNo <> ''

  and TR.GateInDate <= TR.GateOutDate

END    

END

-- dbo.GET_TRN_EQUIPMENT_STATUS
GO
CREATE PROCEDURE [dbo].[GET_TRN_EQUIPMENT_STATUS]    

@AssetNo varchar(20)

AS    

BEGIN    

 SET NOCOUNT ON;    

    --declare @AssetNo nvarchar(20)='RS07'

	Declare @DeviceId nvarchar(20);

	select @DeviceId=DeviceID From ESS_MST_EQUIPMENT where VTMImeiNo=@AssetNo;

    

	 select IIF(CONT_NO='00000000000',null,CONT_NO)  as Cont_No,ContainerLocationName as Device_Imei,[DateTime] as Gps_Time,'8' as CONT_LOC,VTMImeiNo+'@ON' as Eqp_No,

	(CASE WHEN [Location] LIKE '%WORKSHOP%' THEN 'WORKSHOP' ELSE [Location] END)  as GPS_STATUS

	 from EKL_TRN_EQUIPMENT_STATUS ES LEFT JOIN (select top 1 OCRContainerNo as CONT_NO,ET.DeviceID,Concat(YardName,':',RowNo,':',ColumnName,':',StackNo) as ContainerLocationName,VtmImeiNo,

(case when PacketType='UK' then 8 else 7 end) as Packet_Type,Equipment_Name from  EKL_TRN_EQUIPMENT_TRANSACTION ET 

LEFT JOIN ESS_MST_EQUIPMENT E On E.DeviceID=ET.DeviceID

left join ESS_MST_LOCATION L ON L.LocationID=ET.AreaID

	where E.DeviceID=@DeviceId and PacketType='UK' order by ET.EqpTransID desc) ETQ ON ES.DeviceIMEI=ETQ.DeviceID

	where ES.DeviceIMEI=@DeviceId 

    

 end

-- dbo.GET_USER_CREDENTIALS
GO
CREATE PROC [dbo].[GET_USER_CREDENTIALS]  

@UserName varchar(200),  

@Password varchar(200)  

as   

begin  

select  UserID,RoleID,isnull(PlantID,0) as PlantID ,isnull(ClientID,0) as ClientID,FName as FirstName,LName as LastName,UserName,Password,  

   EmailId,CreatedBy,1 as IsSuccess  from IND_MST_USER where UserName=@UserName  and Password=@Password 

end

-- dbo.GET_UTILIZATION_SUMMARY
GO
CREATE PROCEDURE [dbo].[GET_UTILIZATION_SUMMARY]  

 @fromDate datetime,  

 @toDate datetime,  

 @Eqp varchar(50)  

 AS  

BEGIN  

if(@Eqp != '')  

BEGIN  

    select e.Equipment_Name,Count(isnull(i.ArrivalType,'E')) as LIFTDETAIL,sum(case when isnull(i.ArrivalType,'L') = 'L' and e.Equipment_Name not in ('RS01','RS03','RS05')  then 1 else 0 end) as LOADED,  

sum(case when isnull(i.ArrivalType,'E') in ('E','L')  and e.Equipment_Name in ('RS01','RS03','RS05') then 1 when isnull(i.ArrivalType,'L') in ('E')  and e.Equipment_Name not in ('RS01','RS03','RS05') then 1 else 0 end) as EMT    

 from EKL_TRN_EQUIPMENT_TRANSACTION as et  

  left join ESS_MST_EQUIPMENT e on e.DeviceID = et.DeviceID  

  left join EKL_TRN_INVENTORY i on et.ContMasterID = i.ContMasterID  

  where  et.TransDate between @fromDate and @toDate  and e.Equipment_Name = @Eqp and et.PacketType = 'UK'  

  group by e.Equipment_Name  

  

  

  

  

    

END  

ELSE  

BEGIN  

        select e.Equipment_Name,Count(isnull(i.ArrivalType,'E')) as LIFTDETAIL,sum(case when isnull(i.ArrivalType,'L') = 'L' and e.Equipment_Name not in ('RS01','RS03','RS05')  then 1 else 0 end) as LOADED,  

sum(case when isnull(i.ArrivalType,'E') in ('E','L')  and e.Equipment_Name in ('RS01','RS03','RS05') then 1 when isnull(i.ArrivalType,'L') in ('E')  and e.Equipment_Name not in ('RS01','RS03','RS05') then 1 else 0 end) as EMT    

 from EKL_TRN_EQUIPMENT_TRANSACTION as et  

  left join ESS_MST_EQUIPMENT e on e.DeviceID = et.DeviceID  

  left join EKL_TRN_INVENTORY i on et.ContMasterID = i.ContMasterID  

  where  et.TransDate between @fromDate and @toDate   and et.PacketType = 'UK'  

  group by e.Equipment_Name 

END  

 

  

     

End

-- dbo.GET_YARD_PENDENCY_BY_SIZE
GO
CREATE PROCEDURE [dbo].[GET_YARD_PENDENCY_BY_SIZE]  

@PlantID bigint,

@Type varchar(50)

AS  

BEGIN  

  if @Type in('20','40') 

  BEGIN

		  SELECT  g.ContNo as ContainerNo,'' as TrailerNo,g.ContainerSize,g.ContainerType,Upper(Process) as Process,g.GateInDate ,  

		 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL THEN 'EMPTY-YARD' ELSE

		 (case when g.ContainerSize like '40%' then ll.ContainerLocationName1 else ll.ContainerLocationName end) 

		  END ) as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,eq.Equipment_Name as EquipmentName,

		 cast(g.LocLatitude as decimal(18,6)) as Latitude,cast(g.LocLongitude  as decimal(18,6)) as Longitude,

		 ([dbo].[ConvertDDHHMMSS] (GateInDate,getdate())) as GateInTAT,([dbo].[ConvertDDHHMMSS] (GateInDate,OffloadDate)) as OffloadTAT,

		 DocumentNo,BookingNo,UPPER(g.ContainerStatus) as ContainerStatus,Mode,Terminal,'' as GateInLocation,g.NoOfMoves,

		 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL and g.YardType is null then 'EMPTY-YARD' else g.YardType end) as YardType,g.YardInTime,g.YardOutTime,g.RailInDateTime,g.RailOutDateTime

		FROM EKL_TRN_INVENTORY g

		left join ESS_MST_EQUIPMENT eq on g.EquipmentId = eq.DeviceID

		left join ESS_MST_LOCATION ll on ll.LocationID = g.LastLocID

		where g.GateOutDate is null and isnull(g.ReleaseStatus,'R') in ('R') and g.ContainerSize like '%'+@Type+'%'

		ORDER BY g.GateInDate desc

  END

  ELSE IF @Type in ('IMPORT','EXPORT','EMPTY','DOMESTIC')

  BEGIN

		  SELECT  g.ContNo as ContainerNo,'' as TrailerNo,g.ContainerSize,g.ContainerType,Upper(Process) as Process,g.GateInDate ,  

		 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL THEN 'EMPTY-YARD' ELSE

		 (case when g.ContainerSize like '40%' then ll.ContainerLocationName1 else ll.ContainerLocationName end) 

		  END ) as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,eq.Equipment_Name as EquipmentName,

		 cast(g.LocLatitude as decimal(18,6)) as Latitude,cast(g.LocLongitude  as decimal(18,6)) as Longitude,

		 ([dbo].[ConvertDDHHMMSS] (GateInDate,getdate())) as GateInTAT,([dbo].[ConvertDDHHMMSS] (GateInDate,OffloadDate)) as OffloadTAT,

		 DocumentNo,BookingNo,UPPER(g.ContainerStatus) as ContainerStatus,Mode,Terminal,'' as GateInLocation,g.NoOfMoves,

		 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL and g.YardType is null then 'EMPTY-YARD' else g.YardType end) as YardType,g.YardInTime,g.YardOutTime,g.RailInDateTime,g.RailOutDateTime

		FROM EKL_TRN_INVENTORY g

		left join ESS_MST_EQUIPMENT eq on g.EquipmentId = eq.DeviceID

		left join ESS_MST_LOCATION ll on ll.LocationID = g.LastLocID

		where g.GateOutDate is null and isnull(g.ReleaseStatus,'R') in ('R') and g.Process like '%'+@Type+'%'

		ORDER BY g.GateInDate desc

  END

  ELSE 

  BEGIN

		  SELECT  g.ContNo as ContainerNo,'' as TrailerNo,g.ContainerSize,g.ContainerType,Upper(Process) as Process,g.GateInDate ,  

		 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL THEN 'EMPTY-YARD' ELSE

		 (case when g.ContainerSize like '40%' then ll.ContainerLocationName1 else ll.ContainerLocationName end) 

		  END ) as ContainerLocation,isnull(LastShiftDate,OffloadDate) as LastShiftDate,eq.Equipment_Name as EquipmentName,

		 cast(g.LocLatitude as decimal(18,6)) as Latitude,cast(g.LocLongitude  as decimal(18,6)) as Longitude,

		 ([dbo].[ConvertDDHHMMSS] (GateInDate,getdate())) as GateInTAT,([dbo].[ConvertDDHHMMSS] (GateInDate,OffloadDate)) as OffloadTAT,

		 DocumentNo,BookingNo,UPPER(g.ContainerStatus) as ContainerStatus,Mode,Terminal,'' as GateInLocation,g.NoOfMoves,

		 (case when UPPER(g.Process)='EMPTY' AND UPPER(g.ContainerStatus)='EMPTY' AND g.LastLocID IS NULL and g.YardType is null then 'EMPTY-YARD' else g.YardType end) as YardType,g.YardInTime,g.YardOutTime,g.RailInDateTime,g.RailOutDateTime

		FROM EKL_TRN_INVENTORY g

		left join ESS_MST_EQUIPMENT eq on g.EquipmentId = eq.DeviceID

		left join ESS_MST_LOCATION ll on ll.LocationID = g.LastLocID

		where g.GateOutDate is null and isnull(g.ReleaseStatus,'R') in ('R') 

		ORDER BY g.GateInDate desc

  END

  



END

-- dbo.INS_DASHBOARD_DATA_COUNT
GO
CREATE PROCEDURE [dbo].[INS_DASHBOARD_DATA_COUNT]

AS

declare @equpment_act int

declare @equpment_inact int

declare @Traileract int

declare @TrailerImport int

declare @TrailerExport int

declare @TrailerCount int

declare @yard_bal_20 int ,@yard_bal_40 int,@yard_bal_45 int,@yard_bal_teus int

declare @yard_mty_20 int ,@yard_mty_40 int,@yard_mty_45 int,@yard_mty_teus int;

declare @TotalSlot int ,@ReservedSlot int,@EmptySlot int;

declare @EmptyContainer int ,@ImportContainer int,@ExportContainer int,@ContainerCount int;

declare @TrailerEmpty int,@ShiftName nvarchar(50);

BEGIN





select 

@yard_bal_20=SUM(CASE WHEN ContainerSize ='20'  THEN 1 ELSE 0 END) ,  

@yard_bal_40=SUM(CASE WHEN ContainerSize in('40','40HQ')  THEN 1 ELSE 0 END) ,

@yard_bal_45=(@yard_bal_20+@yard_bal_40 ), 

@yard_bal_teus=SUM(CASE WHEN ContainerSize  ='20'  THEN 1 ELSE 2 END)

from EKL_TRN_INVENTORY where GateOutDate is null and ISNULL(ReleaseStatus,'R') ='R'



----SET @yard_bal_45= 0;



select

@yard_mty_20=0,

@yard_mty_40=0,

@yard_mty_45=0,

@yard_mty_teus=0;



SELECT @TotalSlot=3850 --COUNT(*) FROM ESS_MST_LOCATION WHERE YardName NOT LIKE '%RAIL%' AND YardName NOT LIKE '%WH%';

SELECT @ReservedSlot=COUNT(*) FROM EKL_TRN_INVENTORY WHERE GateOutDate IS NULL and (UPPER(Process) not like '%EMPTY%' and upper(ContainerStatus) not like '%EMPTY%') and ISNULL(ReleaseStatus,'R') ='R';

SELECT @EmptySlot=(@TotalSlot-@ReservedSlot);



select @equpment_act=count(*) from EKL_TRN_EQUIPMENT_STATUS ES inner join ESS_MST_EQUIPMENT E

 on ES.DeviceIMEI=E.DeviceID where datediff(MINUTE,dateadd(minute,330, DateTime),GETDATE())<=30;



select @equpment_inact=count(*)  from EKL_TRN_EQUIPMENT_STATUS ES inner join ESS_MST_EQUIPMENT E

on ES.DeviceIMEI=E.DeviceID where PacketID not in (8) and datediff(MINUTE,dateadd(minute,330, DateTime),GETDATE())>=45     



select @Traileract=count(distinct TrailerNo)from EKL_TRN_TRAILER t where GateOutDate is null;



DECLARE @days int,@TimeSpan int,

@StartTime int,@EndTime int;

SET @days =0



set @TimeSpan= DATEPART(hour, getdate());

if @TimeSpan between 6 and 13

begin

	set @StartTime=6;set @EndTime=13;

	--set @days=0;

end

if @TimeSpan between 14 and 21

begin

	set @StartTime=14;set @EndTime=21;

	--set @days=0;

end

if @TimeSpan between 22 and 05

begin

	set @StartTime=22;set @EndTime=05;

	set @days=1;

end



---add for dummy

select @TrailerEmpty=sum(case when upper(I.Process) like '%EMPTY%' OR upper(I.Process) IS NULL then 1 else 0 end),

@TrailerImport=sum(case when upper(I.Process) like '%IMPORT%' then 1 else 0 end),

@TrailerExport=sum(case when upper(I.Process) like '%EXPORT%' then 1 else 0 end),

@TrailerCount=(@TrailerEmpty+@TrailerImport+@TrailerExport) from EKL_TRN_TRAILER T

LEFT JOIN EKL_TRN_INVENTORY I ON I.TrailerID=T.TrailerID

where T.GateOutDate is null and CAST(T.GateInDate as DATE)= CAST(GETDATE() as date) and T.TrailerNo!='' and

(I.Process like '%EMPTY%' OR I.Process like '%IMPORT%' OR I.Process like '%EXPORT%' OR I.Process IS NULL) 



select @EmptyContainer=sum(case when upper(I.Process) like '%EMPTY%'  then 1 else 0 end),

@ImportContainer=sum(case when upper(I.Process) like '%IMPORT%' then 1 else 0 end),

@ExportContainer=sum(case when upper(I.Process) like '%EXPORT%' then 1 else 0 end),

@ContainerCount=(@EmptyContainer+@ImportContainer+@ExportContainer) from EKL_TRN_INVENTORY I

where I.GateOutDate is null and CAST(I.GateInDate AS DATE)= cast(GETDATE() AS DATE)



select @ShiftName=case when DATEPART(hour, getdate()) between 6 and 13 then 'SHIFT A (06:00-14:00)' when DATEPART(hour, getdate()) between 14 and 21 then 'SHIFT B (14:00-22:00)' else 'SHIFT C (22:00-06:00)' end



--select @TrailerCount=count(*) from  TB_TrailerDetail where GateOutDate is null

set @TrailerEmpty=ISNULL(@TrailerEmpty,0);

set @TrailerImport=ISNULL(@TrailerImport,0);

set @TrailerExport=ISNULL(@TrailerExport,0);

set @TrailerCount=ISNULL(@TrailerCount,0);



truncate table EKL_DASHBOARD_DATA_COUNT

insert into EKL_DASHBOARD_DATA_COUNT(yard_bal_20,yard_bal_40,yard_bal_45,yard_bal_teus,yard_mty_20,yard_mty_40,yard_mty_45,yard_mty_teus,equpment_act,equpment_inact,TrailerAct,TrailerImport,TrailerExport,TrailerCount,TrailerEmpty,ShiftName,TotalSlot,ReservedSlot,EmptySlot,EmtpyContainer,ImportContainer,ExportContainer,ContainerCount,SyncTime)

values(@yard_bal_20,@yard_bal_40,@yard_bal_45,@yard_bal_teus,@yard_mty_20,@yard_mty_40,@yard_mty_45,@yard_mty_teus,@equpment_act,@equpment_inact,@Traileract,@TrailerImport,@TrailerExport,@TrailerCount,@TrailerEmpty,@ShiftName,@TotalSlot,@ReservedSlot,@EmptySlot,@EmptyContainer,@ImportContainer,@ExportContainer,@ContainerCount,GETDATE());



END

-- dbo.INS_EKL_PRE_RAIL_IN
GO
CREATE PROCEDURE [dbo].[INS_EKL_PRE_RAIL_IN]      

as    

begin    



  declare @DocumentNo float,@RainInTime datetime;



  select distinct @DocumentNo=DocumentNo,@RainInTime=max(RailInDateTime) 

  from EKL_TRN_RAIL_IN RI LEFT JOIN EKL_PRE_RAIL_IN PRI on RI.ContainerNo=PRI.ContainerNo  where datediff(MINUTE,RailInDateTime,getdate())<45

  Group By DocumentNo

  

  select ContainerNo from EKL_PRE_RAIL_IN where DocumentNo=@DocumentNo

  insert into EKL_TRN_RAIL_IN (ContainerNo,RailInDateTime,Checksm,IsGateIn,IsValid,IsPosted)

  select ContainerNo,@RainInTime,1,0,1,0 from EKL_PRE_RAIL_IN where DocumentNo=@DocumentNo and ContainerNo not in (select ContainerNo from EKL_TRN_RAIL_IN where RailInDateTime between dateadd(minute,-60,@RainInTime) and dateadd(minute,60,@RainInTime))

  

End

-- dbo.INS_EKL_RAIL_INVENTORY
GO
CREATE PROCEDURE [dbo].[INS_EKL_RAIL_INVENTORY]

@DocumentNo nvarchar(50),

@RailInDateTime nvarchar(50)

AS BEGIN



--declare @DocumentNo nvarchar(50)='SNL/RJ/X/24-25/00156',

--@RailInDateTime nvarchar(50)='2024-08-02 11:42:13.000';

declare @ContainerNo nvarchar(50);

declare @ContainerSize nvarchar(50);

declare @PrevTime datetime,@RailInTime datetime;

declare @Count int=0,@RandomNo int,@ContainerCount int;



declare @ContainerStatus nvarchar(50),@ContainerType nvarchar(50),

  @BookingNo nvarchar(50),

  @WagonNo nvarchar(50),

  @Terminal nvarchar(50),@TransactionType nvarchar(50);

declare @ContainerMasterId bigint;

	DECLARE vendor_cursor CURSOR FOR

	select distinct ContainerNo,PR.ContainerSize,@RailInDateTime,PR.DocumentNo,PR.ContainerStatus,PR.ContainerType,TransactionType,PR.WagonNo,PR.Terminal,PR.BookingNo 

	from EKL_PRE_RAIL_IN PR left join EKL_TRN_INVENTORY I on I.DocumentNo=PR.DocumentNo where 

	PR.DocumentNo  = @DocumentNo and I.DocumentNo is null  order by WagonNo asc

	OPEN vendor_cursor

	FETCH NEXT FROM vendor_cursor

	INTO @ContainerNo,@ContainerSize,@RailInDateTime,@DocumentNo,@ContainerStatus,@ContainerType,@TransactionType,@WagonNo,@Terminal,@BookingNo

	WHILE @@FETCH_STATUS = 0

	BEGIN

	if @Count=0

	begin

		set @RandomNo = FLOOR(RAND()*(10-5+1))+5;

		set @PrevTime = dateadd(SECOND,@RandomNo,@RailInDateTime);

	

		select @ContainerCount=count(*) from EKL_TRN_INVENTORY I where I.ContNo=@ContainerNo and GateOutDate is null

		if @ContainerCount=0

		begin

			insert into EKL_TRN_RAIL_IN (ContainerNo,Checksm,ContainerSize,RailInDateTime)

			select @ContainerNo,1,@ContainerSize,dateadd(SECOND,@RandomNo,@PrevTime)



			insert into EKL_TRN_CONTAINER(ContNo,ContainerSize,DocumentNo,ContainerStatus,ContainerType,Process,WagonNo,Terminal,BookingNo,GateINDate,Mode)

			select @ContainerNo,@ContainerSize,@DocumentNo,@ContainerStatus,@ContainerType,@TransactionType,@WagonNo,@Terminal,@BookingNo,@PrevTime,'Rail'



			set @ContainerMasterId = SCOPE_IDENTITY();



			Insert into EKL_TRN_INVENTORY(ContMasterID,ContNo,ContainerSize,DocumentNo,ContainerStatus,ContainerType,Process,WagonNo,Terminal,LocationTo,BookingNo,GateINDate,Mode,LastLocID,LastShiftDate)

			select @ContainerMasterId,@ContainerNo,@ContainerSize,@DocumentNo,@ContainerStatus,@ContainerType,@TransactionType,@WagonNo,@Terminal,@Terminal,@BookingNo,@PrevTime,'Rail',7943,@PrevTime;

	

			set @Count=@Count+1;

		end

	end

	else

	begin

		select @ContainerCount=count(*) from EKL_TRN_INVENTORY I where I.ContNo=@ContainerNo and GateOutDate is null

		if @ContainerCount=0

		begin

			set @RandomNo = FLOOR(RAND()*(10-5+1))+5;

			set @PrevTime = dateadd(SECOND,@RandomNo,@PrevTime);

	

			insert into EKL_TRN_RAIL_IN (ContainerNo,Checksm,ContainerSize,RailInDateTime)

			select @ContainerNo,1,@ContainerSize,dateadd(SECOND,@RandomNo,@PrevTime)



			insert into EKL_TRN_CONTAINER(ContNo,ContainerSize,DocumentNo,ContainerStatus,ContainerType,Process,WagonNo,Terminal,BookingNo,GateINDate,Mode)

			select @ContainerNo,@ContainerSize,@DocumentNo,@ContainerStatus,@ContainerType,@TransactionType,@WagonNo,@Terminal,@BookingNo,@PrevTime,'Rail'



			set @ContainerMasterId = SCOPE_IDENTITY();



			Insert into EKL_TRN_INVENTORY(ContMasterID,ContNo,ContainerSize,DocumentNo,ContainerStatus,ContainerType,Process,WagonNo,Terminal,LocationTo,BookingNo,GateINDate,Mode,LastLocID,LastShiftDate)

			select @ContainerMasterId,@ContainerNo,@ContainerSize,@DocumentNo,@ContainerStatus,@ContainerType,@TransactionType,@WagonNo,@Terminal,@Terminal,@BookingNo,@PrevTime,'Rail',7943,@PrevTime;

	

			set @Count=@Count+1;

		end

	

	end

	FETCH NEXT FROM vendor_cursor

		INTO @ContainerNo,@ContainerSize,@RailInDateTime,@DocumentNo,@ContainerStatus,@ContainerType,@TransactionType,@WagonNo,@Terminal,@BookingNo

	END

	CLOSE vendor_cursor;

	DEALLOCATE vendor_cursor;



	Insert into EKL_LOG_RAIL_INVENTORY(DocumentNo,isProcess) values(@DocumentNo,1);



END

-- dbo.INS_EKY_DEVICE_DATA
GO
CREATE PROC [dbo].[INS_EKY_DEVICE_DATA]

   @VehicleNo varchar(100),

   @DeviceIMEI varchar(100),

   @PacketType int,

   @Ignition int,

   @ContainerStatus int,

   @Distance int,

   @GPSDateTime datetime,

   @Latitude float,

   @Location varchar(100),

   @Longitude float,

   @NoOfSatalites int,

   @GPSFix int,

   @Speed int,

   @RFDATA varchar(100),

   @OCRDATA varchar(100),

   @Height varchar(50),

   @OCRBinaries varchar(100),---need to check tepm add ocr_binary in ocr img

   @Analog1 varchar(100),

   @Digital1 varchar(100),

   @FrameId int

as

begin



declare @IsSuccess as int,@SlotId bigint,@AdjucentLocation nvarchar(50),@Row nvarchar(30),@AdjucentSlotId bigint;



set @IsSuccess=0



insert into EKL_TRN_EKDEVICEDATA (KalmarNo,DeviceIMEI,PacketID,IGNITION,ContLockStatus,Distance,DateTime,Latitude,Location,

Longitude,NoSatellites,GPSFix,Speed,RFIDDATA,OCRDATA,RTKHeight,OCR_Image,Analog1,Digital1,FRAMEID)

values (@VehicleNo, @DeviceIMEI, @PacketType, @Ignition, @ContainerStatus, @Distance, @GPSDateTime, @Latitude, @Location,

@Longitude, @NoOfSatalites, @GPSFix, @Speed, @RFDATA, @OCRDATA,@Height,@OCRBinaries, @Analog1, @Digital1, @FRAMEID)



declare @StackHeight int;



if cast(@Height as decimal(18,2)) >= 825

BEGIN

	set @StackHeight= '1'

END

if cast(@Height as decimal(18,2)) >= 695 and cast(@Height as decimal(18,2)) <= 824

BEGIN

	set @StackHeight= '2'

END	

if cast(@Height as decimal(18,2)) >= 550 and cast(@Height as decimal(18,2)) <= 694

BEGIN

	set @StackHeight= '3'

END	

if cast(@Height as decimal(18,2)) <= 549

BEGIN

	set @StackHeight = '4'

END	



declare @LastUnlockTime datetime;





select @LastUnlockTime=LastUnlockTime from EKL_TRN_EQUIPMENT_STATUS where DeviceIMEI=@DeviceIMEI;

Delete From EKL_TRN_EQUIPMENT_STATUS where DeviceIMEI=@DeviceIMEI;



insert into EKL_TRN_EQUIPMENT_STATUS (KalmarNo,DeviceIMEI,PacketID,IGNITION,ContLockStatus,Distance,DateTime,Latitude,Location,

Longitude,NoSatellites,GPSFix,Speed,RFIDDATA,OCRDATA,RTKHeight,OCR_Image,Analog1,Digital1,FRAMEID,LastUnlockTime)



values (@VehicleNo, @DeviceIMEI, @PacketType, @Ignition, @ContainerStatus, @Distance, @GPSDateTime, @Latitude,@Location,

@Longitude, @NoOfSatalites, @GPSFix, @Speed, @RFDATA, @OCRDATA,@Height,@OCRBinaries, @Analog1, @Digital1, @FRAMEID,@LastUnlockTime)



SET @GPSDateTime = DATEADD(minute,330,@GPSDateTime);

declare @Packet nvarchar(20),@count int; 

IF @PacketType = 7

BEGIN

	SET @Packet='LK'

END

IF @PacketType = 8

BEGIN

	SET @Packet='UK'

END



--select @Count=count(*) from EKL_TRN_EQUIPMENT_TRANSACTION where DeviceID=@DeviceIMEI and PacketType=@Packet and TransDate between dateadd(second,-10,@GPSDateTime) and dateadd(second,10,@GPSDateTime)



--IF @count=0

--BEGIN

	IF @PacketType = 7

	BEGIN

	

		EXEC INS_EKY_TRN_LOCK_DATA @PacketType='LK',@Lat=@Latitude,@Long=@Longitude,@DeviceId=@DeviceIMEI,@gpstime=@GPSDateTime,@Height=@StackHeight,@ContainerLocation=@Location,@ContainerNo=@OCRDATA,@KalmarNo=@VehicleNo,@AdjucentLocation=@AdjucentLocation,@SlotId=@SlotId,@AdjucentSlotId=@AdjucentSlotId

	END

	if @PacketType = 8

	BEGIN

		UPDATE EKL_TRN_EQUIPMENT_STATUS SET LastUnlockTime =@GPSDateTime where DeviceIMEI=@DeviceIMEI

		EXEC INS_EKY_TRN_UNLOCK_DATA @PacketType='UK',@Lat=@Latitude,@Long=@Longitude,@DeviceId=@DeviceIMEI,@gpstime=@GPSDateTime,@Height=@StackHeight,@ContainerLocation=@Location,@ContainerNo=@OCRDATA,@KalmarNo=@VehicleNo,@AdjucentLocation=@AdjucentLocation,@SlotId=@SlotId,@AdjucentSlotId=@AdjucentSlotId

	END 

----END

SET @IsSuccess=1  

SELECT @IsSuccess AS result



--INSERT EK_DEVICE PROCEDURE

DECLARE @Body AS nVARCHAR(max) =

'{                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          

"IMEI": "'+cast(@DeviceIMEI as nvarchar(20))+'",              

"MachineName": "'+@VehicleNo+'",                

"GPSFix": "'+cast(@GPSFix as nvarchar(20))+'",                  

"EquipmentDateTime": "'+CONVERT(varchar,@GPSDateTime,23)+ ' '+ +CONVERT(varchar(8),@GPSDateTime , 108)+'",                

"latitude": "'+cast(@Latitude as nvarchar(20))+'",                              

"longitude": "'+cast(@Longitude as nvarchar(20))+'",                    

"Hight": "'+cast(@Height as nvarchar(20))+'",                                    

"EquipmentLocation": "'+@Location+'"

}';

set @Body=REPLACE(RTRIM(LTRIM(@Body)),'  ','');

EXEC [SP_QIKKLESERVER_INTEGRATION] @Body;



End

-- dbo.INS_EKY_TRN_LOCK_DATA
-- =============================================

-- Author:		<Author,,Name>

-- Create date: <Create Date,,>

-- Description:	<Description,,>

-- =============================================

GO
CREATE PROCEDURE [dbo].[INS_EKY_TRN_LOCK_DATA]

	-- Add the parameters for the stored procedure here

@PacketType VARCHAR(50),

@Lat decimal(18,6),

@Long decimal(18,6),

@DeviceId varchar(50),

@gpstime datetime,

@Height varchar(50),

@ContainerLocation nvarchar(50),

@ContainerNo nvarchar(20),

@KalmarNo varchar(50),

@AdjucentLocation nvarchar(50),

@SlotId Bigint,

@AdjucentSlotId Bigint

AS--@ContainerSize=ContainerSize

BEGIN

	set @SlotId = null

	declare @ContainerMasterId bigint,@ContNo nvarchar(20),@MovesCount int,@OffloadCount int,@LastShiftDate datetime,@LocationId bigint,@AdjucentLocationId bigint,@ContTransTypeID bigint,@ContainerSize nvarchar(50);

	select @ContainerMasterId=isnull(INVENTORY_ID,0),@ContNo=CONTAINER_NO from TBL_CONTAINER_INVENTORY where CONTAINER_NO=@ContainerNo and GATE_OUT_DATE is null;

		declare @gps as varchar(50)

		set @gps=cast(@Lat as varchar) + ' ' + cast(@Long as varchar);

		select Top(1) @SlotId=isnull( t.SlotId,0),@ContainerLocation=SlotName 

		from ESS_MST_SLOT t where Polygon.STIntersects(geometry::STPointFromText('POINT('+@gps+')',4326)) >=1 

		if @SlotId is null 

		begin

			DECLARE @h geography;  

			SET @h = geography::STGeomFromText('POINT('+@gps+')', 4326);  

			select Top(1) @SlotId=tb.SlotId,@ContainerLocation=SlotName from (

			SELECT t.*,dbo.fnCalcDistanceKM( Polygon.STCentroid().STX,@Lat,Polygon.STCentroid().STY,@Long) as dist 

			from ESS_MST_SLOT t

			where GEOGRAPHY::STGeomFromText(Polygon.STCentroid().MakeValid().STAsText(),4326).STDistance(@h) is not null) as tb

		ORDER BY tb.dist asc

		end

		select @LocationId=LocationID,@ContainerLocation=ContainerLocationName from ESS_MST_LOCATION where SlotId=@SlotId and StackNo=@Height;

		select @AdjucentLocationId=LocationID,@AdjucentLocation=ContainerLocationName from ESS_MST_LOCATION where SlotId=@AdjucentSlotId and StackNo=@Height;

		select @MovesCount=isnull(count(INVENTORY_ID) ,0) from TBL_EQUIPMENT_TRANSACTION where INVENTORY_ID=@ContainerMasterId;

		select @OffloadCount = isnull(count(OFFLOAD_LOCATION),0),@LastShiftDate=max(isnull(LAST_MOVED_DATE,OFFLOAD_DATE)) from TBL_CONTAINER_INVENTORY where INVENTORY_ID = @ContainerMasterId; 

		if @MovesCount = 0

		BEGIN	

			set @ContTransTypeID=4;

		END

		ELSE

		BEGIN	

			set @ContTransTypeID=3;

		END



		Insert into TBL_EQUIPMENT_TRANSACTION(GPS_LATITUDE,GPS_LONGITUDE,DEVICE_ID,INVENTORY_ID ,TRANSACTION_DATE,PACKET_TYPE,OCR_CONTAINER_NO,CONTAINER_TRANS_TYPE,CREATED_ON)

		Values (@Lat,@Long,@DeviceId,@ContainerMasterId,@gpstime,'LK',isnull(@ContNo,@ContainerNo),@ContTransTypeID,Getdate());

		



	IF @ContainerMasterId >0

	BEGIN

		/****************************** GET LOCATION & INSERT TRANSACTION DETAILS *********************************************/

		if @OffloadCount > 0

		BEGIN	

			update ESS_MST_LOCATION SET isEmpty =1 where LocationId=@LocationId

			IF @ContainerSize like '40%'

			BEGIN

				update ESS_MST_LOCATION SET isEmpty =1 where LocationId=@AdjucentLocationId

			END

		END

	END

END

-- dbo.INS_EKY_TRN_SHIFTWISE_COUNT
GO
CREATE PROCEDURE [dbo].[INS_EKY_TRN_SHIFTWISE_COUNT]  

    --@DeviceIMEI NVARCHAR(50),

    @EquipmentNo NVARCHAR(50),   

    @ContainerCount INT,  

    @IsSuccess INT OUTPUT  

AS  

BEGIN  

    SET @IsSuccess = 0  



   

    IF  

        @EquipmentNo IS NULL 

       OR @ContainerCount IS NULL

    BEGIN

        SELECT @IsSuccess AS result  

        RETURN

    END



    INSERT INTO EKY_TRN_SHIFTWISE_COUNT 

        (EquipmentNo, TransactionDate, ContainerCount)

    VALUES 

        ( @EquipmentNo, GETDATE(), @ContainerCount)



    SET @IsSuccess = 1    

    SELECT @IsSuccess AS result  

END

-- dbo.INS_EKY_TRN_UNLOCK_DATA
-- =============================================  

-- Author:  <Author,,Name>  

-- Create date: <Create Date,,>  

-- Description: <Description,,>  

-- =============================================  

GO
CREATE PROCEDURE [dbo].[INS_EKY_TRN_UNLOCK_DATA]  

 -- Add the parameters for the stored procedure here  

@PacketType VARCHAR(50),  

@Lat decimal(18,6),  

@Long decimal(18,6),  

@DeviceId varchar(50),  

@gpstime datetime,  

@Height varchar(50),  

@ContainerLocation nvarchar(50),  

@ContainerNo nvarchar(20),  

@KalmarNo varchar(50),  

@AdjucentLocation nvarchar(50),  

@SlotId Bigint,  

@AdjucentSlotId Bigint  

AS  

BEGIN  

 set @SlotId = null  

    declare @ContNo nvarchar(50);  

 declare @ContainerMasterId bigint,@MovesCount int,@OffloadCount int,@LastShiftDate datetime,  

 @LocationId bigint,@AdjucentLocationId bigint,@ContTransTypeID bigint,@ContainerSize nvarchar(30);  

 declare @ProcessType nvarchar(50),@DocumentNo nvarchar(50),@Count int,@EquipmentName nvarchar(20);  

 if @ContainerNo=''  

 BEGIN  

  SET @ContainerNo='00000000000'  

 END  

 set @ContainerNo = [dbo].[FN_GET_OCR_CONTAINER_NO] (@ContainerNo)   

  

 select @EquipmentName=Equipment_Name from TBL_MST_EQUIPMENT where Device_ID=@DeviceId  

   

 select @ContainerMasterId=isnull(INVENTORY_ID,0),@ContNo=CONTAINER_NO   

 from TBL_CONTAINER_INVENTORY   

 where CONTAINER_NO=@ContainerNo and GATE_OUT_DATE is null;  

  

   

 /****************************** GET LOCATION & INSERT TRANSACTION DETAILS *********************************************/  

  declare @gps as varchar(50)  

  set @gps=cast(@Lat as varchar) + ' ' + cast(@Long as varchar);  

  select Top(1) @SlotId=isnull( t.SlotId,0),@ContainerLocation=SlotName   

  from ESS_MST_SLOT t where Polygon.STIntersects(geometry::STPointFromText('POINT('+@gps+')',4326)) >=1   

  if @SlotId is null   

  begin  

   DECLARE @h geography;    

   SET @h = geography::STGeomFromText('POINT('+@gps+')', 4326);    

   select Top(1) @SlotId=tb.SlotId,@ContainerLocation=SlotName from (  

   SELECT t.*,dbo.fnCalcDistanceKM( Polygon.STCentroid().STX,@Lat,Polygon.STCentroid().STY,@Long) as dist   

   from ESS_MST_SLOT t  

   where GEOGRAPHY::STGeomFromText(Polygon.STCentroid().MakeValid().STAsText(),4326).STDistance(@h) is not null) as tb  

  ORDER BY tb.dist asc  

  end  

    

  select @LocationId=LocationID,@ContainerLocation=ContainerLocationName from ESS_MST_LOCATION where SlotId=@SlotId and StackNo=@Height;  

  select @AdjucentLocationId=LocationID,@AdjucentLocation=ContainerLocationName from ESS_MST_LOCATION where SlotId=@AdjucentSlotId and StackNo=@Height;  

  if @LocationId is null  

  BEGIN  

   select @LocationId=LocationID,@ContainerLocation=ContainerLocationName from ESS_MST_LOCATION where SlotId=@SlotId and StackNo='1';   

   select @AdjucentLocationId=LocationID,@AdjucentLocation=ContainerLocationName from ESS_MST_LOCATION where LocationId=@AdjucentSlotId and StackNo='1';  

  END  

    

  select @MovesCount=isnull(count(INVENTORY_ID) ,0) from TBL_EQUIPMENT_TRANSACTION where INVENTORY_ID=@ContainerMasterId and PACKET_TYPE=8;  

  select @OffloadCount = isnull(count(OFFLOAD_LOCATION),0),@LastShiftDate=max(isnull(OFFLOAD_DATE,LAST_MOVED_DATE)) from TBL_CONTAINER_INVENTORY where INVENTORY_ID = @ContainerMasterId;   

  if @MovesCount = 0  

  BEGIN   

   set @ContTransTypeID=4;  

  END  

  ELSE  

  BEGIN   

   set @ContTransTypeID=3;  

  END  

   Insert into TBL_EQUIPMENT_TRANSACTION(GPS_LATITUDE,GPS_LONGITUDE,DEVICE_ID,INVENTORY_ID ,TRANSACTION_DATE,PACKET_TYPE,OCR_CONTAINER_NO,CONTAINER_TRANS_TYPE,CREATED_ON)  

  Values (@Lat,@Long,@DeviceId,@ContainerMasterId,@gpstime,'UK',isnull(@ContNo,@ContainerNo),@ContTransTypeID,Getdate());  

    

 IF @ContainerMasterId > 0  

 BEGIN   

  if @OffloadCount > 0  

  BEGIN   

   if @gpstime > @LastShiftDate  

   BEGIN  

    Update TBL_CONTAINER_INVENTORY SET LAST_LOCATION=@LocationId, LAST_MOVED_DATE=@gpstime,LAST_LAT=@Lat,LAST_LON=@Long,  

    LAST_EQP=@DeviceId where INVENTORY_ID=@ContainerMasterId and GATE_OUT_DATE is null;  

    update ESS_MST_LOCATION SET isEmpty =0 where LocationId=@LocationId  

    IF @ContainerSize like '40%'  

    BEGIN  

     update ESS_MST_LOCATION SET isEmpty =0 where LocationId=@AdjucentLocationId  

    END  

   END  

   ELSE IF @LastShiftDate is null  

   BEGIN  

    Update TBL_CONTAINER_INVENTORY SET LAST_LOCATION=@LocationId, LAST_MOVED_DATE=@gpstime,LAST_LAT=@Lat,LAST_LON=@Long,  

    LAST_EQP=@DeviceId where INVENTORY_ID=@ContainerMasterId and GATE_OUT_DATE is null;  

    update ESS_MST_LOCATION SET isEmpty =0 where LocationId=@LocationId  

    IF @ContainerSize like '40%'  

    BEGIN  

     update ESS_MST_LOCATION SET isEmpty =0 where LocationId=@AdjucentLocationId  

    END  

   END  

    

  END  

  ELSE  

  BEGIN  

   if @gpstime > @LastShiftDate  

      BEGIN  

    Update TBL_CONTAINER_INVENTORY SET OFFLOAD_LOCATION=@LocationId,OFFLOAD_DATE=@gpstime,OFFLOAD_LAT=@Lat,OFFLOAD_LON=@Long,  LAST_LOCATION=@LocationId, LAST_MOVED_DATE=@gpstime,LAST_LAT=@Lat,LAST_LON=@Long,  

    LAST_EQP=@DeviceId where INVENTORY_ID=@ContainerMasterId and GATE_OUT_DATE is null;  

    update ESS_MST_LOCATION SET isEmpty =0 where LocationId=@LocationId  

    IF @ContainerSize like '40%'  

    BEGIN  

     update ESS_MST_LOCATION SET isEmpty =0 where LocationId=@AdjucentLocationId  

    END  

   END  

   ELSE IF @LastShiftDate is null  

   BEGIN  

    Update TBL_CONTAINER_INVENTORY SET LAST_LOCATION=@LocationId, LAST_MOVED_DATE=@gpstime,LAST_LAT=@Lat,LAST_LON=@Long,  

    LAST_EQP=@DeviceID where INVENTORY_ID=@ContainerMasterId and GATE_OUT_DATE is null;  

    update ESS_MST_LOCATION SET isEmpty =0 where LocationId=@LocationId  

    IF @ContainerSize like '40%'  

    BEGIN  

     update ESS_MST_LOCATION SET isEmpty =0 where LocationId=@AdjucentLocationId  

    END  

  

   END  

  END  

  --update ESS_MST_TASK_MASTER set JobCompletionDate=@gpstime,ActualLocationId=@LocationId where ContainerMasterID=@ContainerMasterId and JobCompletionDate is null  

  --update A Set  TaskCompletionDate=@gpstime  from ESS_MST_TASK_MASTER T LEFT JOIN ESS_MST_TASK_ALLOCATION A on A.JobID=T.JobID where ContainerMasterID=@ContainerMasterId and JobCompletionDate is null  

  

  

 END  

   

END

-- dbo.INS_EQUIPMENT_DAILY_UTILIZATION
GO
CREATE PROCEDURE [dbo].[INS_EQUIPMENT_DAILY_UTILIZATION]  

AS  

BEGIN  

  

  

delete from EKY_TRN_DAILY_UTILIZATION where cast(TransactionDate as date) = cast(DATEADD(day,-1,getdate()) as date);  

delete from EKY_TRN_UTILIZATION_DETAIL where cast(StartTime as date) = cast(DATEADD(day,-1,getdate()) as date);  

  

with CTE AS  

(  

  

--select E.DeviceId,cast(dateadd(minute,330,T.[DateTime]) as date) as TransDate,dateadd(minute,330,T.[DateTime]) as TransTime

--,E.Equipment_Name as Eqp_No , Row_Number() Over (Partition By E.DeviceId Order By dateadd(minute,330,T.[DateTime])) As rn from   

--ESS_MST_EQUIPMENT E 

--left join EKL_TRN_EKDEVICEDATA T on T.DeviceIMEI=E.DeviceID   

--where    PacketID in (7,8) and

--cast(dateadd(minute,330,T.[DateTime]) as date) = cast(DATEADD(day,-1,getdate()) as date)



select E.DeviceId,cast(T.TransDate as date) as TransDate,T.TransDate as TransTime

,E.Equipment_Name as Eqp_No , Row_Number() Over (Partition By E.DeviceId Order By T.TransDate) As rn from   

ESS_MST_EQUIPMENT E 

left join EKL_TRN_EQUIPMENT_TRANSACTION T on T.DeviceID=E.DeviceID   

where    PacketType in ('LK','UK') and

cast(T.TransDate as date) = cast(DATEADD(day,-1,getdate()) as date)  

)  





insert into EKY_TRN_UTILIZATION_DETAIL(DeviceIMEI,EquipmentNo,StartTime,EndTime,TimeDifference,State)  

Select   

c1.DeviceId,c1.Eqp_No,  

c1.TransTime As PreviousLockTime,  

c2.TransTime As CurrentLockTime,DATEDIFF(second,c1.TransTime,c2.TransTime),  

(case when DATEDIFF(second,c1.TransTime,c2.TransTime) >= 1200 then 'IDLE' else 'WORKING' end)  

 From CTE c1  

left Join cte c2 On c1.DeviceId = c2.DeviceId And c1.rn = c2.rn - 1  

order by c1.DeviceId asc, c1.TransTime asc  

  

insert into EKY_TRN_DAILY_UTILIZATION (DeviceIMEI,EquipmentNo,TransactionDate,IdleTime,WorkTime,ContainerCount)  

SELECT DeviceIMEI,EquipmentNo,CAST(StartTime as date),  

sum(case when State='IDLE' then TimeDifference*1.0 else 0 end)/60 as idleTime,  

sum(case when State='WORKING' then TimeDifference*1.0 else 0 end)/60 as WorkTime,

count(*)/2  

FROM EKY_TRN_UTILIZATION_DETAIL 

where cast(StartTime as date) = cast(DATEADD(day,-1,getdate()) as date) 

group by DeviceIMEI,EquipmentNo,CAST(StartTime as date)  



---=======THIS BLOCK USE FOR UTILIZATION COUNT BY lOCATION======---

delete from EKY_TRN_DAILY_UTILIZATION_BY_LOCATION where cast(TransactionDate as date) = cast(getdate()-1 as date);  



INSERT INTO EKY_TRN_DAILY_UTILIZATION_BY_LOCATION(DeviceIMEI,EquipmentNo,TransactionDate,TotalLiftup,Loaded,UnLoaded,Import,Export,[Empty],Rail,Domestic,GDL)

select EQ.DeviceID,EQ.Equipment_Name as EqpName,CAST(E.TransDate as DATE) as TransactionDate,Count(E.PacketType) as LIFTDETAIL,

  0 as LOADED,0  as EMT,

   ISNULL(SUM(case when ISNULL(UPPER(L.ContainerLocationName),0) LIKE '%IMP%' then 1 else 0 end ),0) as [IMPORT],          

   ISNULL(SUM(case when ISNULL(UPPER(L.ContainerLocationName),0)  like '%EXP%' then 1 else 0 end ),0)  as [EXPORT],

   0  as [EMPTY] ,

   ISNULL(SUM(case when (ISNULL(UPPER(L.ContainerLocationName),0)  like '%RAIL%' OR ISNULL(UPPER(L.ContainerLocationName),0)  like '%TRI%') then 1 else 0 end ),0)  as [RAIL], 

   ISNULL(SUM(case when ISNULL(UPPER(L.ContainerLocationName),0)  like '%ORY%' then 1 else 0 end ),0)  as [DOMESTIC],

   ISNULL(SUM(case when (ISNULL(UPPER(L.ContainerLocationName),0)  like '%OLD%' OR ISNULL(UPPER(L.ContainerLocationName),0)  like '%WH0102%') then 1 else 0 end ),0)  as [GDL] 

   from ESS_MST_EQUIPMENT EQ

	 LEFT JOIN EKL_TRN_EQUIPMENT_TRANSACTION E  ON EQ.DeviceID=E.DeviceID

	LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=E.AreaID

    where CAST(E.TransDate as DATE)=CAST(GETDATE()-1 as date)

	--and EQ.Equipment_Name in  (select Value from [dbo].Split_String(@Eqp,',')) 

	and E.PacketType in ('UK')     

     group by EQ.DeviceID,EQ.Equipment_Name,CAST(E.TransDate as DATE)      

  

  ---=======THIS BLOCK USE FOR UTILIZATION COUNT BY lOCATION======---



END

-- dbo.INS_EQUIPMENT_HOURLY_UTILIZATION
GO
CREATE PROCEDURE [dbo].[INS_EQUIPMENT_HOURLY_UTILIZATION]  

AS  

BEGIN  

  

declare @LastTime datetime;

select @LastTime=max(StartTime) from EKY_TRN_UTILIZATION_DETAIL where cast(StartTime as date) = cast(getdate() as date);  

  

create table #TempTable(DeviceIMEI Varchar(50), EquipmentNo Varchar(50), StartTime DateTime, EndTime DatetIme,  TimeDifference int,[State] varchar(50));

 

with CTE AS  

(  

select E.DeviceId,cast(T.TransDate as date) as TransDate,T.TransDate as TransTime

,E.Equipment_Name as Eqp_No , Row_Number() Over (Partition By E.DeviceId Order By T.TransDate) As rn from   

ESS_MST_EQUIPMENT E 

left join EKL_TRN_EQUIPMENT_TRANSACTION T on T.DeviceID=E.DeviceID   

where    PacketType in ('LK','UK') and

T.TransDate >= cast(getdate() as date)

) 



insert into #TempTable(DeviceIMEI,EquipmentNo,StartTime,EndTime,TimeDifference,State)

Select c1.DeviceId,c1.Eqp_No, c1.TransTime As PreviousLockTime,  

c2.TransTime As CurrentLockTime,DATEDIFF(second,c1.TransTime,c2.TransTime),  

(case when DATEDIFF(second,c1.TransTime,c2.TransTime) >= 1200 then 'IDLE' else 'WORKING' end) From CTE c1  

left Join cte c2 On c1.DeviceId = c2.DeviceId And c1.rn = c2.rn - 1  

order by c1.DeviceId asc, c1.TransTime asc  



delete from EKY_TRN_UTILIZATION_DETAIL where cast(StartTime as date)= cast(getdate() as date);  





insert into EKY_TRN_UTILIZATION_DETAIL(DeviceIMEI,EquipmentNo,StartTime,EndTime,TimeDifference,State)  

select DeviceIMEI,EquipmentNo,StartTime,EndTime,TimeDifference,State from #TempTable



delete from EKY_TRN_DAILY_UTILIZATION where cast(TransactionDate as date)= cast(getdate() as date);  

  

insert into EKY_TRN_DAILY_UTILIZATION (DeviceIMEI,EquipmentNo,TransactionDate,IdleTime,WorkTime,ContainerCount)  

SELECT DeviceIMEI,EquipmentNo,CAST(StartTime as date),  

sum(case when State='IDLE' then TimeDifference*1.0 else 0 end)/60 as idleTime,  

sum(case when State='WORKING' then TimeDifference*1.0 else 0 end)/60 as WorkTime,

count(*)/2  FROM EKY_TRN_UTILIZATION_DETAIL where cast(StartTime as date) = cast(getdate() as date) 

group by DeviceIMEI,EquipmentNo,CAST(StartTime as date)  





drop table #TempTable;

---=======THIS BLOCK USE FOR UTILIZATION COUNT BY lOCATION======---

delete from EKY_TRN_DAILY_UTILIZATION_BY_LOCATION where cast(TransactionDate as date) = cast(getdate() as date);  



INSERT INTO EKY_TRN_DAILY_UTILIZATION_BY_LOCATION(DeviceIMEI,EquipmentNo,TransactionDate,TotalLiftup,Loaded,UnLoaded,Import,Export,[Empty],Rail,Domestic,GDL)

select EQ.DeviceID,EQ.Equipment_Name as EqpName,CAST(E.TransDate as DATE) as TransactionDate,Count(E.PacketType) as LIFTDETAIL,

   ISNULL(SUM(case when ISNULL(UPPER(I.ContainerStatus),0) LIKE '%LADEN%' then 1 else 0 end ),0)  as LOADED,

   ISNULL(SUM(case when ISNULL(UPPER(I.ContainerStatus),0) LIKE '%EMPTY%' then 1 else 0 end ),0)   as EMT,

   ISNULL(SUM(case when ISNULL(UPPER(L.ContainerLocationName),0) LIKE '%IMP%' then 1 else 0 end ),0) as [IMPORT],          

   ISNULL(SUM(case when ISNULL(UPPER(L.ContainerLocationName),0)  like '%EXP%' then 1 else 0 end ),0)  as [EXPORT],

   0  as [EMPTY] ,

   ISNULL(SUM(case when (ISNULL(UPPER(L.ContainerLocationName),0)  like '%NRY%' OR ISNULL(UPPER(L.ContainerLocationName),0)  like '%TRI%') then 1 else 0 end ),0)  as [RAIL], 

   ISNULL(SUM(case when ISNULL(UPPER(L.ContainerLocationName),0)  like '%ORY%' then 1 else 0 end ),0)  as [DOMESTIC],

   ISNULL(SUM(case when (ISNULL(UPPER(L.ContainerLocationName),0)  like '%OLD%' OR ISNULL(UPPER(L.ContainerLocationName),0)  like '%WH0102%') then 1 else 0 end ),0)  as [GDL] 

   from ESS_MST_EQUIPMENT EQ

	 LEFT JOIN EKL_TRN_EQUIPMENT_TRANSACTION E  ON EQ.DeviceID=E.DeviceID

	LEFT JOIN ESS_MST_LOCATION L ON L.LocationID=E.AreaID

	LEFT JOIN EKL_TRN_INVENTORY I ON I.ContMasterID=E.ContMasterID

    where CAST(E.TransDate as DATE)=CAST(GETDATE() as date)

	--and EQ.Equipment_Name in  (select Value from [dbo].Split_String(@Eqp,',')) 

	and E.PacketType in ('UK')     

     group by EQ.DeviceID,EQ.Equipment_Name,CAST(E.TransDate as DATE)      

  

  ---=======THIS BLOCK USE FOR UTILIZATION COUNT BY lOCATION======---



END

-- dbo.INS_NEW_TASK
GO
CREATE PROCEDURE [dbo].[INS_NEW_TASK]

@PlantID bigint,

@RailPlanName varchar(100),

@ContainerNo varchar(50),

@IsJobAllotted bit,

@ModifiedBy uniqueidentifier,

@IsSuccess INT OUTPUT

AS

BEGIN

	

	set nocount on

   SET @IsSuccess=0

         declare @ContainerType varchar(50),@TransactionType varchar(50),@ContMasterId int,@TrailerNo as varchar(50),

		 @DocumentNo varchar(250),@ShippingLine as varchar(250),@ContainerSize as varchar(20);



		 SELECT @ContainerType=ContainerType,@DocumentNo=DocumentNo,@ShippingLine=@ShippingLine,@TransactionType=Process,@ContMasterId=ContMasterID,

		 @TrailerNo='N/A',@ContainerSize=ContainerSize from EKL_TRN_INVENTORY

		 WHERE ContNo=LTRIM(RTRIM(@ContainerNo)) and GateOutDate IS NULL



   IF @IsJobAllotted=0

   BEGIN

        INSERT INTO EKL_TRN_RAIL_PLAN(IsJobAllotted,RailPlanName,ContainerNo,ContainerSize,ContainerType,DocumentNo,ShippingLine,RailPlanDate,ModifiedDate,PlantID,ModifiedBy)

		 VALUES(0,@RailPlanName,@ContainerNo,@ContainerSize,@ContainerType,@DocumentNo,@ShippingLine,GETDATE(),GETDATE(),@PlantID,@ModifiedBy);

		 SET @IsSuccess=1;

   END

   ELSE IF @IsJobAllotted=1

   BEGIN

         INSERT INTO EKL_TRN_RAIL_PLAN(IsJobAllotted,RailPlanName,ContainerNo,ContainerSize,ContainerType,DocumentNo,ShippingLine,RailPlanDate,ModifiedDate,PlantID,ModifiedBy)

		 VALUES(1,@RailPlanName,LTRIM(RTRIM(@ContainerNo)),@ContainerSize,@ContainerType,@DocumentNo,@ShippingLine,GETDATE(),GETDATE(),@PlantID,@ModifiedBy);

 

		 INSERT INTO ESS_MST_TASK_MASTER(JobType,RailPlanName,JobCreation,ContainerNo,ContainerMasterID,ProposedLocationID,ActualLocationId,STATUS,TrailerNo,ContainerType,Process,ContainerSize,CreatedBy)  

		 SELECT 'PICKUP',RailPlanName,GETDATE(),RP.ContainerNo,I.ContMasterID,0,I.LastLocID,1,'N/A',I.ContainerType,I.Process,I.ContainerSize,@ModifiedBy FROM EKL_TRN_RAIL_PLAN RP

		 INNER JOIN EKL_TRN_INVENTORY I ON I.ContNo=RP.ContainerNo and GateOutDate IS NULL

		 WHERE RP.RailPlanName=@RailPlanName and RP.ContainerNo=LTRIM(RTRIM(@ContainerNo))

		 SET @IsSuccess=2;

   END

   ELSE 

   BEGIN

        SET @IsSuccess=0;

   END

   SELECT @IsSuccess as IsSuccess;

END

-- dbo.INS_PRE_RAIL_IN
GO
CREATE PROCEDURE [dbo].[INS_PRE_RAIL_IN]    

(    

 @container_no nvarchar(20),    

 @NAVDateTime datetime,    

 @ContainerSize nvarchar(20),    

 @Document_No nvarchar(20),    

 @TransactionType nvarchar(30), 

 @Terminal nvarchar(20),

 @Mode nvarchar(20),

 @WagonNo nvarchar(30),

 @ContainerStatus nvarchar(30),

 @ContainerType nvarchar(30),

 @BookingNo nvarchar(100),

 @IsSuccess int OUTPUT    

)    

as    

begin    



  set @IsSuccess=0;

  declare @count int;





  select @count=count(*) from EKL_PRE_RAIL_IN 

  where ContainerNo=@container_no and DocumentNo=@Document_No and cast(NAVDateTime as date) =cast(@NAVDateTime as date);



  if @count=0 

  BEGIN

		insert into EKL_PRE_RAIL_IN (ContainerNo,NAVDateTime,ContainerSize,DocumentNo,TransactionType,Terminal,WagonNo,Mode,ContainerStatus,ContainerType)

							values (@container_no,@NAVDateTime,@ContainerSize,@Document_No,@TransactionType,@Terminal,@WagonNo,@Mode,@ContainerStatus,@ContainerType)

  END

  

  set @IsSuccess=1;

  SELECT @IsSuccess AS result  

  

End

-- dbo.INS_TB_ERROR_LOG
GO
CREATE PROCEDURE [dbo].[INS_TB_ERROR_LOG]

AS

BEGIN

SET NOCOUNT ON 

        

         INSERT INTO [TBL_ERROR_LOG]  

             (

             ErrorNumber 

            ,ErrorDescription 

            ,ErrorProcedure 

            ,ErrorState 

            ,ErrorLine 

            ,ErrorTime 

           )

           VALUES

           (

             ERROR_NUMBER()

            ,ERROR_MESSAGE()

            ,ERROR_PROCEDURE()

            ,ERROR_STATE()

            ,ERROR_LINE()

            ,GETDATE()  

           );

    

SET NOCOUNT OFF    

END

-- dbo.InsertUpdateYardType
GO
CREATE PROCEDURE dbo.InsertUpdateYardType

(

@oprationtype char(1), --instert

@YardTypeID INT = NULL,

@YardTypeName INT = NULL,

@PlantId INT = null,

@IsActive BIT= 1,

@IsDelete BIT= 0,

@CreatedBy VARCHAR(50) = NULL,

@CreatedDate VARCHAR(50) = NULL,

@ModifiedBy VARCHAR(50) = NULL,

@ModifiedDate datetime = null,

@StatementType NVARCHAR(20) 

)

AS BEGIN 

    SET NOCOUNT ON;



IF @StatementType ='INSERT'

BEGIN

   INSERT INTO ESS_MST_YARDTYPE

   (

	 PlantID,

	 IsActive,

	 YardTypeName,

	 IsDelete,

	 CreatedBy,

	 CreatedDate

	)

	VALUES(

	@YardTypeName,

	@PlantId,

	@IsActive,

	@IsDelete,

	'CURRENTUSER',

	GETDATE()

	);

END

 else if @StatementType = 'update'

 begin

    update ESS_MST_YARDTYPE

	set

	YardTypeName = @YardTypeName,

	PlantId = @PlantId,

	isactive = @IsActive,

	ModifiedBy = 'CURRENTUSER',

	ModifiedDate = GETDATE()

WHERE 

YardTypeID =@YardTypeID;

END

END

-- dbo.MST_YARD_DELETE
GO
CREATE   PROCEDURE [dbo].[MST_YARD_DELETE]

( 

    @YardID BIGINT,

    @DeletedBy BIGINT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        UPDATE ESS_MST_YARD

        SET IsDelete = 1,

            DeletedBy = @DeletedBy,

            DeletedDate = GETDATE()

        WHERE YardID = @YardID;

        

        SELECT @@ROWCOUNT AS RowsAffected;

    END TRY

    BEGIN CATCH

        SELECT ERROR_MESSAGE() AS ErrorMessage,

               ERROR_LINE() AS ErrorLine,

               ERROR_NUMBER() AS ErrorNumber;

    END CATCH

END

-- dbo.MST_YARD_GET
GO
CREATE PROCEDURE [dbo].[MST_YARD_GET]

(

    @YardID BIGINT = NULL,

    @PlantID BIGINT = NULL,

    @IncludeDeleted BIT = 0

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        SELECT

            YardID,

            PlantID,

            YardName,

            YardCode,

            YardTypeID,

            LatLong,

            Polygon.STAsText() AS Polygon,

            IsActive,

            IsDelete,

            CreatedBy,

            CreatedDate,

            ModifiedBy,

            ModifiedDate,

            DeletedBy,

            DeletedDate

        FROM ESS_MST_YARD

        WHERE (@YardID IS NULL OR YardID = @YardID)

            AND (@PlantID IS NULL OR PlantID = @PlantID)

            AND (@IncludeDeleted = 1 OR IsDelete = 0)

        ORDER BY YardID DESC;

    END TRY

    BEGIN CATCH

        SELECT ERROR_MESSAGE() AS ErrorMessage,

               ERROR_LINE() AS ErrorLine,

               ERROR_NUMBER() AS ErrorNumber;

    END CATCH

END

-- dbo.RPT_GATE_INOUT
GO
CREATE PROC [dbo].[RPT_GATE_INOUT]  

@fromDate DATETIME,  

@toDate DATETIME,  

@ContainerNo varchar(50) 



AS  

BEGIN 



SET @ContainerNo=ISNULL(@ContainerNo,'');

SET @fromDate=ISNULL(@fromDate,'');

SET @toDate=ISNULL(@toDate,'');



IF @ContainerNo <> '' and @fromDate='' and  @toDate=''

BEGIN  

  select ci.CONTAINER_NO,cs.SizeCode AS CONTAINER_SIZE,ct.TypeCode AS CONTAINER_TYPE,

  cp.ProcessName AS CONTAINER_PROCESS,cl.LINE_NAME AS CONTAINER_LINE,cc.COMMODITY_NAME,ci.INVENTORY_STATUS,

  ci.YARD_ID,ci.GATE_IN_DATE,ci.GATE_OUT_DATE,ci.LAST_MOVED_DATE,ci.OFFLOAD_EQP,ci.TOSS_IN_DATE,ci.OFFLOAD_LAT,ci.OFFLOAD_LON,

  [dbo].[ConvertDDHHMMSS](GATE_IN_DATE,ISNULL(GATE_OUT_DATE,GETDATE())) as INTAT,

  [dbo].[ConvertDDHHMMSS](GATE_IN_DATE,GATE_OUT_DATE) as OUTTAT

    FROM dbo.TBL_CONTAINER_INVENTORY ci

            LEFT JOIN dbo.TBL_MST_CONT_SIZE cs ON ci.CONTAINER_SIZE_ID = cs.SizeID

            LEFT JOIN dbo.TBL_MST_CONT_TYPE ct ON ci.CONTAINER_TYPE_ID = ct.TypeID

            LEFT JOIN dbo.TBL_MST_LINE cl ON ci.LINE_ID = cl.LINE_ID

            LEFT JOIN dbo.TBL_MST_PROCESS cp ON ci.CONTAINER_PROCESS_ID = cp.ProcessID

            LEFT JOIN dbo.TBL_MST_COMMODITY cc ON ci.COMMODITY_ID = cc.COMMODITY_ID AND cc.IS_ACTIVE = 1

  where ci.CONTAINER_NO=@ContainerNo

END  

else  IF  @ContainerNo=''  and @fromDate <>'' and  @toDate<>''

BEGIN  

   select ci.CONTAINER_NO,cs.SizeCode AS CONTAINER_SIZE,ct.TypeCode AS CONTAINER_TYPE,

  cp.ProcessName AS CONTAINER_PROCESS,cl.LINE_NAME AS CONTAINER_LINE,cc.COMMODITY_NAME,ci.INVENTORY_STATUS,

  ci.YARD_ID,ci.GATE_IN_DATE,ci.GATE_OUT_DATE,ci.LAST_MOVED_DATE,ci.OFFLOAD_EQP,ci.TOSS_IN_DATE,ci.OFFLOAD_LAT,ci.OFFLOAD_LON,

  [dbo].[ConvertDDHHMMSS](GATE_IN_DATE,ISNULL(GATE_OUT_DATE,GETDATE())) as INTAT,

  [dbo].[ConvertDDHHMMSS](GATE_IN_DATE,GATE_OUT_DATE) as OUTTAT

    FROM dbo.TBL_CONTAINER_INVENTORY ci

            LEFT JOIN dbo.TBL_MST_CONT_SIZE cs ON ci.CONTAINER_SIZE_ID = cs.SizeID

            LEFT JOIN dbo.TBL_MST_CONT_TYPE ct ON ci.CONTAINER_TYPE_ID = ct.TypeID

            LEFT JOIN dbo.TBL_MST_LINE cl ON ci.LINE_ID = cl.LINE_ID

            LEFT JOIN dbo.TBL_MST_PROCESS cp ON ci.CONTAINER_PROCESS_ID = cp.ProcessID

            LEFT JOIN dbo.TBL_MST_COMMODITY cc ON ci.COMMODITY_ID = cc.COMMODITY_ID AND cc.IS_ACTIVE = 1  

  where ((CAST(CI.GATE_IN_DATE as date) between @fromDate and @toDate)OR(CAST(CI.GATE_OUT_DATE as date) between @fromDate and @toDate))

END 

ELSE IF  @ContainerNo <> '' and @fromDate <>'' and  @toDate<>'' 

BEGIN  

  select ci.CONTAINER_NO,cs.SizeCode AS CONTAINER_SIZE,ct.TypeCode AS CONTAINER_TYPE,

  cp.ProcessName AS CONTAINER_PROCESS,cl.LINE_NAME AS CONTAINER_LINE,cc.COMMODITY_NAME,ci.INVENTORY_STATUS,

  ci.YARD_ID,ci.GATE_IN_DATE,ci.GATE_OUT_DATE,ci.LAST_MOVED_DATE,ci.OFFLOAD_EQP,ci.TOSS_IN_DATE,ci.OFFLOAD_LAT,ci.OFFLOAD_LON,

  [dbo].[ConvertDDHHMMSS](GATE_IN_DATE,ISNULL(GATE_OUT_DATE,GETDATE())) as INTAT,

  [dbo].[ConvertDDHHMMSS](GATE_IN_DATE,GATE_OUT_DATE) as OUTTAT

    FROM dbo.TBL_CONTAINER_INVENTORY ci

            LEFT JOIN dbo.TBL_MST_CONT_SIZE cs ON ci.CONTAINER_SIZE_ID = cs.SizeID

            LEFT JOIN dbo.TBL_MST_CONT_TYPE ct ON ci.CONTAINER_TYPE_ID = ct.TypeID

            LEFT JOIN dbo.TBL_MST_LINE cl ON ci.LINE_ID = cl.LINE_ID

            LEFT JOIN dbo.TBL_MST_PROCESS cp ON ci.CONTAINER_PROCESS_ID = cp.ProcessID

            LEFT JOIN dbo.TBL_MST_COMMODITY cc ON ci.COMMODITY_ID = cc.COMMODITY_ID AND cc.IS_ACTIVE = 1 

  where ((CAST(CI.GATE_IN_DATE as date) between @fromDate and @toDate)

  OR(CAST(CI.GATE_OUT_DATE as date) between @fromDate and @toDate)) 

  and CI.CONTAINER_NO=@ContainerNo

END  

END

-- dbo.SP_ACTIVITY_ADD
GO
CREATE PROCEDURE [dbo].[SP_ACTIVITY_ADD]

(

    @ActivityName VARCHAR(200)

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        INSERT INTO TBL_MST_ACTIVITY (ActivityName)

        VALUES (@ActivityName);



        SELECT 

            1 AS Status,

            'Activity added successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_ACTIVITY_DELETE
GO
CREATE PROCEDURE [dbo].[SP_ACTIVITY_DELETE]

(

    @ActivityID INT

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Check if activity exists and not already deleted

        IF NOT EXISTS (

            SELECT 1 

            FROM TBL_MST_ACTIVITY

            WHERE ActivityID = @ActivityID

              AND IsDeleted = 0

        )

        BEGIN

            SELECT 

                0 AS Status,

                'Activity not found' AS Message;

            RETURN;

        END



        -- Soft delete activity

        UPDATE TBL_MST_ACTIVITY

        SET IsDeleted = 1

        WHERE ActivityID = @ActivityID;



        -- Success response

        SELECT 

            1 AS Status,

            'Activity deleted successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_ACTIVITY_GET
GO
CREATE PROCEDURE [dbo].[SP_ACTIVITY_GET]

(

    @ActivityID INT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        SELECT 

            ActivityID,

            ActivityName,

            IsActive,

            IsDeleted,

            CreatedOn

        FROM TBL_MST_ACTIVITY

        WHERE 

            IsDeleted = 0

            AND (@ActivityID IS NULL OR ActivityID = @ActivityID);

    END TRY

    BEGIN CATCH

        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_ACTIVITY_MODIFY
GO
CREATE PROCEDURE [dbo].[SP_ACTIVITY_MODIFY]

(

    @ActivityID   INT,

    @ActivityName VARCHAR(200),

    @IsActive     BIT

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Check if activity exists and not deleted

        IF NOT EXISTS (

            SELECT 1 

            FROM TBL_MST_ACTIVITY 

            WHERE ActivityID = @ActivityID

              AND IsDeleted = 0

        )

        BEGIN

            SELECT 

                0 AS Status,

                'Activity not found' AS Message;

            RETURN;

        END



        -- Update activity

        UPDATE TBL_MST_ACTIVITY

        SET 

            ActivityName = @ActivityName,

            IsActive     = @IsActive,

            CreatedOn    = GETDATE()

        WHERE ActivityID = @ActivityID;



        -- Success response

        SELECT 

            1 AS Status,

            'Activity updated successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.sp_alterdiagram
GO
CREATE PROCEDURE dbo.sp_alterdiagram

	(

		@diagramname 	sysname,

		@owner_id	int	= null,

		@version 	int,

		@definition 	varbinary(max)

	)

	WITH EXECUTE AS 'dbo'

	AS

	BEGIN

		set nocount on

	

		declare @theId 			int

		declare @retval 		int

		declare @IsDbo 			int

		

		declare @UIDFound 		int

		declare @DiagId			int

		declare @ShouldChangeUID	int

	

		if(@diagramname is null)

		begin

			RAISERROR ('Invalid ARG', 16, 1)

			return -1

		end

	

		execute as caller;

		select @theId = DATABASE_PRINCIPAL_ID();	 

		select @IsDbo = IS_MEMBER(N'db_owner'); 

		if(@owner_id is null)

			select @owner_id = @theId;

		revert;

	

		select @ShouldChangeUID = 0

		select @DiagId = diagram_id, @UIDFound = principal_id from dbo.sysdiagrams where principal_id = @owner_id and name = @diagramname 

		

		if(@DiagId IS NULL or (@IsDbo = 0 and @theId <> @UIDFound))

		begin

			RAISERROR ('Diagram does not exist or you do not have permission.', 16, 1);

			return -3

		end

	

		if(@IsDbo <> 0)

		begin

			if(@UIDFound is null or USER_NAME(@UIDFound) is null) -- invalid principal_id

			begin

				select @ShouldChangeUID = 1 ;

			end

		end



		-- update dds data			

		update dbo.sysdiagrams set definition = @definition where diagram_id = @DiagId ;



		-- change owner

		if(@ShouldChangeUID = 1)

			update dbo.sysdiagrams set principal_id = @theId where diagram_id = @DiagId ;



		-- update dds version

		if(@version is not null)

			update dbo.sysdiagrams set version = @version where diagram_id = @DiagId ;



		return 0

	END

-- dbo.sp_BulkInsertRoleMenu
GO
CREATE PROCEDURE [dbo].[sp_BulkInsertRoleMenu]

	-- Add the parameters for the stored procedure here

		@RoleID bigint,

		@RoleMenuDetails RoleMenu READONLY

AS

BEGIN

	Delete from [dbo].[IND_MST_ROLE_MENU] where [RoleID] = @RoleID;





	INSERT INTO [dbo].[IND_MST_ROLE_MENU] ([RoleID],[MenuID],[CreatedBy],[CreatedDate],PlantID)

	SELECT *,0 FROM @RoleMenuDetails;

	

	select 'Success' as ReturnMsg

END

-- dbo.SP_CLIENT_ADD
GO
CREATE PROCEDURE dbo.SP_CLIENT_ADD

    @CLIENT_NAME NVARCHAR(150),

    @LOGO_PATH NVARCHAR(500) = NULL,

    @IS_ACTIVE BIT = 1,

    @CREATED_BY INT = NULL

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        INSERT INTO dbo.TBL_MST_CLIENT (

            CLIENT_NAME,

            LOGO_PATH,

            IS_ACTIVE,

            IS_DELETED,

            CREATED_BY,

            CREATED_DATE

        )

        VALUES (

            @CLIENT_NAME,

            @LOGO_PATH,

            @IS_ACTIVE,

            0,

            @CREATED_BY,

            GETDATE()

        );



        SELECT 1 AS Status, 'Client created successfully' AS Message, SCOPE_IDENTITY() AS CLIENT_ID, @LOGO_PATH AS LOGO_PATH;

    END TRY

    BEGIN CATCH

        SELECT 0 AS Status, ERROR_MESSAGE() AS Message;

    END CATCH;

END;

-- dbo.SP_CLIENT_DELETE
GO
CREATE PROCEDURE dbo.SP_CLIENT_DELETE

    @CLIENT_ID INT,

    @MODIFIED_BY INT = NULL

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        UPDATE dbo.TBL_MST_CLIENT

        SET

            IS_DELETED = 1,

            IS_ACTIVE = 0,

            MODIFIED_BY = @MODIFIED_BY,

            MODIFIED_DATE = GETDATE()

        WHERE CLIENT_ID = @CLIENT_ID AND ISNULL(IS_DELETED, 0) = 0;



        IF @@ROWCOUNT = 0

        BEGIN

            SELECT 0 AS Status, 'Client not found or already deleted' AS Message;

            RETURN;

        END;



        SELECT 1 AS Status, 'Client deleted successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT 0 AS Status, ERROR_MESSAGE() AS Message;

    END CATCH;

END;

-- dbo.SP_CLIENT_GET
GO
CREATE PROCEDURE dbo.SP_CLIENT_GET

    @CLIENT_ID INT = NULL

AS

BEGIN

    SET NOCOUNT ON;



    IF @CLIENT_ID IS NULL

    BEGIN

        IF NOT EXISTS (SELECT 1 FROM dbo.TBL_MST_CLIENT WHERE ISNULL(IS_DELETED, 0) = 0)

        BEGIN

            SELECT 0 AS Status, 'No clients found' AS Message;

            RETURN;

        END;



        SELECT

            CLIENT_ID,

            CLIENT_NAME,

            LOGO_PATH,

            IS_ACTIVE,

            IS_DELETED

        FROM dbo.TBL_MST_CLIENT

        WHERE ISNULL(IS_DELETED, 0) = 0

        ORDER BY CLIENT_NAME;

        RETURN;

    END;



    IF NOT EXISTS (

        SELECT 1

        FROM dbo.TBL_MST_CLIENT

        WHERE CLIENT_ID = @CLIENT_ID AND ISNULL(IS_DELETED, 0) = 0

    )

    BEGIN

        SELECT 0 AS Status, 'Client not found' AS Message;

        RETURN;

    END;



    SELECT

        CLIENT_ID,

        CLIENT_NAME,

        LOGO_PATH,

        IS_ACTIVE,

        IS_DELETED

    FROM dbo.TBL_MST_CLIENT

    WHERE CLIENT_ID = @CLIENT_ID AND ISNULL(IS_DELETED, 0) = 0;

END;

-- dbo.SP_CLIENT_MODIFY
GO
CREATE PROCEDURE dbo.SP_CLIENT_MODIFY

    @CLIENT_ID INT,

    @CLIENT_NAME NVARCHAR(150),

    @LOGO_PATH NVARCHAR(500) = NULL,

    @MODIFIED_BY INT = NULL

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        UPDATE dbo.TBL_MST_CLIENT

        SET

            CLIENT_NAME = @CLIENT_NAME,

            LOGO_PATH = COALESCE(@LOGO_PATH, LOGO_PATH),

            MODIFIED_BY = @MODIFIED_BY,

            MODIFIED_DATE = GETDATE()

        WHERE CLIENT_ID = @CLIENT_ID AND ISNULL(IS_DELETED, 0) = 0;



        IF @@ROWCOUNT = 0

        BEGIN

            SELECT 0 AS Status, 'Client not found or already deleted' AS Message;

            RETURN;

        END;



        SELECT 1 AS Status, 'Client updated successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT 0 AS Status, ERROR_MESSAGE() AS Message;

    END CATCH;

END;

-- dbo.SP_COMMODITY_ADD
GO
CREATE PROCEDURE [dbo].[SP_COMMODITY_ADD]

(

    @COMMODITY_NAME     VARCHAR(100),

    @COMMODITY_GROUP    VARCHAR(255)  = NULL,

    @GST_APPLICABLE     BIT           = 1,

    @HSN_CODE           VARCHAR(20)   = NULL,

    @STATUS             VARCHAR(20)   = 'Active'

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY



        -- Check duplicate commodity name

        IF EXISTS (

            SELECT 1 

            FROM TBL_MST_COMMODITY 

            WHERE COMMODITY_NAME = @COMMODITY_NAME

        )

        BEGIN

            SELECT 

                0 AS Status,

                'Commodity name already exists' AS Message;

            RETURN;

        END



        -- Insert commodity

        INSERT INTO TBL_MST_COMMODITY

        (

            COMMODITY_NAME,

            COMMODITY_GROUP,

            GST_APPLICABLE,

            HSN_CODE,

            STATUS

        )

        VALUES

        (

            @COMMODITY_NAME,

            @COMMODITY_GROUP,

            @GST_APPLICABLE,

            @HSN_CODE,

            @STATUS

        );



        -- Success response

        SELECT 

            1 AS Status,

            'Commodity added successfully' AS Message;



    END TRY

    BEGIN CATCH

        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_COMMODITY_DELETE
GO
CREATE PROCEDURE [dbo].[SP_COMMODITY_DELETE]

(

    @COMMODITY_ID INT,

    @MODIFIED_BY  INT

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        IF NOT EXISTS (

            SELECT 1

            FROM TBL_MST_COMMODITY

            WHERE COMMODITY_ID = @COMMODITY_ID

        )

        BEGIN

            SELECT 

                0 AS Status,

                'Commodity not found' AS Message;

            RETURN;

        END



        -- Soft delete (Deactivate)

        UPDATE TBL_MST_COMMODITY

        SET

            IS_ACTIVE     = 0,

            MODIFIED_BY  = @MODIFIED_BY,

            MODIFIED_DATE = GETDATE()

        WHERE COMMODITY_ID = @COMMODITY_ID;



        SELECT 

            1 AS Status,

            'Commodity deleted (deactivated) successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_COMMODITY_GET
GO
CREATE PROCEDURE [dbo].[SP_COMMODITY_GET]

(

    @COMMODITY_ID INT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        SELECT

            COMMODITY_ID,

            COMMODITY_CODE,

            COMMODITY_NAME,

            DESCRIPTION,

            IS_ACTIVE,

            CREATED_BY,

            CREATED_DATE,

            MODIFIED_BY,

            MODIFIED_DATE

        FROM TBL_MST_COMMODITY

        WHERE

            (@COMMODITY_ID IS NULL OR COMMODITY_ID = @COMMODITY_ID);

    END TRY

    BEGIN CATCH

        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_COMMODITY_MODIFY
GO
CREATE PROCEDURE [dbo].[SP_COMMODITY_UPDATE]

(

    @COMMODITY_ID   INT,

    @COMMODITY_CODE VARCHAR(20),

    @COMMODITY_NAME VARCHAR(100),

    @DESCRIPTION    VARCHAR(255) = NULL,

    @IS_ACTIVE      BIT,

    @MODIFIED_BY    INT

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Check commodity exists

        IF NOT EXISTS (

            SELECT 1 

            FROM TBL_MST_COMMODITY 

            WHERE COMMODITY_ID = @COMMODITY_ID

        )

        BEGIN

            SELECT 

                0 AS Status,

                'Commodity not found' AS Message;

            RETURN;

        END



        -- Check duplicate code

        IF EXISTS (

            SELECT 1

            FROM TBL_MST_COMMODITY

            WHERE COMMODITY_CODE = @COMMODITY_CODE

              AND COMMODITY_ID <> @COMMODITY_ID

        )

        BEGIN

            SELECT 

                0 AS Status,

                'Commodity code already exists' AS Message;

            RETURN;

        END



        -- Update commodity

        UPDATE TBL_MST_COMMODITY

        SET

            COMMODITY_CODE = @COMMODITY_CODE,

            COMMODITY_NAME = @COMMODITY_NAME,

            DESCRIPTION    = @DESCRIPTION,

            IS_ACTIVE      = @IS_ACTIVE,

            MODIFIED_BY    = @MODIFIED_BY,

            MODIFIED_DATE  = GETDATE()

        WHERE COMMODITY_ID = @COMMODITY_ID;



        SELECT 

            1 AS Status,

            'Commodity updated successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_CONT_SIZE_ADD
GO
CREATE PROCEDURE [dbo].[SP_CONT_SIZE_ADD]

(

    @SizeCode    VARCHAR(10),

    @Description VARCHAR(100) = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Check duplicate SizeCode

        IF EXISTS (

            SELECT 1

            FROM TBL_MST_CONT_SIZE

            WHERE SizeCode = @SizeCode

        )

        BEGIN

            SELECT

                0 AS Status,

                'Container size code already exists' AS Message;

            RETURN;

        END



        -- Insert container size

        INSERT INTO TBL_MST_CONT_SIZE

        (

            SizeCode,

            Description

        )

        VALUES

        (

            @SizeCode,

            @Description

        );



        -- Success response

        SELECT

            1 AS Status,

            'Container size added successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_CONT_SIZE_DELETE
GO
CREATE PROCEDURE [dbo].[SP_CONT_SIZE_DELETE]

(

    @SizeID INT

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        IF NOT EXISTS (

            SELECT 1

            FROM TBL_MST_CONT_SIZE

            WHERE SizeID = @SizeID

        )

        BEGIN

            SELECT

                0 AS Status,

                'Container size not found' AS Message;

            RETURN;

        END



        DELETE FROM TBL_MST_CONT_SIZE

        WHERE SizeID = @SizeID;



        SELECT

            1 AS Status,

            'Container size deleted successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_CONT_SIZE_GET
GO
CREATE PROCEDURE [dbo].[SP_CONT_SIZE_GET]

(

    @SizeID INT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        SELECT

            SizeID,

            SizeCode,

            Description

        FROM TBL_MST_CONT_SIZE

        WHERE

            (@SizeID IS NULL OR SizeID = @SizeID);

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_CONT_SIZE_MODIFY
GO
CREATE PROCEDURE [dbo].[SP_CONT_SIZE_MODIFY]

(

    @SizeID      INT,

    @SizeCode    VARCHAR(10),

    @Description VARCHAR(100) = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Check size exists

        IF NOT EXISTS (

            SELECT 1

            FROM TBL_MST_CONT_SIZE

            WHERE SizeID = @SizeID

        )

        BEGIN

            SELECT

                0 AS Status,

                'Container size not found' AS Message;

            RETURN;

        END



        -- Check duplicate SizeCode

        IF EXISTS (

            SELECT 1

            FROM TBL_MST_CONT_SIZE

            WHERE SizeCode = @SizeCode

              AND SizeID <> @SizeID

        )

        BEGIN

            SELECT

                0 AS Status,

                'Container size code already exists' AS Message;

            RETURN;

        END



        -- Update size

        UPDATE TBL_MST_CONT_SIZE

        SET

            SizeCode    = @SizeCode,

            Description = @Description

        WHERE SizeID = @SizeID;



        SELECT

            1 AS Status,

            'Container size updated successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_CONT_TYPE_ADD
GO
CREATE PROCEDURE [dbo].[SP_CONT_TYPE_ADD]

(

    @TypeCode VARCHAR(10),

    @ISOCode  VARCHAR(10) = NULL,

    @TypeDesc VARCHAR(100) = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Check duplicate TypeCode

        IF EXISTS (

            SELECT 1

            FROM TBL_MST_CONT_TYPE

            WHERE TypeCode = @TypeCode

        )

        BEGIN

            SELECT

                0 AS Status,

                'Container type code already exists' AS Message;

            RETURN;

        END



        -- Insert container type

        INSERT INTO TBL_MST_CONT_TYPE

        (

            TypeCode,

            ISOCode,

            TypeDesc

        )

        VALUES

        (

            @TypeCode,

            @ISOCode,

            @TypeDesc

        );



        SELECT

            1 AS Status,

            'Container type added successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_CONT_TYPE_DELETE
GO
CREATE PROCEDURE [dbo].[SP_CONT_TYPE_DELETE]

(

    @TypeID INT

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        IF NOT EXISTS (

            SELECT 1

            FROM TBL_MST_CONT_TYPE

            WHERE TypeID = @TypeID

        )

        BEGIN

            SELECT

                0 AS Status,

                'Container type not found' AS Message;

            RETURN;

        END



        DELETE FROM TBL_MST_CONT_TYPE

        WHERE TypeID = @TypeID;



        SELECT

            1 AS Status,

            'Container type deleted successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_CONT_TYPE_GET
GO
CREATE PROCEDURE [dbo].[SP_CONT_TYPE_GET]

(

    @TypeID INT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        SELECT

            TypeID,

            TypeCode,

            ISOCode,

            TypeDesc

        FROM TBL_MST_CONT_TYPE

        WHERE

            (@TypeID IS NULL OR TypeID = @TypeID);

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_CONT_TYPE_MODIFY
GO
CREATE PROCEDURE [dbo].[SP_CONT_TYPE_MODIFY]

(

    @TypeID   INT,

    @TypeCode VARCHAR(10),

    @ISOCode  VARCHAR(10) = NULL,

    @TypeDesc VARCHAR(100) = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Check type exists

        IF NOT EXISTS (

            SELECT 1

            FROM TBL_MST_CONT_TYPE

            WHERE TypeID = @TypeID

        )

        BEGIN

            SELECT

                0 AS Status,

                'Container type not found' AS Message;

            RETURN;

        END



        -- Check duplicate TypeCode

        IF EXISTS (

            SELECT 1

            FROM TBL_MST_CONT_TYPE

            WHERE TypeCode = @TypeCode

              AND TypeID <> @TypeID

        )

        BEGIN

            SELECT

                0 AS Status,

                'Container type code already exists' AS Message;

            RETURN;

        END



        -- Update container type

        UPDATE TBL_MST_CONT_TYPE

        SET

            TypeCode = @TypeCode,

            ISOCode  = @ISOCode,

            TypeDesc = @TypeDesc

        WHERE TypeID = @TypeID;



        SELECT

            1 AS Status,

            'Container type updated successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.sp_creatediagram
GO
CREATE PROCEDURE dbo.sp_creatediagram

	(

		@diagramname 	sysname,

		@owner_id		int	= null, 	

		@version 		int,

		@definition 	varbinary(max)

	)

	WITH EXECUTE AS 'dbo'

	AS

	BEGIN

		set nocount on

	

		declare @theId int

		declare @retval int

		declare @IsDbo	int

		declare @userName sysname

		if(@version is null or @diagramname is null)

		begin

			RAISERROR (N'E_INVALIDARG', 16, 1);

			return -1

		end

	

		execute as caller;

		select @theId = DATABASE_PRINCIPAL_ID(); 

		select @IsDbo = IS_MEMBER(N'db_owner');

		revert; 

		

		if @owner_id is null

		begin

			select @owner_id = @theId;

		end

		else

		begin

			if @theId <> @owner_id

			begin

				if @IsDbo = 0

				begin

					RAISERROR (N'E_INVALIDARG', 16, 1);

					return -1

				end

				select @theId = @owner_id

			end

		end

		-- next 2 line only for test, will be removed after define name unique

		if EXISTS(select diagram_id from dbo.sysdiagrams where principal_id = @theId and name = @diagramname)

		begin

			RAISERROR ('The name is already used.', 16, 1);

			return -2

		end

	

		insert into dbo.sysdiagrams(name, principal_id , version, definition)

				VALUES(@diagramname, @theId, @version, @definition) ;

		

		select @retval = @@IDENTITY 

		return @retval

	END

-- dbo.SP_CUSTOMER_ACCOUNT_DETAILS_ADD
GO
CREATE PROCEDURE [dbo].[SP_CUSTOMER_ACCOUNT_DETAILS_ADD]

(

    @CUSTOMER_ID INT,

	@ACCOUNT_TYPE VARCHAR(50),

	@CHEQUE_DEPOSIT_ALLOWED BIT,

	@FINANCE_LEDGER_CODE VARCHAR(50),

	@GENERAL_TDS_PERCENTAGE DECIMAL(5,2),

	@CURRENT_BALANCE DECIMAL(18,2),

	@PERIODIC_BILLING VARCHAR(50),

	@BILLING_TYPE VARCHAR(50)

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

    

        -- Duplicate Check

        IF EXISTS (
            SELECT 1
            FROM TBL_CUSTOMER_ACCOUNT_DETAILS
            WHERE CUSTOMER_ID = @CUSTOMER_ID
            AND ACCOUNT_TYPE = @ACCOUNT_TYPE
)

        BEGIN

            SELECT 0 AS STATUS, 

                   'ACCOUNT TYPE already exist for this customer.' AS MESSAGE;

            RETURN;

        END



        INSERT INTO TBL_CUSTOMER_ACCOUNT_DETAILS

		(

		    CUSTOMER_ID,

		    ACCOUNT_TYPE,

		    CHEQUE_DEPOSIT_ALLOWED,

		    FINANCE_LEDGER_CODE,

		    GENERAL_TDS_PERCENTAGE,

		    CURRENT_BALANCE,

		    PERIODIC_BILLING,

		    BILLING_TYPE

		)

		VALUES

		(

		    @CUSTOMER_ID,

		    @ACCOUNT_TYPE,

		    @CHEQUE_DEPOSIT_ALLOWED,

		    @FINANCE_LEDGER_CODE,

		    @GENERAL_TDS_PERCENTAGE,

		    @CURRENT_BALANCE,

		    @PERIODIC_BILLING,

		    @BILLING_TYPE

		)

		SELECT 1 AS STATUS, 

               'Customer account details added successfully.' AS MESSAGE;



    END TRY

	BEGIN CATCH

	    SELECT 0 AS STATUS,

		    ERROR_MESSAGE() AS MESSAGE;

    END CATCH

END

-- dbo.SP_CUSTOMER_ADD
GO
CREATE PROCEDURE [dbo].[SP_CUSTOMER_ADD]

(

    @CUSTOMER_CODE    VARCHAR(50),

    @CUSTOMER_NAME    VARCHAR(150),

    @CUSTOMER_TYPE    VARCHAR(50) = NULL,

    @GST_MODE         VARCHAR(50) = NULL,

    @UIN              VARCHAR(50) = NULL,

    @STATE            VARCHAR(100) = NULL,

    @STATUS           BIT = 1,

    @REMARKS          VARCHAR(255) = NULL

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        IF EXISTS (

            SELECT 1 FROM TBL_MST_CUSTOMER 

            WHERE CUSTOMER_CODE = @CUSTOMER_CODE

        )

        BEGIN

            SELECT 0 AS Status, 'Customer code already exists' AS Message, NULL AS CUSTOMER_ID;

            RETURN;

        END



        INSERT INTO TBL_MST_CUSTOMER

        (CUSTOMER_CODE, CUSTOMER_NAME, CUSTOMER_TYPE, GST_MODE, UIN, STATE, STATUS, REMARKS)

        VALUES

        (@CUSTOMER_CODE, @CUSTOMER_NAME, @CUSTOMER_TYPE, @GST_MODE, @UIN, @STATE, @STATUS, @REMARKS);



        SELECT 

            1 AS Status,

            'Customer added successfully' AS Message,

            SCOPE_IDENTITY() AS CUSTOMER_ID; 



    END TRY

    BEGIN CATCH

        SELECT 0 AS Status, ERROR_MESSAGE() AS Message, NULL AS CUSTOMER_ID;

    END CATCH

END;

-- dbo.SP_CUSTOMER_CONTACT_DETAILS_ADD
GO
CREATE PROCEDURE [dbo].[SP_CUSTOMER_CONTACT_DETAILS_ADD]

(

    @CUSTOMER_ID INT,

    @ADDRESS VARCHAR(255),

    @CONTACT_PERSON VARCHAR(255),

    @PHONE VARCHAR(20),

    @EMAIL VARCHAR(150)

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY



        -- Duplicate Check

        IF EXISTS (

            SELECT 1

            FROM TBL_CUSTOMER_CONTACT_DETAILS

            WHERE CUSTOMER_ID = @CUSTOMER_ID

              AND PHONE = @PHONE

        )

        BEGIN

            SELECT 0 AS STATUS, 

                   'Contact details already exist for this customer.' AS MESSAGE;

            RETURN;

        END



        -- Insert Record

        INSERT INTO TBL_CUSTOMER_CONTACT_DETAILS

        (

            CUSTOMER_ID,

            ADDRESS,

            CONTACT_PERSON,

            PHONE,

            EMAIL

        )

        VALUES

        (

            @CUSTOMER_ID,

            @ADDRESS,

            @CONTACT_PERSON,

            @PHONE,

            @EMAIL

        );



        SELECT 1 AS STATUS, 

               'Customer contact details added successfully.' AS MESSAGE;



    END TRY

    BEGIN CATCH

        SELECT 0 AS STATUS,

               ERROR_MESSAGE() AS MESSAGE;

    END CATCH



END

-- dbo.SP_CUSTOMER_CONTACT_DETAILS_GET
GO
CREATE PROCEDURE [dbo].[SP_CUSTOMER_CONTACT_DETAILS_GET]

(

    @CONTACT_ID INT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY



        -- If specific contact requested but not found

        IF @CONTACT_ID IS NOT NULL

        AND NOT EXISTS (

            SELECT 1 

            FROM TBL_CUSTOMER_CONTACT_DETAILS 

            WHERE ID = @CONTACT_ID

        )

        BEGIN

            SELECT 0 AS STATUS,

                   'Contact details not found.' AS MESSAGE;

            RETURN;

        END



        SELECT 

            CCD.ID AS CONTACT_ID,

            CCD.CUSTOMER_ID,



            CM.CUSTOMER_CODE,

            CM.CUSTOMER_NAME,

            CM.CUSTOMER_TYPE,

            CM.GST_MODE,

			CM.UIN,

            CM.STATE,

            CM.STATUS,



            CCD.ADDRESS,

            CCD.CONTACT_PERSON,

            CCD.PHONE,

            CCD.EMAIL



        FROM TBL_CUSTOMER_CONTACT_DETAILS CCD

        INNER JOIN TBL_MST_CUSTOMER CM

            ON CM.CUSTOMER_ID = CCD.CUSTOMER_ID

        WHERE 

            (@CONTACT_ID IS NULL 

             OR CCD.ID = @CONTACT_ID)



        SELECT 1 AS STATUS, 

               'Record fetched successfully.' AS MESSAGE;



    END TRY

    BEGIN CATCH

        SELECT 0 AS STATUS,

               ERROR_MESSAGE() AS MESSAGE;

    END CATCH



END

-- dbo.SP_CUSTOMER_DELETE
GO
CREATE PROCEDURE [dbo].[SP_CUSTOMER_DELETE]

(

    @CUSTOMER_ID INT,

    @MODIFIED_BY INT  -- Not needed for hard delete, but keeping for compatibility

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Check if customer exists

        IF NOT EXISTS (

            SELECT 1

            FROM TBL_MST_CUSTOMER

            WHERE CUSTOMER_ID = @CUSTOMER_ID

        )

        BEGIN

            SELECT 

                0 AS Status,

                'Customer not found' AS Message;

            RETURN;

        END



        -- Hard delete (permanent removal)

        DELETE FROM TBL_MST_CUSTOMER

        WHERE CUSTOMER_ID = @CUSTOMER_ID;



        SELECT 

            1 AS Status,

            'Customer deleted permanently' AS Message;

    END TRY

    BEGIN CATCH

        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_CUSTOMER_DELETE_MASTER
GO
CREATE PROCEDURE SP_CUSTOMER_DELETE_MASTER
    @CUSTOMER_ID INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE TBL_MST_CUSTOMER
    SET STATUS = 0
    WHERE CUSTOMER_ID = @CUSTOMER_ID

    SELECT 'success' AS status, @CUSTOMER_ID AS customer_id
END

-- dbo.SP_CUSTOMER_GET
GO
CREATE PROCEDURE [dbo].[SP_CUSTOMER_GET]

(

    @CUSTOMER_ID INT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        SELECT

            CUSTOMER_ID,

            CUSTOMER_CODE,

            CUSTOMER_NAME,

            CUSTOMER_TYPE,

            GST_MODE,

            UIN,

            STATE,

            STATUS,

            REMARKS,

            CREATED_AT

        FROM TBL_MST_CUSTOMER

        WHERE

            STATUS = 1   -- ✅ deleted customers filter out

            AND (@CUSTOMER_ID IS NULL OR CUSTOMER_ID = @CUSTOMER_ID);

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_CUSTOMER_MODIFY
GO
CREATE PROCEDURE [dbo].[SP_CUSTOMER_MODIFY]

(
    @CUSTOMER_ID      INT,
    @CUSTOMER_CODE    VARCHAR(50),
    @CUSTOMER_NAME    VARCHAR(150),
    @CUSTOMER_TYPE    VARCHAR(50) = NULL,
    @GST_MODE         VARCHAR(50) = NULL,
    @UIN              VARCHAR(50) = NULL,
    @STATE            VARCHAR(100) = NULL,
    @STATUS           BIT = 1,
    @REMARKS          VARCHAR(255) = NULL
)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Check customer exists

        IF NOT EXISTS (

            SELECT 1 

            FROM TBL_MST_CUSTOMER

            WHERE CUSTOMER_ID = @CUSTOMER_ID

        )

        BEGIN

            SELECT 

                0 AS Status,

                'Customer not found' AS Message;

            RETURN;

        END



        -- Check duplicate customer code

        IF EXISTS (

            SELECT 1

            FROM TBL_MST_CUSTOMER

            WHERE CUSTOMER_CODE = @CUSTOMER_CODE

              AND CUSTOMER_ID <> @CUSTOMER_ID

        )

        BEGIN

            SELECT 

                0 AS Status,

                'Customer code already exists' AS Message;

            RETURN;

        END



        -- Update customer

        UPDATE TBL_MST_CUSTOMER
        SET
            CUSTOMER_CODE = @CUSTOMER_CODE,
            CUSTOMER_NAME = @CUSTOMER_NAME,
            CUSTOMER_TYPE = @CUSTOMER_TYPE,
            GST_MODE      = @GST_MODE,
            UIN           = @UIN,
            STATE         = @STATE,
            STATUS        = @STATUS,
            REMARKS       = @REMARKS
        WHERE CUSTOMER_ID = @CUSTOMER_ID;



        SELECT 

            1 AS Status,

            'Customer updated successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.sp_dropdiagram
GO
CREATE PROCEDURE dbo.sp_dropdiagram

	(

		@diagramname 	sysname,

		@owner_id	int	= null

	)

	WITH EXECUTE AS 'dbo'

	AS

	BEGIN

		set nocount on

		declare @theId 			int

		declare @IsDbo 			int

		

		declare @UIDFound 		int

		declare @DiagId			int

	

		if(@diagramname is null)

		begin

			RAISERROR ('Invalid value', 16, 1);

			return -1

		end

	

		EXECUTE AS CALLER;

		select @theId = DATABASE_PRINCIPAL_ID();

		select @IsDbo = IS_MEMBER(N'db_owner'); 

		if(@owner_id is null)

			select @owner_id = @theId;

		REVERT; 

		

		select @DiagId = diagram_id, @UIDFound = principal_id from dbo.sysdiagrams where principal_id = @owner_id and name = @diagramname 

		if(@DiagId IS NULL or (@IsDbo = 0 and @UIDFound <> @theId))

		begin

			RAISERROR ('Diagram does not exist or you do not have permission.', 16, 1)

			return -3

		end

	

		delete from dbo.sysdiagrams where diagram_id = @DiagId;

	

		return 0;

	END

-- dbo.SP_EKDEVICE_DATA_INSERT
GO
CREATE PROCEDURE  [dbo].[SP_EKDEVICE_DATA_INSERT]

	@FIRMWARE nvarchar(20),

	@PACKET_ID int,

	@PACKET_STATUS int,

	@DEVICE_IMEI nvarchar(20),

	@KALMAR_NO nvarchar(20),

	@GPS_FIX int,

	@DATE_TIME datetime,

	@LATITUDE decimal(18, 6),

	@LAT_DIR int,

	@LONGITUDE decimal(18, 6),

	@LON_DIR int,

	@NO_SATELIGHT int,

	@LK_STATUS BIT,

	@IGNITION BIT,

	@INPUT_IO nvarchar(10),

	@OUTPUT_IO nvarchar(10),

	@ANALOG1 nvarchar(10),

	@ANALOG2 nvarchar(10),

	@ENCODER1 nvarchar(50),

	@ENCODER2 nvarchar(50),

	@RFIDDATA nvarchar(50),

	@FRAMEID int 

 AS

BEGIN



	

	BEGIN TRY 

			INSERT INTO [dbo].[TBL_EKDEVICE_DATA]

				   ([FIRMWARE]    ,[PACKET_ID]   ,[PACKET_STATUS]   ,[DEVICE_IMEI]   ,[KALMAR_NO]   ,[GPS_FIX] ,[DATE_TIME] ,[LATITUDE]  ,[LAT_DIR]  ,[LONGITUDE]  ,[LON_DIR]  ,[NO_SATELIGHT] ,[LK_STATUS]  ,[IGNITION]

				   ,[INPUT_IO]  ,[OUTPUT_IO]  ,[ANALOG1]  ,[ANALOG2]  ,[ENCODER1]  ,[ENCODER2]  ,[RFIDDATA]  ,[FRAMEID])

			 VALUES

				   (@FIRMWARE , @PACKET_ID, @PACKET_STATUS,	@DEVICE_IMEI,	@KALMAR_NO ,	@GPS_FIX ,	@DATE_TIME, 	@LATITUDE,	@LAT_DIR ,	@LONGITUDE, 	@LON_DIR , 	@NO_SATELIGHT ,	@LK_STATUS ,	@IGNITION ,

					@INPUT_IO ,	@OUTPUT_IO ,	@ANALOG1 ,	@ANALOG2,	@ENCODER1 , 	@ENCODER2 ,	@RFIDDATA , 	@FRAMEID   );

	END TRY

	BEGIN CATCH

		EXEC [dbo].[INS_TB_ERROR_LOG]

	END CATCH



	BEGIN TRY 

			INSERT INTO [dbo].[TBL_EKDEVICE_LIVE_STATUS]

				   ([FIRMWARE]    ,[PACKET_ID]   ,[PACKET_STATUS]   ,[DEVICE_IMEI]   ,[KALMAR_NO]   ,[GPS_FIX] ,[DATE_TIME] ,[LATITUDE]  ,[LAT_DIR]  ,[LONGITUDE]  ,[LON_DIR]  ,[NO_SATELIGHT] ,[LK_STATUS]  ,[IGNITION]

				   ,[INPUT_IO]  ,[OUTPUT_IO]  ,[ANALOG1]  ,[ANALOG2]  ,[ENCODER1]  ,[ENCODER2]  ,[RFIDDATA]  ,[FRAMEID])

			 VALUES

				   (@FIRMWARE , @PACKET_ID, @PACKET_STATUS,	@DEVICE_IMEI,	@KALMAR_NO ,	@GPS_FIX ,	@DATE_TIME, 	@LATITUDE,	@LAT_DIR ,	@LONGITUDE, 	@LON_DIR , 	@NO_SATELIGHT ,	@LK_STATUS ,	@IGNITION ,

					@INPUT_IO ,	@OUTPUT_IO ,	@ANALOG1 ,	@ANALOG2,	@ENCODER1 , 	@ENCODER2 ,	@RFIDDATA , 	@FRAMEID   );

	END TRY

	BEGIN CATCH

		EXEC [dbo].[INS_TB_ERROR_LOG]

	END CATCH





END

-- dbo.SP_EQUIPMENT_ADD
GO
CREATE PROCEDURE [dbo].[TBL_MST_EQUIPMENT_INSERT]

(

    @Plant_ID INT,

    @Equipment_Name VARCHAR(100),

    @Device_ID VARCHAR(50),

    @Installation_Date DATE,

    @Owner_Name VARCHAR(100),

    @Equipment_Type VARCHAR(50),

    @Equipment_Maker VARCHAR(100),

    @Sim_ID VARCHAR(50),

    @VTM_ImeiNo VARCHAR(50),

    @JobAllow BIT,

    @IsActive BIT,

    @IsRemoveDevice BIT,

    @IsManualBreakdown BIT,

    @CreatedBy VARCHAR(50),



    -- height settings

    @HeightSettings dbo.HeightSettingType READONLY

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        BEGIN TRANSACTION;



        DECLARE @EquipmentID INT;



        /* 1️⃣ Insert Equipment */

        INSERT INTO TBL_MST_EQUIPMENT

        (

            Plant_ID, Equipment_Name, Device_ID, Installation_Date, Owner_Name,

            Equipment_Type, Equipment_Maker, Sim_ID, VTM_ImeiNo, JobAllow,

            IsActive, IsDelete, IsRemoveDevice, IsManualBreakdown,

            CreatedBy, CreatedDate

        )

        VALUES

        (

            @Plant_ID, @Equipment_Name, @Device_ID, @Installation_Date, @Owner_Name,

            @Equipment_Type, @Equipment_Maker, @Sim_ID, @VTM_ImeiNo, @JobAllow,

            @IsActive, 0, @IsRemoveDevice, @IsManualBreakdown,

            @CreatedBy, GETDATE()

        );



        /* 2️⃣ Capture EquipmentID */

        SET @EquipmentID = SCOPE_IDENTITY();



        /* 3️⃣ Duplicate check in height settings */

        IF EXISTS (

            SELECT 1

            FROM TBL_EQUIPMENT_HEIGHT_SETTING E

            INNER JOIN @HeightSettings H

                ON E.HEIGHT = H.HEIGHT

               AND E.EQUIPMENT_NAME = H.EQUIPMENT_NAME

              -- AND E.EQUIPMENT_ID = @EquipmentID

        )

        BEGIN

            ROLLBACK;

            SELECT 0 AS Status, 'Height setting already exists' AS Message;

            RETURN;

        END



        /* 4️⃣ Insert Height Settings */

        INSERT INTO TBL_EQUIPMENT_HEIGHT_SETTING

        (

            Equipment_ID,

            EQUIPMENT_NAME,

            HEIGHT,

            MIN_HEIGHT,

            MAX_HEIGHT,

            IS_ACTIVE,

            CREATED_BY,

            CREATED_DATE

        )

        SELECT

            @EquipmentID,

            EQUIPMENT_NAME,

            HEIGHT,

            MIN_VALUE,

            MAX_VALUE,

            1,

            @CreatedBy,

            GETDATE()

        FROM @HeightSettings;



        COMMIT;



        SELECT 

            1 AS Status,

            'Equipment and height settings added successfully' AS Message,

            @EquipmentID AS EquipmentID;



    END TRY

    BEGIN CATCH

        ROLLBACK;



        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_EQUIPMENT_DELETE
GO
CREATE PROCEDURE [dbo].[TBL_MST_EQUIPMENT_DELETE]

(

    @Equipment_ID INT,

    @DeletedBy VARCHAR(50)

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        BEGIN TRANSACTION;



        /* Soft Delete Equipment */

        UPDATE TBL_MST_EQUIPMENT

        SET 

            IsDelete = 1,

            IsActive = 0,

            ModifiedBy = @DeletedBy,

            ModifiedDate = GETDATE()

        WHERE Eqp_ID = @Equipment_ID;



        /* Soft Delete Height Settings */

        UPDATE TBL_EQUIPMENT_HEIGHT_SETTING

        SET 

            IS_ACTIVE = 0

        WHERE Equipment_ID = @Equipment_ID;



        COMMIT;



        SELECT 1 AS Status, 'Equipment deleted successfully' AS Message;



    END TRY

    BEGIN CATCH

        ROLLBACK;

        SELECT 0 AS Status, ERROR_MESSAGE() AS Message;

    END CATCH

END

-- dbo.SP_EQUIPMENT_GET
GO
CREATE PROCEDURE [dbo].[TBL_MST_EQUIPMENT_GET]

    @Equipment_ID INT = NULL

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        SELECT 

            E.Eqp_ID, E.Plant_ID, E.Equipment_Name, E.Device_ID,

            E.Installation_Date, E.Owner_Name, E.Equipment_Type,

            E.Equipment_Maker, E.Sim_ID, E.VTM_ImeiNo, E.JobAllow,

            E.IsActive, E.IsRemoveDevice, E.IsManualBreakdown,

            E.CreatedBy, E.CreatedDate

        FROM TBL_MST_EQUIPMENT E

        WHERE (@Equipment_ID IS NULL OR E.Eqp_ID = @Equipment_ID)

            AND E.IsDelete = 0;





        SELECT 

            H.HEIGHT_SETTING_ID, H.EQUIPMENT_ID, H.EQUIPMENT_NAME,

            H.HEIGHT, H.MIN_HEIGHT AS MIN_VALUE, H.MAX_HEIGHT AS MAX_VALUE,

            H.IS_ACTIVE, H.CREATED_BY, H.CREATED_DATE

        FROM TBL_EQUIPMENT_HEIGHT_SETTING H

        WHERE (@Equipment_ID IS NULL OR H.EQUIPMENT_ID = @Equipment_ID)

            AND H.IS_ACTIVE = 1

        ORDER BY H.EQUIPMENT_ID, H.HEIGHT;



    END TRY

    BEGIN CATCH

        SELECT 0 AS Status, ERROR_MESSAGE() AS Message;

    END CATCH

END

-- dbo.SP_EQUIPMENT_UPDATE
GO
CREATE PROCEDURE dbo.TBL_MST_EQUIPMENT_UPDATE

(

    @Equipment_ID INT,

    @Plant_ID INT,

    @Equipment_Name VARCHAR(100),

    @Device_ID VARCHAR(50),

    @Installation_Date DATE,

    @Owner_Name VARCHAR(100),

    @Equipment_Type VARCHAR(50),

    @Equipment_Maker VARCHAR(100),

    @Sim_ID VARCHAR(50),

    @VTM_ImeiNo VARCHAR(50),

    @JobAllow BIT,

    @IsActive BIT,

    @IsRemoveDevice BIT,

    @IsManualBreakdown BIT,

    @UpdatedBy VARCHAR(50),



    @HeightSettings dbo.HeightSettingType READONLY

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        BEGIN TRANSACTION;



        /* 1️⃣ Update Equipment */

        UPDATE TBL_MST_EQUIPMENT

        SET

            Plant_ID = @Plant_ID,

            Equipment_Name = @Equipment_Name,

            Device_ID = @Device_ID,

            Installation_Date = @Installation_Date,

            Owner_Name = @Owner_Name,

            Equipment_Type = @Equipment_Type,

            Equipment_Maker = @Equipment_Maker,

            Sim_ID = @Sim_ID,

            VTM_ImeiNo = @VTM_ImeiNo,

            JobAllow = @JobAllow,

            IsActive = @IsActive,

            IsRemoveDevice = @IsRemoveDevice,

            IsManualBreakdown = @IsManualBreakdown,

            ModifiedBy = @UpdatedBy,

            ModifiedDate = GETDATE()

        WHERE Eqp_ID = @Equipment_ID;



        /* 2️⃣ Delete Old Height Settings */

        DELETE FROM TBL_EQUIPMENT_HEIGHT_SETTING

        WHERE Equipment_ID = @Equipment_ID;



        /* 3️⃣ Insert New Height Settings */

        INSERT INTO TBL_EQUIPMENT_HEIGHT_SETTING

        (

            Equipment_ID,

            EQUIPMENT_NAME,

            HEIGHT,

            MIN_HEIGHT,

            MAX_HEIGHT,

            IS_ACTIVE,

            CREATED_BY,

            CREATED_DATE

        )

        SELECT

            @Equipment_ID,

            EQUIPMENT_NAME,

            HEIGHT,

            MIN_VALUE,

            MAX_VALUE,

            1,

            @UpdatedBy,

            GETDATE()

        FROM @HeightSettings;



        COMMIT;



        SELECT 1 AS Status, 'Equipment updated successfully' AS Message;



    END TRY

    BEGIN CATCH

        ROLLBACK;

        SELECT 0 AS Status, ERROR_MESSAGE() AS Message;

    END CATCH

END

-- dbo.SP_GET_CUSTOMER_BY_ID
GO
CREATE PROCEDURE SP_GET_CUSTOMER_BY_ID

    @CUSTOMER_ID INT

AS

BEGIN

    SET NOCOUNT ON;

    SELECT 

        m.CUSTOMER_ID, m.CUSTOMER_CODE, m.CUSTOMER_NAME,

        m.CUSTOMER_TYPE, m.GST_MODE, m.UIN, m.STATE, m.STATUS, m.REMARKS,



        i.IMPORT_LOADED_GROUND_RENT_FROM, i.IMPORT_EMPTY_GROUND_RENT_FROM,

        i.IMPORT_CARGO_STORAGE, i.BOND_NOC_WEEKS, 

        i.IN_BOND_INVOICE_NOT_REQUIRED, i.BOND_STORAGE_FROM_INBOND,



        e.EXPORT_CARGO_STORAGE_FACTOR, e.EXPORT_GROUND_RENT_FROM,



        a.ACCOUNT_TYPE, a.CHEQUE_DEPOSIT_ALLOWED, a.FINANCE_LEDGER_CODE,

        a.GENERAL_TDS_PERCENTAGE, a.CURRENT_BALANCE, 

        a.PERIODIC_BILLING, a.BILLING_TYPE,



        c.CONTACT_PERSON, c.ADDRESS, c.PHONE, c.EMAIL,



        mail.OPERATIONS_EMAIL, mail.FINANCE_EMAIL, mail.AUCTION_EMAIL,

        mail.PDA_STATEMENT_EMAIL, mail.VIP_SHARING_EMAIL, mail.VIP_EMAILS



    FROM TBL_MST_CUSTOMER m

    LEFT JOIN TBL_CUSTOMER_IMPORT_STORAGE i   ON m.CUSTOMER_ID = i.CUSTOMER_ID

    LEFT JOIN TBL_CUSTOMER_EXPORT_STORAGE e   ON m.CUSTOMER_ID = e.CUSTOMER_ID

    LEFT JOIN TBL_CUSTOMER_ACCOUNT_DETAILS a  ON m.CUSTOMER_ID = a.CUSTOMER_ID

    LEFT JOIN TBL_CUSTOMER_CONTACT_DETAILS c  ON m.CUSTOMER_ID = c.CUSTOMER_ID

    LEFT JOIN TBL_CUSTOMER_MAIL_CONFIGURATION mail ON m.CUSTOMER_ID = mail.CUSTOMER_ID

    WHERE m.CUSTOMER_ID = @CUSTOMER_ID

END

-- dbo.SP_Get_OCRContainer_Match
GO
CREATE PROCEDURE [dbo].[SP_Get_OCRContainer_Match]

(

    @FromDate DATETIME,

    @ToDate   DATETIME

)

AS

BEGIN

    SET NOCOUNT ON;



    SELECT DISTINCT

        L.Cont_No        AS New_OCRContainerNo,

        E.OCRContainerNo AS Old_OCRContainerNo,

        L.TransDate      AS Log_TransDate,

        E.TransDate      AS Equip_TransDate

    FROM EKL_TRN_EQUIPMENT_TRANSACTION E

    INNER JOIN EKL_TRN_EQUIPMENT_TRANSACTION_LOG L

        ON CAST(E.TransDate AS DATE) = CAST(L.TransDate AS DATE)

       AND DATEPART(HOUR, E.TransDate) = DATEPART(HOUR, L.TransDate)

       AND DATEPART(MINUTE, E.TransDate) = DATEPART(MINUTE, L.TransDate)

    INNER JOIN ESS_MST_EQUIPMENT EE 

        ON EE.DeviceId = E.DeviceID

    INNER JOIN ESS_MST_EQUIPMENT Eq 

        ON Eq.Equipment_Name = L.Kalmar_No

    WHERE E.OCRContainerNo LIKE '%0000%'

      AND E.TransDate between @Fromdate and @ToDate

     

END;

-- dbo.SP_GetContainerInventory
GO
CREATE PROCEDURE [dbo].[SP_GetContainerInventory]

(

    @PageIndex     INT = 1,

    @SearchFor     NVARCHAR(MAX) = NULL,

    @PageSize      INT = 25,

    @ProcessType   NVARCHAR(50) = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY



        SET @SearchFor = ISNULL(@SearchFor, '');

        SET @ProcessType = NULLIF(LTRIM(RTRIM(@ProcessType)), '');



        IF (@SearchFor <> '')

        BEGIN 

            SELECT 

                COUNT(*) OVER() AS TOTAL_RECORDS,

                ci.INVENTORY_ID,

                ci.CONTAINER_NO,

                ci.CONTAINER_SIZE_ID,

                cs.SizeCode AS CONTAINER_SIZE,

                ci.CONTAINER_TYPE_ID,

                ct.TypeCode AS CONTAINER_TYPE,

                ci.CONTAINER_PROCESS_ID,

                cp.ProcessName AS CONTAINER_PROCESS,

                ci.LINE_ID,

                cl.LINE_NAME AS CONTAINER_LINE,

                ci.COMMODITY_ID,

                cc.COMMODITY_NAME,

                ci.INVENTORY_STATUS,

                ci.YARD_ID,

                ci.GATE_IN_DATE,

                ci.GATE_OUT_DATE,

                ci.LAST_MOVED_DATE,

                ci.OFFLOAD_EQP,

                ci.TOSS_IN_DATE,

                ci.OFFLOAD_LAT,

                ci.OFFLOAD_LON,

                ([dbo].[ConvertDDHHMMSS](ci.GATE_IN_DATE, GETDATE())) AS TIME_IN_YARD,

                ci.CREATED_BY,

                ci.CREATED_DATE,

                ci.IS_ACTIVE

            FROM dbo.TBL_CONTAINER_INVENTORY ci

            LEFT JOIN dbo.TBL_MST_CONT_SIZE cs ON ci.CONTAINER_SIZE_ID = cs.SizeID

            LEFT JOIN dbo.TBL_MST_CONT_TYPE ct ON ci.CONTAINER_TYPE_ID = ct.TypeID

            LEFT JOIN dbo.TBL_MST_LINE cl ON ci.LINE_ID = cl.LINE_ID

            LEFT JOIN dbo.TBL_MST_PROCESS cp ON ci.CONTAINER_PROCESS_ID = cp.ProcessID

            LEFT JOIN dbo.TBL_MST_COMMODITY cc 

                ON ci.COMMODITY_ID = cc.COMMODITY_ID AND cc.IS_ACTIVE = 1

            WHERE 

                ci.IS_ACTIVE = 1

                AND ci.GATE_OUT_DATE IS NULL

                AND (

                        @ProcessType IS NULL

                        OR cp.ProcessName = @ProcessType

                    )

                AND EXISTS (

                    SELECT 1

                    FROM dbo.Split_String(@SearchFor, ',') s

                    WHERE ci.CONTAINER_NO LIKE '%' + LTRIM(RTRIM(s.VALUE)) + '%'

                )

            ORDER BY ci.GATE_IN_DATE DESC

            OFFSET @PageSize * (@PageIndex - 1) ROWS

            FETCH NEXT @PageSize ROWS ONLY;

        END



        ELSE

        BEGIN

            SELECT 

                COUNT(*) OVER() AS TOTAL_RECORDS,

                ci.INVENTORY_ID,

                ci.CONTAINER_NO,

                ci.CONTAINER_SIZE_ID,

                cs.SizeCode AS CONTAINER_SIZE,

                ci.CONTAINER_TYPE_ID,

                ct.TypeCode AS CONTAINER_TYPE,

                ci.CONTAINER_PROCESS_ID,

                cp.ProcessName AS CONTAINER_PROCESS,

                ci.LINE_ID,

                cl.LINE_NAME AS CONTAINER_LINE,

                ci.COMMODITY_ID,

                cc.COMMODITY_NAME,

                ci.INVENTORY_STATUS,

                ci.YARD_ID,

                ci.GATE_IN_DATE,

                ci.GATE_OUT_DATE,

                ci.LAST_MOVED_DATE,

                ci.OFFLOAD_EQP,

                ci.TOSS_IN_DATE,

                ci.OFFLOAD_LAT,

                ci.OFFLOAD_LON,

                ([dbo].[ConvertDDHHMMSS](ci.GATE_IN_DATE, GETDATE())) AS TIME_IN_YARD,

                ci.CREATED_BY,

                ci.CREATED_DATE,

                ci.IS_ACTIVE

            FROM dbo.TBL_CONTAINER_INVENTORY ci

            LEFT JOIN dbo.TBL_MST_CONT_SIZE cs ON ci.CONTAINER_SIZE_ID = cs.SizeID

            LEFT JOIN dbo.TBL_MST_CONT_TYPE ct ON ci.CONTAINER_TYPE_ID = ct.TypeID

            LEFT JOIN dbo.TBL_MST_LINE cl ON ci.LINE_ID = cl.LINE_ID

            LEFT JOIN dbo.TBL_MST_PROCESS cp ON ci.CONTAINER_PROCESS_ID = cp.ProcessID

            LEFT JOIN dbo.TBL_MST_COMMODITY cc  

                ON ci.COMMODITY_ID = cc.COMMODITY_ID AND cc.IS_ACTIVE = 1

            WHERE 

                ci.IS_ACTIVE = 1

                AND ci.GATE_OUT_DATE IS NULL

                AND (

                        @ProcessType IS NULL

                        OR cp.ProcessName = @ProcessType

                    )

            ORDER BY ISNULL(ci.YARD_ID, 9999999)

            OFFSET @PageSize * (@PageIndex - 1) ROWS

            FETCH NEXT @PageSize ROWS ONLY;

        END



        SELECT  

            cp.ProcessName AS CONTAINER_PROCESS,

            COUNT(*) AS TOTAL_COUNT

        FROM dbo.TBL_CONTAINER_INVENTORY ci

        LEFT JOIN dbo.TBL_MST_PROCESS cp 

            ON ci.CONTAINER_PROCESS_ID = cp.ProcessID

        WHERE 

            ci.IS_ACTIVE = 1 

            AND ci.GATE_OUT_DATE IS NULL

            AND (

                    @ProcessType IS NULL

                    OR cp.ProcessName = @ProcessType

                )

        GROUP BY cp.ProcessName;



    END TRY

    BEGIN CATCH

        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END

-- dbo.SP_HEIGHT_SETTING_INSERT
GO
CREATE PROCEDURE [dbo].[SP_HEIGHT_SETTING_INSERT]

(

    @HeightSettings dbo.HeightSettingType READONLY,

    @CREATED_BY VARCHAR(50)

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY



IF EXISTS (SELECT 1 FROM TBL_EQUIPMENT_HEIGHT_SETTING E

            INNER JOIN @HeightSettings H ON E.HEIGHT = H.HEIGHT

               AND E.EQUIPMENT_NAME = H.EQUIPMENT_NAME

        )

        BEGIN

            SELECT 

                0 AS Status,

                'Height setting already exists' AS Message;

            RETURN;

        END



        INSERT INTO TBL_EQUIPMENT_HEIGHT_SETTING(EQUIPMENT_NAME,HEIGHT,MIN_HEIGHT,MAX_HEIGHT,IS_ACTIVE,CREATED_BY,CREATED_DATE)

        SELECT EQUIPMENT_NAME,HEIGHT,MIN_VALUE,MAX_VALUE,1,@CREATED_BY,GETDATE() FROM @HeightSettings;

        SELECT 1 AS Status,

        'Height settings added successfully' AS Message;



    END TRY

    BEGIN CATCH

        SELECT 

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.sp_helpdiagramdefinition
GO
CREATE PROCEDURE dbo.sp_helpdiagramdefinition

	(

		@diagramname 	sysname,

		@owner_id	int	= null 		

	)

	WITH EXECUTE AS N'dbo'

	AS

	BEGIN

		set nocount on



		declare @theId 		int

		declare @IsDbo 		int

		declare @DiagId		int

		declare @UIDFound	int

	

		if(@diagramname is null)

		begin

			RAISERROR (N'E_INVALIDARG', 16, 1);

			return -1

		end

	

		execute as caller;

		select @theId = DATABASE_PRINCIPAL_ID();

		select @IsDbo = IS_MEMBER(N'db_owner');

		if(@owner_id is null)

			select @owner_id = @theId;

		revert; 

	

		select @DiagId = diagram_id, @UIDFound = principal_id from dbo.sysdiagrams where principal_id = @owner_id and name = @diagramname;

		if(@DiagId IS NULL or (@IsDbo = 0 and @UIDFound <> @theId ))

		begin

			RAISERROR ('Diagram does not exist or you do not have permission.', 16, 1);

			return -3

		end



		select version, definition FROM dbo.sysdiagrams where diagram_id = @DiagId ; 

		return 0

	END

-- dbo.sp_helpdiagrams
GO
CREATE PROCEDURE dbo.sp_helpdiagrams

	(

		@diagramname sysname = NULL,

		@owner_id int = NULL

	)

	WITH EXECUTE AS N'dbo'

	AS

	BEGIN

		DECLARE @user sysname

		DECLARE @dboLogin bit

		EXECUTE AS CALLER;

			SET @user = USER_NAME();

			SET @dboLogin = CONVERT(bit,IS_MEMBER('db_owner'));

		REVERT;

		SELECT

			[Database] = DB_NAME(),

			[Name] = name,

			[ID] = diagram_id,

			[Owner] = USER_NAME(principal_id),

			[OwnerID] = principal_id

		FROM

			sysdiagrams

		WHERE

			(@dboLogin = 1 OR USER_NAME(principal_id) = @user) AND

			(@diagramname IS NULL OR name = @diagramname) AND

			(@owner_id IS NULL OR principal_id = @owner_id)

		ORDER BY

			4, 5, 1

	END

-- dbo.SP_INS_EklavyaJsonData
GO
CREATE PROC [dbo].[SP_INS_EklavyaJsonData]

   @VehicleNo varchar(100),

   @DeviceIMEI varchar(100),

   @PacketType int,

   @Ignition int,

   @ContainerStatus int,

   @Distance int,

   @GPSDateTime varchar(250),

   @Latitude decimal(18,2),

   @Location varchar(100),

   @Longitude decimal(18,2),

   @NoOfSatalites int,

   @GPSFix int,

   @Speed int,

   @RFDATA varchar(100),

   @OCRDATA varchar(100),

   @Height varchar(50),

   @OCRBinaries varchar(100),---need to check tepm add ocr_binary in ocr img

   @Analog1 varchar(100),

   @Digital1 varchar(100),

   @FrameId int

as

begin



declare @IsSuccess as int;



set @IsSuccess=0



insert into EKL_TRN_EKDEVICEDATA (KalmarNo,DeviceIMEI,PacketID,IGNITION,ContLockStatus,Distance,DateTime,Latitude,Location,

Longitude,NoSatellites,GPSFix,Speed,RFIDDATA,OCRDATA,RTKHeight,OCR_Image,Analog1,Digital1,FRAMEID)



values (@VehicleNo, @DeviceIMEI, @PacketType, @Ignition, @ContainerStatus, @Distance, Getdate(), @Latitude, @Location,

@Longitude, @NoOfSatalites, @GPSFix, @Speed, @RFDATA, @OCRDATA,@Height,@OCRBinaries, @Analog1, @Digital1, @FRAMEID)



SET @IsSuccess=1  

SELECT @IsSuccess AS result

End

-- dbo.SP_InsertContainerInventory
GO
CREATE PROCEDURE dbo.SP_InsertContainerInventory

(

    @ContainerNo NVARCHAR(20),

    @SizeID INT,

    @TypeID INT,

    @ProcessID INT,

    @LineID INT,

    @CreatedBy NVARCHAR(50)

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        BEGIN TRANSACTION;



        IF EXISTS (

            SELECT 1

            FROM dbo.TBL_CONTAINER_INVENTORY

            WHERE CONTAINER_NO = @ContainerNo

              AND GATE_OUT_DATE IS NULL

              AND IS_ACTIVE = 1

        )

        BEGIN

            ROLLBACK TRANSACTION;

            SELECT 0 AS Status,

                   'Container already present in yard' AS Message;

            RETURN;

        END



        INSERT INTO dbo.TBL_CONTAINER_INVENTORY

        (

            CONTAINER_NO,

            CONTAINER_SIZE_ID,

            CONTAINER_TYPE_ID,

            CONTAINER_PROCESS_ID,

            LINE_ID,

            INVENTORY_STATUS,

            GATE_IN_DATE,

            IS_ACTIVE,

            CREATED_BY,

            CREATED_DATE

        )

        VALUES

        (

            @ContainerNo,

            @SizeID,

            @TypeID,

            @ProcessID,

            @LineID,

            'IN',

            GETDATE(),

            1,

            @CreatedBy,

            GETDATE()

        );



        COMMIT TRANSACTION;



        SELECT 1 AS Status,

               'Insert successful' AS Message;

    END TRY

    BEGIN CATCH

        ROLLBACK TRANSACTION;



        SELECT 0 AS Status,

               ERROR_MESSAGE() AS Message;

    END CATCH

END

-- dbo.SP_INVENTRY_INSERT
GO
CREATE PROCEDURE dbo.SP_INVENTRY_INSERT

(

    @ContainerNo NVARCHAR(20),

    @SizeID INT,

    @TypeID INT,

    @ProcessID INT,

    @LineID INT,

    @CreatedBy NVARCHAR(50)

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        BEGIN TRANSACTION;



        IF EXISTS (

            SELECT 1

            FROM dbo.TBL_CONTAINER_INVENTORY

            WHERE CONTAINER_NO = @ContainerNo

              AND GATE_OUT_DATE IS NULL

              AND IS_ACTIVE = 1

        )

        BEGIN

            ROLLBACK TRANSACTION;

            SELECT 0 AS Status,

                   'Container already present in yard' AS Message;

            RETURN;

        END



        INSERT INTO dbo.TBL_CONTAINER_INVENTORY

        (

            CONTAINER_NO,

            CONTAINER_SIZE_ID,

            CONTAINER_TYPE_ID,

            CONTAINER_PROCESS_ID,

            LINE_ID,

            INVENTORY_STATUS,

            GATE_IN_DATE,

            IS_ACTIVE,

            CREATED_BY,

            CREATED_DATE

        )

        VALUES

        (

            @ContainerNo,

            @SizeID,

            @TypeID,

            @ProcessID,

            @LineID,

            'IN',

            GETDATE(),

            1,

            @CreatedBy,

            GETDATE()

        );



        COMMIT TRANSACTION;



        SELECT 1 AS Status,

               'Insert successful' AS Message;

    END TRY

    BEGIN CATCH

        ROLLBACK TRANSACTION;



        SELECT 0 AS Status,

               ERROR_MESSAGE() AS Message;

    END CATCH

END

-- dbo.SP_LINE_ADD
GO
CREATE PROCEDURE [dbo].[SP_LINE_ADD]

(

    @LINE_CODE        VARCHAR(20),

    @LINE_NAME        VARCHAR(100),

    @CONTACT_PERSON   VARCHAR(100) = NULL,

    @CONTACT_NO       VARCHAR(20)  = NULL,

    @EMAIL_ID         VARCHAR(100) = NULL,

    @IS_ACTIVE        BIT = 1,

    @CREATED_BY       INT

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Check duplicate LINE_CODE

        IF EXISTS (

            SELECT 1

            FROM TBL_MST_LINE

            WHERE LINE_CODE = @LINE_CODE

        )

        BEGIN

            SELECT

                0 AS Status,

                'Line code already exists' AS Message;

            RETURN;

        END



        -- Insert line

        INSERT INTO TBL_MST_LINE

        (

            LINE_CODE,

            LINE_NAME,

            CONTACT_PERSON,

            CONTACT_NO,

            EMAIL_ID,

            IS_ACTIVE,

            CREATED_BY

        )

        VALUES

        (

            @LINE_CODE,

            @LINE_NAME,

            @CONTACT_PERSON,

            @CONTACT_NO,

            @EMAIL_ID,

            @IS_ACTIVE,

            @CREATED_BY

        );



        SELECT

            1 AS Status,

            'Line added successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_LINE_DELETE
GO
CREATE PROCEDURE [dbo].[SP_LINE_DELETE]

(

    @LINE_ID     INT,

    @MODIFIED_BY INT

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        IF NOT EXISTS (

            SELECT 1

            FROM TBL_MST_LINE

            WHERE LINE_ID = @LINE_ID

        )

        BEGIN

            SELECT

                0 AS Status,

                'Line not found' AS Message;

            RETURN;

        END



        -- Soft delete (Deactivate)

        UPDATE TBL_MST_LINE

        SET

            IS_ACTIVE     = 0,

            MODIFIED_BY  = @MODIFIED_BY,

            MODIFIED_DATE = GETDATE()

        WHERE LINE_ID = @LINE_ID;



        SELECT

            1 AS Status,

            'Line deleted (deactivated) successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_LINE_GET
GO
CREATE PROCEDURE [dbo].[SP_LINE_GET]

(

    @LINE_ID INT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        SELECT

            LINE_ID,

            LINE_CODE,

            LINE_NAME,

            CONTACT_PERSON,

            CONTACT_NO,

            EMAIL_ID,

            IS_ACTIVE,

            CREATED_BY,

            CREATED_DATE,

            MODIFIED_BY,

            MODIFIED_DATE

        FROM TBL_MST_LINE

        WHERE

            (@LINE_ID IS NULL OR LINE_ID = @LINE_ID);

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_LINE_MODIFY
GO
CREATE PROCEDURE [dbo].[SP_LINE_MODIFY]

(

    @LINE_ID          INT,

    @LINE_CODE        VARCHAR(20),

    @LINE_NAME        VARCHAR(100),

    @CONTACT_PERSON   VARCHAR(100) = NULL,

    @CONTACT_NO       VARCHAR(20)  = NULL,

    @EMAIL_ID         VARCHAR(100) = NULL,

    @IS_ACTIVE        BIT,

    @MODIFIED_BY      INT

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Check line exists

        IF NOT EXISTS (

            SELECT 1

            FROM TBL_MST_LINE

            WHERE LINE_ID = @LINE_ID

        )

        BEGIN

            SELECT

                0 AS Status,

                'Line not found' AS Message;

            RETURN;

        END



        -- Check duplicate LINE_CODE

        IF EXISTS (

            SELECT 1

            FROM TBL_MST_LINE

            WHERE LINE_CODE = @LINE_CODE

              AND LINE_ID <> @LINE_ID

        )

        BEGIN

            SELECT

                0 AS Status,

                'Line code already exists' AS Message;

            RETURN;

        END



        -- Update line

        UPDATE TBL_MST_LINE

        SET

            LINE_CODE      = @LINE_CODE,

            LINE_NAME      = @LINE_NAME,

            CONTACT_PERSON = @CONTACT_PERSON,

            CONTACT_NO     = @CONTACT_NO,

            EMAIL_ID       = @EMAIL_ID,

            IS_ACTIVE      = @IS_ACTIVE,

            MODIFIED_BY    = @MODIFIED_BY,

            MODIFIED_DATE  = GETDATE()

        WHERE LINE_ID = @LINE_ID;



        SELECT

            1 AS Status,

            'Line updated successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT

            0 AS Status,

            ERROR_MESSAGE() AS Message;

    END CATCH

END;

-- dbo.SP_MENU_ADD
GO
CREATE PROCEDURE dbo.SP_MENU_ADD
    @MENU_NAME      NVARCHAR(200),
    @PARENT_MENU_ID INT = NULL,
    @MENU_URL       NVARCHAR(300) = NULL,
    @MENU_ICON      NVARCHAR(100) = NULL,
    @AREA           NVARCHAR(100) = NULL,
    @CONTROLLER     NVARCHAR(100) = NULL,
    @ACTION_RESULT  NVARCHAR(100) = NULL,
    @PLANT_NAME     NVARCHAR(200) = NULL,
    @SORT_ORDER     INT = 0,
    @CREATED_BY     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM dbo.TBL_MST_MENU
        WHERE MENU_NAME = @MENU_NAME
          AND IS_DELETED = 0
          AND ((@PARENT_MENU_ID IS NULL AND PARENT_MENU_ID IS NULL) OR (PARENT_MENU_ID = @PARENT_MENU_ID))
    )
    BEGIN
        SELECT 'Failure' AS STATUS, 'Menu already exists' AS ERRORMSG;
        RETURN;
    END

    INSERT INTO dbo.TBL_MST_MENU (
        MENU_NAME, PARENT_MENU_ID, MENU_URL, MENU_ICON, AREA, CONTROLLER, ACTION_RESULT, PLANT_NAME,
        SORT_ORDER, IS_ACTIVE, IS_DELETED, CREATED_BY, CREATED_DATE
    )
    VALUES (
        @MENU_NAME, @PARENT_MENU_ID, @MENU_URL, @MENU_ICON, @AREA, @CONTROLLER, @ACTION_RESULT, @PLANT_NAME,
        ISNULL(@SORT_ORDER, 0), 1, 0, @CREATED_BY, GETDATE()
    );

    SELECT 'Success' AS STATUS, 'Menu created successfully' AS ERRORMSG, SCOPE_IDENTITY() AS MENU_ID;
END

-- dbo.SP_MENU_DELETE
GO
CREATE PROCEDURE dbo.SP_MENU_DELETE
    @MENU_ID     INT,
    @DELETED_BY  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.TBL_MST_MENU WHERE MENU_ID = @MENU_ID AND IS_DELETED = 0)
    BEGIN
        SELECT 'Failure' AS STATUS, 'Menu not found' AS ERRORMSG;
        RETURN;
    END

    UPDATE dbo.TBL_MST_MENU
    SET
        IS_DELETED = 1,
        IS_ACTIVE = 0,
        MODIFIED_BY = @DELETED_BY,
        MODIFIED_DATE = GETDATE()
    WHERE MENU_ID = @MENU_ID;

    /* also deactivate mappings */
    UPDATE dbo.TBL_MAP_ROLE_MENU
    SET
        IS_DELETED = 1,
        IS_ACTIVE = 0,
        MODIFIED_BY = @DELETED_BY,
        MODIFIED_DATE = GETDATE()
    WHERE MENU_ID = @MENU_ID;

    SELECT 'Success' AS STATUS, 'Menu deleted successfully' AS ERRORMSG;
END

-- dbo.SP_MENU_GET_ALL
GO
CREATE PROCEDURE dbo.SP_MENU_GET_ALL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        MENU_ID,
        MENU_NAME,
        PARENT_MENU_ID,
        MENU_URL,
        MENU_ICON,
        AREA,
        CONTROLLER,
        ACTION_RESULT,
        PLANT_NAME,
        SORT_ORDER,
        IS_ACTIVE,
        IS_DELETED
    FROM dbo.TBL_MST_MENU
    WHERE IS_DELETED = 0
    ORDER BY
        ISNULL(PARENT_MENU_ID, 0),
        SORT_ORDER,
        MENU_NAME;
END

-- dbo.SP_MENU_MODIFY
GO
CREATE PROCEDURE dbo.SP_MENU_MODIFY
    @MENU_ID        INT,
    @MENU_NAME      NVARCHAR(200),
    @PARENT_MENU_ID INT = NULL,
    @MENU_URL       NVARCHAR(300) = NULL,
    @MENU_ICON      NVARCHAR(100) = NULL,
    @AREA           NVARCHAR(100) = NULL,
    @CONTROLLER     NVARCHAR(100) = NULL,
    @ACTION_RESULT  NVARCHAR(100) = NULL,
    @PLANT_NAME     NVARCHAR(200) = NULL,
    @SORT_ORDER     INT = 0,
    @IS_ACTIVE      BIT = 1,
    @MODIFIED_BY    INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.TBL_MST_MENU WHERE MENU_ID = @MENU_ID AND IS_DELETED = 0)
    BEGIN
        SELECT 'Failure' AS STATUS, 'Menu not found' AS ERRORMSG;
        RETURN;
    END

    UPDATE dbo.TBL_MST_MENU
    SET
        MENU_NAME = @MENU_NAME,
        PARENT_MENU_ID = @PARENT_MENU_ID,
        MENU_URL = @MENU_URL,
        MENU_ICON = @MENU_ICON,
        AREA = @AREA,
        CONTROLLER = @CONTROLLER,
        ACTION_RESULT = @ACTION_RESULT,
        PLANT_NAME = @PLANT_NAME,
        SORT_ORDER = ISNULL(@SORT_ORDER, 0),
        IS_ACTIVE = ISNULL(@IS_ACTIVE, 1),
        MODIFIED_BY = @MODIFIED_BY,
        MODIFIED_DATE = GETDATE()
    WHERE MENU_ID = @MENU_ID;

    SELECT 'Success' AS STATUS, 'Menu updated successfully' AS ERRORMSG;
END

-- dbo.SP_PROCESS_ADD
GO
CREATE PROCEDURE dbo.SP_PROCESS_ADD

(

    @ProcessCode     VARCHAR(20),

    @ProcessName     VARCHAR(100),

    @ProcessCategory VARCHAR(50) = NULL,

    @SortOrder       INT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Duplicate check

        IF EXISTS (

            SELECT 1 

            FROM TBL_MST_PROCESS 

            WHERE ProcessCode = @ProcessCode 

              AND IsDeleted = 0

        )

        BEGIN

            SELECT 0 AS Status, 'Process code already exists' AS Message;

            RETURN;

        END



        INSERT INTO TBL_MST_PROCESS

        (

            ProcessCode,

            ProcessName,

            ProcessCategory,

            SortOrder

        )

        VALUES

        (

            @ProcessCode,

            @ProcessName,

            @ProcessCategory,

            @SortOrder

        );



        SELECT 1 AS Status, 'Process added successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT 0 AS Status, ERROR_MESSAGE() AS Message;

    END CATCH

END

-- dbo.SP_PROCESS_DELETE
GO
CREATE PROCEDURE dbo.SP_PROCESS_DELETE

(

    @ProcessID INT

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        IF NOT EXISTS (

            SELECT 1 

            FROM TBL_MST_PROCESS 

            WHERE ProcessID = @ProcessID 

              AND IsDeleted = 0

        )

        BEGIN

            SELECT 0 AS Status, 'Process not found' AS Message;

            RETURN;

        END



        UPDATE TBL_MST_PROCESS

        SET

            IsDeleted = 1,

            IsActive  = 0

        WHERE ProcessID = @ProcessID;



        SELECT 1 AS Status, 'Process deleted successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT 0 AS Status, ERROR_MESSAGE() AS Message;

    END CATCH

END

-- dbo.SP_PROCESS_GET
GO
CREATE PROCEDURE dbo.SP_PROCESS_GET

(

    @ProcessID INT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        SELECT

            ProcessID,

            ProcessCode,

            ProcessName,

            ProcessCategory,

            SortOrder,

            IsActive,

            IsDeleted,

            CreatedOn

        FROM TBL_MST_PROCESS

        WHERE IsDeleted = 0

          AND (@ProcessID IS NULL OR ProcessID = @ProcessID)

        ORDER BY SortOrder;

    END TRY

    BEGIN CATCH

        SELECT 0 AS Status, ERROR_MESSAGE() AS Message;

    END CATCH

END

-- dbo.SP_PROCESS_MODIFY
GO
CREATE PROCEDURE dbo.SP_PROCESS_MODIFY

(

    @ProcessID       INT,

    @ProcessCode     VARCHAR(20),

    @ProcessName     VARCHAR(100),

    @ProcessCategory VARCHAR(50) = NULL,

    @SortOrder       INT = NULL,

    @IsActive        BIT

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- Check exists

        IF NOT EXISTS (

            SELECT 1 

            FROM TBL_MST_PROCESS 

            WHERE ProcessID = @ProcessID 

              AND IsDeleted = 0

        )

        BEGIN

            SELECT 0 AS Status, 'Process not found' AS Message;

            RETURN;

        END



        -- Duplicate code check

        IF EXISTS (

            SELECT 1 

            FROM TBL_MST_PROCESS 

            WHERE ProcessCode = @ProcessCode

              AND ProcessID <> @ProcessID

              AND IsDeleted = 0

        )

        BEGIN

            SELECT 0 AS Status, 'Process code already exists' AS Message;

            RETURN;

        END



        UPDATE TBL_MST_PROCESS

        SET

            ProcessCode     = @ProcessCode,

            ProcessName     = @ProcessName,

            ProcessCategory = @ProcessCategory,

            SortOrder       = @SortOrder,

            IsActive        = @IsActive

        WHERE ProcessID = @ProcessID;



        SELECT 1 AS Status, 'Process updated successfully' AS Message;

    END TRY

    BEGIN CATCH

        SELECT 0 AS Status, ERROR_MESSAGE() AS Message;

    END CATCH

END

-- dbo.sp_renamediagram
GO
CREATE PROCEDURE dbo.sp_renamediagram

	(

		@diagramname 		sysname,

		@owner_id		int	= null,

		@new_diagramname	sysname

	

	)

	WITH EXECUTE AS 'dbo'

	AS

	BEGIN

		set nocount on

		declare @theId 			int

		declare @IsDbo 			int

		

		declare @UIDFound 		int

		declare @DiagId			int

		declare @DiagIdTarg		int

		declare @u_name			sysname

		if((@diagramname is null) or (@new_diagramname is null))

		begin

			RAISERROR ('Invalid value', 16, 1);

			return -1

		end

	

		EXECUTE AS CALLER;

		select @theId = DATABASE_PRINCIPAL_ID();

		select @IsDbo = IS_MEMBER(N'db_owner'); 

		if(@owner_id is null)

			select @owner_id = @theId;

		REVERT;

	

		select @u_name = USER_NAME(@owner_id)

	

		select @DiagId = diagram_id, @UIDFound = principal_id from dbo.sysdiagrams where principal_id = @owner_id and name = @diagramname 

		if(@DiagId IS NULL or (@IsDbo = 0 and @UIDFound <> @theId))

		begin

			RAISERROR ('Diagram does not exist or you do not have permission.', 16, 1)

			return -3

		end

	

		-- if((@u_name is not null) and (@new_diagramname = @diagramname))	-- nothing will change

		--	return 0;

	

		if(@u_name is null)

			select @DiagIdTarg = diagram_id from dbo.sysdiagrams where principal_id = @theId and name = @new_diagramname

		else

			select @DiagIdTarg = diagram_id from dbo.sysdiagrams where principal_id = @owner_id and name = @new_diagramname

	

		if((@DiagIdTarg is not null) and  @DiagId <> @DiagIdTarg)

		begin

			RAISERROR ('The name is already used.', 16, 1);

			return -2

		end		

	

		if(@u_name is null)

			update dbo.sysdiagrams set [name] = @new_diagramname, principal_id = @theId where diagram_id = @DiagId

		else

			update dbo.sysdiagrams set [name] = @new_diagramname where diagram_id = @DiagId

		return 0

	END

-- dbo.SP_ROLE_ADD
GO
CREATE PROCEDURE [dbo].[SP_ROLE_ADD]

(

    @ROLE        VARCHAR(50),

    @CREATED_BY  INT

)

AS

BEGIN

    SET NOCOUNT ON;



  

    IF EXISTS (SELECT 1 FROM TBL_MST_ROLE WHERE ROLE = @ROLE AND IS_DELETED = 0)

    BEGIN

        SELECT 'Failure' AS STATUS, 'Role already exists' AS ERRORMSG;

        RETURN;

    END





    DECLARE @DeletedRoleID INT;

    SELECT @DeletedRoleID = ROLE_ID FROM TBL_MST_ROLE WHERE ROLE = @ROLE AND IS_DELETED = 1;



    IF @DeletedRoleID IS NOT NULL

    BEGIN

      

        UPDATE TBL_MST_ROLE

        SET IS_DELETED = 0,

            IS_ACTIVE = 1,

         

          

            CREATED_BY = @CREATED_BY     

        WHERE ROLE_ID = @DeletedRoleID;



        SELECT 'Success' AS STATUS, 'Role restored successfully' AS ERRORMSG;

        RETURN;

    END





    INSERT INTO TBL_MST_ROLE

    (

        ROLE,

        IS_ACTIVE,

        IS_DELETED,

        CREATED_BY

    )

    VALUES

    (

        @ROLE,

        1,

        0,

        @CREATED_BY

    );



    SELECT 'Success' AS STATUS, 'Role created successfully' AS ERRORMSG;

END;

-- dbo.SP_ROLE_DELETE
GO
CREATE PROCEDURE [dbo].[SP_ROLE_DELETE]

(

    @ROLE_ID    INT,

    @DELETED_BY INT

)

AS

BEGIN

    SET NOCOUNT ON;



    -- Role exists?

    IF NOT EXISTS (

        SELECT 1 FROM TBL_MST_ROLE

        WHERE ROLE_ID = @ROLE_ID

        AND IS_DELETED = 0

    )

    BEGIN

        SELECT 'Failure' AS STATUS, 'Role not found' AS ERRORMSG;

        RETURN;

    END



    UPDATE TBL_MST_ROLE

    SET

        IS_DELETED = 1,

        IS_ACTIVE = 0,

        DELETED_BY = @DELETED_BY,

        DELETED_DATE = GETDATE()

    WHERE ROLE_ID = @ROLE_ID;



    SELECT 'Success' AS STATUS, 'Role deleted successfully' AS ERRORMSG;

END;

-- dbo.SP_ROLE_MENU_GET_BY_ROLE
GO
CREATE PROCEDURE dbo.SP_ROLE_MENU_GET_BY_ROLE
    @ROLE_ID INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        m.MENU_ID,
        m.MENU_NAME,
        m.PARENT_MENU_ID,
        m.MENU_URL,
        m.SORT_ORDER
    FROM dbo.TBL_MAP_ROLE_MENU rm
    INNER JOIN dbo.TBL_MST_MENU m ON m.MENU_ID = rm.MENU_ID
    WHERE rm.ROLE_ID = @ROLE_ID
      AND rm.IS_DELETED = 0
      AND rm.IS_ACTIVE = 1
      AND m.IS_DELETED = 0
      AND m.IS_ACTIVE = 1
    ORDER BY ISNULL(m.PARENT_MENU_ID, 0), m.SORT_ORDER, m.MENU_NAME;
END

-- dbo.SP_ROLE_MENU_SET
GO
CREATE PROCEDURE dbo.SP_ROLE_MENU_SET
    @ROLE_ID        INT,
    @MENU_IDS_CSV   NVARCHAR(MAX),
    @CREATED_BY     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    /* mark everything deleted first */
    UPDATE dbo.TBL_MAP_ROLE_MENU
    SET
        IS_DELETED = 1,
        IS_ACTIVE = 0,
        MODIFIED_BY = @CREATED_BY,
        MODIFIED_DATE = GETDATE()
    WHERE ROLE_ID = @ROLE_ID;

    ;WITH ids AS (
        SELECT DISTINCT TRY_CAST(LTRIM(RTRIM(value)) AS INT) AS MENU_ID
        FROM STRING_SPLIT(ISNULL(@MENU_IDS_CSV, ''), ',')
        WHERE LTRIM(RTRIM(value)) <> ''
    )
    MERGE dbo.TBL_MAP_ROLE_MENU AS tgt
    USING (
        SELECT @ROLE_ID AS ROLE_ID, MENU_ID
        FROM ids
        WHERE MENU_ID IS NOT NULL
    ) AS src
    ON tgt.ROLE_ID = src.ROLE_ID AND tgt.MENU_ID = src.MENU_ID
    WHEN MATCHED THEN
        UPDATE SET
            IS_DELETED = 0,
            IS_ACTIVE = 1,
            MODIFIED_BY = @CREATED_BY,
            MODIFIED_DATE = GETDATE()
    WHEN NOT MATCHED THEN
        INSERT (ROLE_ID, MENU_ID, IS_ACTIVE, IS_DELETED, CREATED_BY, CREATED_DATE)
        VALUES (src.ROLE_ID, src.MENU_ID, 1, 0, @CREATED_BY, GETDATE());

    SELECT 'Success' AS STATUS, 'Role menus updated successfully' AS ERRORMSG;
END

-- dbo.SP_ROLE_MODIFY
GO
CREATE PROCEDURE [dbo].[SP_ROLE_MODIFY]

(

    @ROLE_ID     INT,

    @ROLE        VARCHAR(50),

    @MODIFIED_BY INT

)

AS

BEGIN

    SET NOCOUNT ON;



    -- Role exists?

    IF NOT EXISTS (

        SELECT 1 FROM TBL_MST_ROLE

        WHERE ROLE_ID = @ROLE_ID

        AND IS_DELETED = 0

    )

    BEGIN

        SELECT 'Failure' AS STATUS, 'Role not found' AS ERRORMSG;

        RETURN;

    END



    -- Duplicate role name check

    IF EXISTS (

        SELECT 1 FROM TBL_MST_ROLE

        WHERE ROLE = @ROLE

        AND ROLE_ID <> @ROLE_ID

        AND IS_DELETED = 0

    )

    BEGIN

        SELECT 'Failure' AS STATUS, 'Role name already exists' AS ERRORMSG;

        RETURN;

    END



    UPDATE TBL_MST_ROLE

    SET

        ROLE = @ROLE,

        MODIFIED_BY = @MODIFIED_BY,

        MODIFIED_DATE = GETDATE()

    WHERE ROLE_ID = @ROLE_ID;



    SELECT 'Success' AS STATUS, 'Role updated successfully' AS ERRORMSG;

END;

-- dbo.SP_SavePlant
GO
CREATE   PROCEDURE [dbo].[SP_SavePlant]

    @PlantID INT = NULL,

    @PlantCode NVARCHAR(50) = NULL,

    @PlantName NVARCHAR(150),

    @Location NVARCHAR(250) = NULL,

    @ClientID INT = NULL,

    @IsActive BIT = 1,

    @UserID INT

AS

BEGIN

    SET NOCOUNT ON;



    -- Duplicate check

    IF EXISTS (

        SELECT 1 FROM TBL_MST_PLANT

        WHERE PLANT_NAME = @PlantName

        AND IS_DELETED = 0

        AND (@PlantID IS NULL OR PLANT_ID <> @PlantID)

    )

    BEGIN

        SELECT 0 AS STATUS, 'Plant already exists' AS MESSAGE;

        RETURN;

    END



    IF @PlantID IS NULL OR @PlantID = 0

    BEGIN

        INSERT INTO TBL_MST_PLANT (

            PLANT_CODE, PLANT_NAME, LOCATION, CLIENT_ID,

            IS_ACTIVE, IS_DELETED, CREATED_BY, CREATED_DATE

        )

        VALUES (

            @PlantCode, @PlantName, @Location, @ClientID,

            @IsActive, 0, @UserID, GETDATE()

        );



        SELECT 1 AS STATUS, 'Created' AS MESSAGE;



        SELECT * 

        FROM TBL_MST_PLANT 

        WHERE PLANT_ID = SCOPE_IDENTITY();

    END

    ELSE

    BEGIN

        UPDATE TBL_MST_PLANT

        SET

            PLANT_CODE = @PlantCode,

            PLANT_NAME = @PlantName,

            LOCATION = @Location,

            CLIENT_ID = @ClientID,

            IS_ACTIVE = @IsActive,

            MODIFIED_BY = @UserID,

            MODIFIED_DATE = GETDATE()

        WHERE PLANT_ID = @PlantID AND IS_DELETED = 0;



        SELECT 1 AS STATUS, 'Updated' AS MESSAGE;



        SELECT * 

        FROM TBL_MST_PLANT 

        WHERE PLANT_ID = @PlantID;

    END

END

-- dbo.SP_UPDATE_CUSTOMER_MASTER
GO
CREATE PROCEDURE SP_UPDATE_CUSTOMER_MASTER

    @CUSTOMER_ID INT,

    -- Basic

    @CUSTOMER_CODE NVARCHAR(50) = NULL,

    @CUSTOMER_NAME NVARCHAR(200) = NULL,

    @CUSTOMER_TYPE NVARCHAR(50) = NULL,

    @GST_MODE NVARCHAR(50) = NULL,

    @UIN NVARCHAR(100) = NULL,

    @STATE NVARCHAR(100) = NULL,

    @STATUS BIT = NULL,

    @REMARKS NVARCHAR(500) = NULL,

    -- Cargo Import

    @IMPORT_LOADED_GROUND_RENT_FROM DATETIME = NULL,

    @IMPORT_EMPTY_GROUND_RENT_FROM DATETIME = NULL,

    @IMPORT_CARGO_STORAGE DECIMAL(10,2) = NULL,

    @BOND_NOC_WEEKS INT = NULL,

    @IN_BOND_INVOICE_NOT_REQUIRED BIT = NULL,

    @BOND_STORAGE_FROM_INBOND DATETIME = NULL,

    -- Cargo Export

    @EXPORT_CARGO_STORAGE_FACTOR DECIMAL(10,2) = NULL,

    @EXPORT_GROUND_RENT_FROM DATETIME = NULL,

    -- Financial

    @ACCOUNT_TYPE NVARCHAR(50) = NULL,

    @CHEQUE_DEPOSIT_ALLOWED BIT = NULL,

    @FINANCE_LEDGER_CODE NVARCHAR(100) = NULL,

    @GENERAL_TDS_PERCENTAGE DECIMAL(5,2) = NULL,

    @PERIODIC_BILLING NVARCHAR(50) = NULL,

    @BILLING_TYPE NVARCHAR(50) = NULL,

    -- Contact

    @CONTACT_PERSON NVARCHAR(200) = NULL,

    @ADDRESS NVARCHAR(500) = NULL,

    @PHONE NVARCHAR(20) = NULL,

    @EMAIL NVARCHAR(200) = NULL,

    -- Mail

    @OPERATIONS_EMAIL NVARCHAR(200) = NULL,

    @FINANCE_EMAIL NVARCHAR(200) = NULL,

    @AUCTION_EMAIL NVARCHAR(200) = NULL,

    @PDA_STATEMENT_EMAIL NVARCHAR(200) = NULL,

    @VIP_SHARING_EMAIL NVARCHAR(200) = NULL,

    @VIP_EMAILS NVARCHAR(200) = NULL

AS

BEGIN

    SET NOCOUNT ON;



    UPDATE TBL_MST_CUSTOMER SET

        CUSTOMER_CODE = ISNULL(@CUSTOMER_CODE, CUSTOMER_CODE),

        CUSTOMER_NAME = ISNULL(@CUSTOMER_NAME, CUSTOMER_NAME),

        CUSTOMER_TYPE = ISNULL(@CUSTOMER_TYPE, CUSTOMER_TYPE),

        GST_MODE      = ISNULL(@GST_MODE, GST_MODE),

        UIN           = ISNULL(@UIN, UIN),

        STATE         = ISNULL(@STATE, STATE),

        STATUS        = ISNULL(@STATUS, STATUS),

        REMARKS       = ISNULL(@REMARKS, REMARKS)

    WHERE CUSTOMER_ID = @CUSTOMER_ID



    UPDATE TBL_CUSTOMER_IMPORT_STORAGE SET

        IMPORT_LOADED_GROUND_RENT_FROM = ISNULL(@IMPORT_LOADED_GROUND_RENT_FROM, IMPORT_LOADED_GROUND_RENT_FROM),

        IMPORT_EMPTY_GROUND_RENT_FROM  = ISNULL(@IMPORT_EMPTY_GROUND_RENT_FROM, IMPORT_EMPTY_GROUND_RENT_FROM),

        IMPORT_CARGO_STORAGE           = ISNULL(@IMPORT_CARGO_STORAGE, IMPORT_CARGO_STORAGE),

        BOND_NOC_WEEKS                 = ISNULL(@BOND_NOC_WEEKS, BOND_NOC_WEEKS),

        IN_BOND_INVOICE_NOT_REQUIRED   = ISNULL(@IN_BOND_INVOICE_NOT_REQUIRED, IN_BOND_INVOICE_NOT_REQUIRED),

        BOND_STORAGE_FROM_INBOND       = ISNULL(@BOND_STORAGE_FROM_INBOND, BOND_STORAGE_FROM_INBOND)

    WHERE CUSTOMER_ID = @CUSTOMER_ID



    UPDATE TBL_CUSTOMER_EXPORT_STORAGE SET

        EXPORT_CARGO_STORAGE_FACTOR = ISNULL(@EXPORT_CARGO_STORAGE_FACTOR, EXPORT_CARGO_STORAGE_FACTOR),

        EXPORT_GROUND_RENT_FROM     = ISNULL(@EXPORT_GROUND_RENT_FROM, EXPORT_GROUND_RENT_FROM)

    WHERE CUSTOMER_ID = @CUSTOMER_ID



    UPDATE TBL_CUSTOMER_ACCOUNT_DETAILS SET

        ACCOUNT_TYPE           = ISNULL(@ACCOUNT_TYPE, ACCOUNT_TYPE),

        CHEQUE_DEPOSIT_ALLOWED = ISNULL(@CHEQUE_DEPOSIT_ALLOWED, CHEQUE_DEPOSIT_ALLOWED),

        FINANCE_LEDGER_CODE    = ISNULL(@FINANCE_LEDGER_CODE, FINANCE_LEDGER_CODE),

        GENERAL_TDS_PERCENTAGE = ISNULL(@GENERAL_TDS_PERCENTAGE, GENERAL_TDS_PERCENTAGE),

        PERIODIC_BILLING       = ISNULL(@PERIODIC_BILLING, PERIODIC_BILLING),

        BILLING_TYPE           = ISNULL(@BILLING_TYPE, BILLING_TYPE)

    WHERE CUSTOMER_ID = @CUSTOMER_ID



    UPDATE TBL_CUSTOMER_CONTACT_DETAILS SET

        CONTACT_PERSON = ISNULL(@CONTACT_PERSON, CONTACT_PERSON),

        ADDRESS        = ISNULL(@ADDRESS, ADDRESS),

        PHONE          = ISNULL(@PHONE, PHONE),

        EMAIL          = ISNULL(@EMAIL, EMAIL)

    WHERE CUSTOMER_ID = @CUSTOMER_ID



    UPDATE TBL_CUSTOMER_MAIL_CONFIGURATION SET

        OPERATIONS_EMAIL    = ISNULL(@OPERATIONS_EMAIL, OPERATIONS_EMAIL),

        FINANCE_EMAIL       = ISNULL(@FINANCE_EMAIL, FINANCE_EMAIL),

        AUCTION_EMAIL       = ISNULL(@AUCTION_EMAIL, AUCTION_EMAIL),

        PDA_STATEMENT_EMAIL = ISNULL(@PDA_STATEMENT_EMAIL, PDA_STATEMENT_EMAIL),

        VIP_SHARING_EMAIL   = ISNULL(@VIP_SHARING_EMAIL, VIP_SHARING_EMAIL),

        VIP_EMAILS          = ISNULL(@VIP_EMAILS, VIP_EMAILS)

    WHERE CUSTOMER_ID = @CUSTOMER_ID



    SELECT 'success' AS status, @CUSTOMER_ID AS customer_id

END

-- dbo.sp_upgraddiagrams
GO
CREATE PROCEDURE dbo.sp_upgraddiagrams

	AS

	BEGIN

		IF OBJECT_ID(N'dbo.sysdiagrams') IS NOT NULL

			return 0;

	

		CREATE TABLE dbo.sysdiagrams

		(

			name sysname NOT NULL,

			principal_id int NOT NULL,	-- we may change it to varbinary(85)

			diagram_id int PRIMARY KEY IDENTITY,

			version int,

	

			definition varbinary(max)

			CONSTRAINT UK_principal_name UNIQUE

			(

				principal_id,

				name

			)

		);





		/* Add this if we need to have some form of extended properties for diagrams */

		/*

		IF OBJECT_ID(N'dbo.sysdiagram_properties') IS NULL

		BEGIN

			CREATE TABLE dbo.sysdiagram_properties

			(

				diagram_id int,

				name sysname,

				value varbinary(max) NOT NULL

			)

		END

		*/



		IF OBJECT_ID(N'dbo.dtproperties') IS NOT NULL

		begin

			insert into dbo.sysdiagrams

			(

				[name],

				[principal_id],

				[version],

				[definition]

			)

			select	 

				convert(sysname, dgnm.[uvalue]),

				DATABASE_PRINCIPAL_ID(N'dbo'),			-- will change to the sid of sa

				0,							-- zero for old format, dgdef.[version],

				dgdef.[lvalue]

			from dbo.[dtproperties] dgnm

				inner join dbo.[dtproperties] dggd on dggd.[property] = 'DtgSchemaGUID' and dggd.[objectid] = dgnm.[objectid]	

				inner join dbo.[dtproperties] dgdef on dgdef.[property] = 'DtgSchemaDATA' and dgdef.[objectid] = dgnm.[objectid]

				

			where dgnm.[property] = 'DtgSchemaNAME' and dggd.[uvalue] like N'_EA3E6268-D998-11CE-9454-00AA00A3F36E_' 

			return 2;

		end

		return 1;

	END

-- dbo.SP_USER_CREATE
GO
CREATE PROCEDURE SP_USER_CREATE

(

    @ROLE_ID        INT,

    @FIRST_NAME     VARCHAR(50),

    @LAST_NAME      VARCHAR(50),

    @USERNAME       VARCHAR(50),

    @PASSWORD       VARCHAR(50),

    @EMAIL_ID       VARCHAR(100),

    @CREATED_BY     INT

)

AS

BEGIN

    SET NOCOUNT ON;



    -- Check duplicate username

    IF EXISTS (

        SELECT 1 FROM TBL_MST_USER

        WHERE USERNAME = @USERNAME

        AND IS_DELETED = 0

    )

    BEGIN

        SELECT 'Failure' AS STATUS, 'Username already exists' AS MSG;

        RETURN;

    END



    INSERT INTO TBL_MST_USER

    (

        ROLE_ID, FIRST_NAME, LAST_NAME, USERNAME, PASSWORD,

        EMAIL_ID, CREATED_BY

    )

    VALUES

    (

        @ROLE_ID, @FIRST_NAME, @LAST_NAME, @USERNAME, @PASSWORD,

        @EMAIL_ID, @CREATED_BY

    );



    SELECT 'Success' AS STATUS, 'User created successfully' AS MSG;

END;

-- dbo.SP_USER_DELETE
GO
CREATE PROCEDURE SP_USER_DELETE

(

    @USER_ID     BIGINT,

    @DELETED_BY INT

)

AS

BEGIN

    SET NOCOUNT ON;



    IF NOT EXISTS (

        SELECT 1 FROM TBL_MST_USER

        WHERE USER_ID = @USER_ID

        AND IS_DELETED = 0

    )

    BEGIN

        SELECT 'Failure' AS STATUS, 'User not found' AS MSG;

        RETURN;

    END



    UPDATE TBL_MST_USER

    SET

        IS_DELETED   = 1,

        IsActive     = 0,

        DELETED_BY   = @DELETED_BY,

        DELETED_DATE = GETDATE()

    WHERE USER_ID = @USER_ID;



    SELECT 'Success' AS STATUS, 'User deleted successfully' AS MSG;

END;

-- dbo.SP_USER_LOGIN
GO
CREATE PROCEDURE dbo.SP_USER_LOGIN
    @USERNAME NVARCHAR(50),
    @PASSWORD NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Check if user exists with matching credentials and is active
        DECLARE @UserExists INT = 0;
        
        SELECT 
            @UserExists = COUNT(*)
        FROM dbo.TBL_MST_USER
        WHERE USERNAME = @USERNAME
          AND PASSWORD = @PASSWORD
          AND IsActive = 1;
        
        IF @UserExists = 0
        BEGIN
            -- User not found or invalid credentials
            SELECT 
                'Failure' AS STATUS,
                'Invalid credentials' AS MSG,
                NULL AS USER_ID,
                NULL AS FIRST_NAME,
                NULL AS LAST_NAME,
                NULL AS EMAIL_ID,
                NULL AS ROLE_ID,
                NULL AS ROLE,
                NULL AS PLANT_ID;
            RETURN;
        END;
        
        -- Fetch user details along with plant assignment from role
        SELECT 
            'Success' AS STATUS,
            'Login successful' AS MSG,
            u.USER_ID,
            u.FIRST_NAME,
            u.LAST_NAME,
            u.EMAIL_ID,
            u.ROLE_ID,
            r.ROLE,
            ISNULL(r.PLANT_ID, 1) AS PLANT_ID
        FROM dbo.TBL_MST_USER u
        INNER JOIN dbo.TBL_MST_ROLE r ON u.ROLE_ID = r.ROLE_ID
        WHERE u.USERNAME = @USERNAME
          AND u.PASSWORD = @PASSWORD
          AND u.IsActive = 1;
        
    END TRY
    BEGIN CATCH
        -- Handle any errors
        SELECT 
            'Failure' AS STATUS,
            ERROR_MESSAGE() AS MSG,
            NULL AS USER_ID,
            NULL AS FIRST_NAME,
            NULL AS LAST_NAME,
            NULL AS EMAIL_ID,
            NULL AS ROLE_ID,
            NULL AS ROLE,
            NULL AS PLANT_ID;
    END CATCH;
END;

-- dbo.SP_USER_MODIFY
GO
CREATE PROCEDURE dbo.SP_USER_MODIFY

(

    @USER_ID     INT,

    @ROLE_ID     INT,

    @FIRST_NAME  VARCHAR(100),

    @LAST_NAME   VARCHAR(100),

    @USERNAME    VARCHAR(100),

    @PASSWORD    VARCHAR(255) = NULL,

    @EMAIL_ID    VARCHAR(100),

    @IS_ACTIVE   BIT,

    @MODIFIED_BY INT

)

AS

BEGIN

    SET NOCOUNT ON;



    BEGIN TRY

        -- 1️⃣ User exists & not deleted

        IF NOT EXISTS (

            SELECT 1

            FROM dbo.TBL_MST_USER

            WHERE USER_ID = @USER_ID

              AND IS_DELETED = 0

        )

        BEGIN

            SELECT 'Failure' AS STATUS, 'User not found' AS MSG;

            RETURN;

        END



        -- 2️⃣ Password update condition

        IF @PASSWORD IS NOT NULL AND LTRIM(RTRIM(@PASSWORD)) <> ''

        BEGIN

            UPDATE dbo.TBL_MST_USER

            SET

                ROLE_ID       = @ROLE_ID,

                FIRST_NAME    = @FIRST_NAME,

                LAST_NAME     = @LAST_NAME,

                USERNAME      = @USERNAME,

                PASSWORD      = @PASSWORD,

                EMAIL_ID      = @EMAIL_ID,

                IsActive      = @IS_ACTIVE,   -- ✅ exact column

                MODIFIED_BY   = @MODIFIED_BY,

                MODIFIED_DATE = GETDATE()

            WHERE USER_ID = @USER_ID;

        END

        ELSE

        BEGIN

            UPDATE dbo.TBL_MST_USER

            SET

                ROLE_ID       = @ROLE_ID,

                FIRST_NAME    = @FIRST_NAME,

                LAST_NAME     = @LAST_NAME,

                USERNAME      = @USERNAME,

                EMAIL_ID      = @EMAIL_ID,

                IsActive      = @IS_ACTIVE,   -- ✅ exact column

                MODIFIED_BY   = @MODIFIED_BY,

                MODIFIED_DATE = GETDATE()

            WHERE USER_ID = @USER_ID;

        END



        -- 3️⃣ Success response

        SELECT 'Success' AS STATUS, 'User updated successfully' AS MSG;

    END TRY

    BEGIN CATCH

        SELECT 'Failure' AS STATUS, ERROR_MESSAGE() AS MSG;

    END CATCH

END;

-- dbo.TBL_MST_EQUIPMENT_DELETE
GO
CREATE   PROCEDURE dbo.TBL_MST_EQUIPMENT_DELETE
        @Equipment_ID BIGINT,
    @DeletedBy INT = NULL,
        @Plant_ID BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.TBL_MST_EQUIPMENT
    SET
                IsDelete = 1,
                DeletedBy = @DeletedBy,
                DeletedDate = GETDATE()
    WHERE Eqp_ID = @Equipment_ID
      AND Plant_ID = @Plant_ID
            AND ISNULL(IsDelete, 0) = 0;

        UPDATE dbo.TBL_EQUIPMENT_HEIGHT_SETTING
    SET
                IS_ACTIVE = 0,
                UPDATED_BY = CONVERT(VARCHAR(50), @DeletedBy),
                UPDATED_DATE = GETDATE()
    WHERE EQUIPMENT_ID = @Equipment_ID
            AND ISNULL(IS_ACTIVE, 1) = 1;

    SELECT
        CAST(1 AS INT) AS Status,
        CAST('Equipment deleted successfully' AS NVARCHAR(200)) AS Message,
        @Equipment_ID AS EquipmentID;
END

-- dbo.TBL_MST_EQUIPMENT_GET
GO
CREATE PROCEDURE dbo.TBL_MST_EQUIPMENT_GET
    @Equipment_ID BIGINT = NULL,
    @Plant_ID BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        Eqp_ID,
        Plant_ID,
        Equipment_Name,
        Device_ID,
        Installation_Date,
        Owner_Name,
        Equipment_Type,
        Equipment_Maker,
        Sim_ID,
        VTM_ImeiNo,
        JobAllow,
        IsActive,
        IsRemoveDevice,
        IsManualBreakdown
    INTO #eq
    FROM dbo.TBL_MST_EQUIPMENT
    WHERE Plant_ID = @Plant_ID
      AND ISNULL(IsDelete, 0) = 0
      AND (@Equipment_ID IS NULL OR Eqp_ID = @Equipment_ID);

    SELECT * FROM #eq ORDER BY Eqp_ID DESC;

    SELECT
        hs.EQUIPMENT_ID,
        TRY_CONVERT(FLOAT, hs.HEIGHT) AS HEIGHT,
        TRY_CONVERT(FLOAT, hs.MIN_HEIGHT) AS MIN_VALUE,
        TRY_CONVERT(FLOAT, hs.MAX_HEIGHT) AS MAX_VALUE,
        hs.EQUIPMENT_NAME
    FROM dbo.TBL_EQUIPMENT_HEIGHT_SETTING hs
    INNER JOIN #eq eq ON eq.Eqp_ID = hs.EQUIPMENT_ID
    WHERE ISNULL(hs.IS_ACTIVE, 1) = 1
    ORDER BY hs.EQUIPMENT_ID, hs.HEIGHT;
    
    DROP TABLE #eq;
END

-- dbo.TBL_MST_EQUIPMENT_INSERT
/* 3) Stored Procedures */
GO
CREATE   PROCEDURE dbo.TBL_MST_EQUIPMENT_INSERT
    @Plant_ID BIGINT,
    @Equipment_Name NVARCHAR(200),
    @Device_ID NVARCHAR(100) = NULL,
    @Installation_Date DATE = NULL,
    @Owner_Name NVARCHAR(200) = NULL,
    @Equipment_Type NVARCHAR(100) = NULL,
    @Equipment_Maker NVARCHAR(100) = NULL,
    @Sim_ID NVARCHAR(100) = NULL,
    @VTM_ImeiNo NVARCHAR(100) = NULL,
    @JobAllow BIT = 0,
    @IsActive BIT = 1,
    @IsRemoveDevice INT = 0,
    @IsManualBreakdown INT = 0,
    @CreatedBy INT = NULL,
    @HeightSettings dbo.HeightSettingType READONLY
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NewEquipmentId BIGINT;

    INSERT INTO dbo.TBL_MST_EQUIPMENT (
        Plant_ID,
        Equipment_Name,
        Device_ID,
        Installation_Date,
        Owner_Name,
        Equipment_Type,
        Equipment_Maker,
        Sim_ID,
        VTM_ImeiNo,
        JobAllow,
        IsActive,
        IsDelete,
        IsRemoveDevice,
        IsManualBreakdown,
        CreatedBy,
        CreatedDate
    )
    VALUES (
        @Plant_ID,
        LEFT(CONVERT(VARCHAR(200), @Equipment_Name), 50),
        LEFT(CONVERT(VARCHAR(100), @Device_ID), 50),
        @Installation_Date,
        LEFT(CONVERT(VARCHAR(200), @Owner_Name), 100),
        LEFT(CONVERT(VARCHAR(100), @Equipment_Type), 100),
        LEFT(CONVERT(VARCHAR(100), @Equipment_Maker), 100),
        @Sim_ID,
        LEFT(CONVERT(VARCHAR(200), @VTM_ImeiNo), 200),
        @JobAllow,
        @IsActive,
        0,
        @IsRemoveDevice,
        @IsManualBreakdown,
        @CreatedBy,
        GETDATE()
    );

    SET @NewEquipmentId = SCOPE_IDENTITY();

    IF EXISTS (SELECT 1 FROM @HeightSettings)
    BEGIN
        INSERT INTO dbo.TBL_EQUIPMENT_HEIGHT_SETTING (
            EQUIPMENT_ID,
            EQUIPMENT_NAME,
            HEIGHT,
            MIN_HEIGHT,
            MAX_HEIGHT,
            IS_ACTIVE,
            CREATED_BY,
            CREATED_DATE
        )
        SELECT
            @NewEquipmentId,
            LEFT(CONVERT(VARCHAR(200), hs.EQUIPMENT_NAME), 100),
            CONVERT(VARCHAR(50), hs.HEIGHT),
            TRY_CONVERT(DECIMAL(10,2), hs.MIN_VALUE),
            TRY_CONVERT(DECIMAL(10,2), hs.MAX_VALUE),
            1,
            CONVERT(VARCHAR(50), @CreatedBy),
            GETDATE()
        FROM @HeightSettings hs
        WHERE hs.MIN_VALUE IS NOT NULL AND hs.MAX_VALUE IS NOT NULL;
    END

    SELECT
        CAST(1 AS INT) AS Status,
        CAST('Equipment inserted successfully' AS NVARCHAR(200)) AS Message,
        @NewEquipmentId AS EquipmentID;
END

-- dbo.TBL_MST_EQUIPMENT_UPDATE
GO
CREATE   PROCEDURE dbo.TBL_MST_EQUIPMENT_UPDATE
    @Equipment_ID BIGINT,
    @Plant_ID BIGINT,
    @Equipment_Name NVARCHAR(200),
    @Device_ID NVARCHAR(100) = NULL,
    @Installation_Date DATE = NULL,
    @Owner_Name NVARCHAR(200) = NULL,
    @Equipment_Type NVARCHAR(100) = NULL,
    @Equipment_Maker NVARCHAR(100) = NULL,
    @Sim_ID NVARCHAR(100) = NULL,
    @VTM_ImeiNo NVARCHAR(100) = NULL,
    @JobAllow BIT = 0,
    @IsActive BIT = 1,
    @IsRemoveDevice INT = 0,
    @IsManualBreakdown INT = 0,
    @UpdatedBy INT = NULL,
    @HeightSettings dbo.HeightSettingType READONLY
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.TBL_MST_EQUIPMENT
    SET
        Equipment_Name = LEFT(CONVERT(VARCHAR(200), @Equipment_Name), 50),
        Device_ID = LEFT(CONVERT(VARCHAR(100), @Device_ID), 50),
        Installation_Date = @Installation_Date,
        Owner_Name = LEFT(CONVERT(VARCHAR(200), @Owner_Name), 100),
        Equipment_Type = LEFT(CONVERT(VARCHAR(100), @Equipment_Type), 100),
        Equipment_Maker = LEFT(CONVERT(VARCHAR(100), @Equipment_Maker), 100),
        Sim_ID = @Sim_ID,
        VTM_ImeiNo = LEFT(CONVERT(VARCHAR(200), @VTM_ImeiNo), 200),
        JobAllow = @JobAllow,
        IsActive = @IsActive,
        IsRemoveDevice = @IsRemoveDevice,
        IsManualBreakdown = @IsManualBreakdown,
        ModifiedBy = @UpdatedBy,
        ModifiedDate = GETDATE()
    WHERE Eqp_ID = @Equipment_ID
      AND Plant_ID = @Plant_ID
            AND ISNULL(IsDelete, 0) = 0;

    /* Replace height settings */
    DELETE FROM dbo.TBL_EQUIPMENT_HEIGHT_SETTING
    WHERE EQUIPMENT_ID = @Equipment_ID;

    IF EXISTS (SELECT 1 FROM @HeightSettings)
    BEGIN
        INSERT INTO dbo.TBL_EQUIPMENT_HEIGHT_SETTING (
            EQUIPMENT_ID,
            EQUIPMENT_NAME,
            HEIGHT,
            MIN_HEIGHT,
            MAX_HEIGHT,
            IS_ACTIVE,
            CREATED_BY,
            CREATED_DATE
        )
        SELECT
            @Equipment_ID,
            LEFT(CONVERT(VARCHAR(200), hs.EQUIPMENT_NAME), 100),
            CONVERT(VARCHAR(50), hs.HEIGHT),
            TRY_CONVERT(DECIMAL(10,2), hs.MIN_VALUE),
            TRY_CONVERT(DECIMAL(10,2), hs.MAX_VALUE),
            1,
            CONVERT(VARCHAR(50), @UpdatedBy),
            GETDATE()
        FROM @HeightSettings hs
        WHERE hs.MIN_VALUE IS NOT NULL AND hs.MAX_VALUE IS NOT NULL;
    END

    SELECT
        CAST(1 AS INT) AS Status,
        CAST('Equipment updated successfully' AS NVARCHAR(200)) AS Message,
        @Equipment_ID AS EquipmentID;
END

-- dbo.TBL_MST_YARDTYPE_DELETE
GO
CREATE   PROCEDURE [dbo].[TBL_MST_YARDTYPE_DELETE]

(

    @OperationType CHAR(1),

    @YardTypeID BIGINT = NULL,

    @YardTypeName VARCHAR(50) = NULL,

    @PlantId BIGINT = NULL,

    @IsActive BIGINT = 1,

    @IsDelete BIGINT = 0,

    @CreatedBy BIGINT = NULL,

    @ModifiedBy BIGINT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        IF @OperationType = 'D'

        BEGIN

            UPDATE ESS_MST_YARDTYPE

            SET YardTypeName = @YardTypeName,

                PlantID = @PlantId,

                IsActive = @IsActive,

                ModifiedBy = @ModifiedBy,

                ModifiedDate = GETDATE()

            WHERE YardTypeID = @YardTypeID;

            

            SELECT @@ROWCOUNT AS RowsAffected;

        END

    END TRY

    BEGIN CATCH

        SELECT ERROR_MESSAGE() AS ErrorMessage,

               ERROR_LINE() AS ErrorLine;

    END CATCH

END

-- dbo.TBL_MST_YARDTYPE_INSERT
GO
CREATE PROCEDURE [dbo].[TBL_MST_YARDTYPE_INSERT]

(

    @OperationType CHAR(1),

    @YardTypeID BIGINT = NULL,

    @YardTypeName VARCHAR(50) = NULL,

    @PlantId BIGINT = NULL,

    @IsActive BIGINT = 1,

    @IsDelete BIGINT = 0,

    @CreatedBy BIGINT = NULL,

    @ModifiedBy BIGINT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        IF @OperationType = 'I'

        BEGIN

            INSERT INTO ESS_MST_YARDTYPE

            (

                YardTypeName,

                PlantID,

                IsActive,

                IsDelete,

                CreatedBy,

                CreatedDate

            )

            VALUES

            (

                @YardTypeName,

                @PlantId,

                @IsActive,

                @IsDelete,

                @CreatedBy,

                GETDATE()

            );

            

            SELECT SCOPE_IDENTITY() AS InsertedID;

        END

    END TRY

    BEGIN CATCH

        SELECT ERROR_MESSAGE() AS ErrorMessage,

               ERROR_LINE() AS ErrorLine;

    END CATCH

END

-- dbo.TBL_MST_YARDTYPE_UPDATE
GO
CREATE   PROCEDURE [dbo].[TBL_MST_YARDTYPE_UPDATE]

(

    @OperationType CHAR(1),

    @YardTypeID BIGINT = NULL,

    @YardTypeName VARCHAR(50) = NULL,

    @PlantId BIGINT = NULL,

    @IsActive BIGINT = 1,

    @IsDelete BIGINT = 0,

    @CreatedBy BIGINT = NULL,

    @ModifiedBy BIGINT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        IF @OperationType = 'U'

        BEGIN

            UPDATE ESS_MST_YARDTYPE

            SET YardTypeName = @YardTypeName,

                PlantID = @PlantId,

                IsActive = @IsActive,

                ModifiedBy = @ModifiedBy,

                ModifiedDate = GETDATE()

            WHERE YardTypeID = @YardTypeID;

            

            SELECT @@ROWCOUNT AS RowsAffected;

        END

    END TRY

    BEGIN CATCH

        SELECT ERROR_MESSAGE() AS ErrorMessage,

               ERROR_LINE() AS ErrorLine;

    END CATCH

END

-- dbo.UPD_CONTAINER_LOCATION_BYTAB
GO
CREATE PROCEDURE [dbo].[UPD_CONTAINER_LOCATION_BYTAB] 

	@Cont_No VARCHAR(50),

	@Location  VARCHAR(50),

	@asset_id VARCHAR(20)

AS

BEGIN

	

	Declare @IsSuccess int;



	SET @IsSuccess=0;



	Declare @Lattitude decimal(18,6);

	Declare @Longitude decimal(18,6);

	declare @LocationId bigint,@NoofMoves int,@EquipmentId nvarchar(30),@TransactionId bigint;

	Declare @ContainerMasterId bigint,@RailContainerId bigint;

	declare @LastShiftDate datetime;

	declare @TransactionDateTime datetime;



	SELECT  @LocationId =LocationID FROM ESS_MST_LOCATION WHERE ContainerLocationName=@Location



	select @EquipmentId=DeviceId from ESS_MST_EQUIPMENT where VTMImeiNo=@asset_id

 

	SELECT @ContainerMasterId=ContMasterID,@LastShiftDate=LastShiftDate,@NoofMoves=isnull(NoOfMoves,0) from EKL_TRN_INVENTORY

	WHERE ContNo=@Cont_No and GateOutDate is null;



	select top 1 @TransactionId=EqpTransID,@Lattitude=GpsLocLat,@Longitude=GpsLocLon,@LocationId=AreaID,@TransactionDateTime=TransDate from EKL_TRN_EQUIPMENT_TRANSACTION

	where DeviceID=@EquipmentId and PacketType='UK' order by EqpTransID desc

	

	IF @ContainerMasterId IS NOT NULL

	BEGIN

		UPDATE EKL_TRN_INVENTORY SET LastLocID=@LocationId,LocLatitude=@Lattitude,LocLongitude=@Longitude,LastShiftDate=@TransactionDateTime,

		NoOfMoves=@NoofMoves+1,EquipmentID=@EquipmentId where ContMasterID=@ContainerMasterId and GateOutDate IS NULL



		UPDATE EKL_TRN_EQUIPMENT_TRANSACTION SET ContMasterID=@ContainerMasterId,OCRContainerNo=@Cont_No,UpdateStutus='T'

		where EqpTransID=@TransactionId



		update ESS_MST_TASK_MASTER set JobCompletionDate=@TransactionDateTime,ActualLocationId=@LocationId where ContainerMasterID=@ContainerMasterId and JobCompletionDate is null

		update A Set  TaskCompletionDate=@TransactionDateTime  from ESS_MST_TASK_MASTER T LEFT JOIN ESS_MST_TASK_ALLOCATION A on A.JobID=T.JobID where ContainerMasterID=@ContainerMasterId and JobCompletionDate is null

	



		SET @IsSuccess=1;

		SELECT @IsSuccess AS Result;

	END

	ELSE 

	BEGIN

	    UPDATE EKL_TRN_EQUIPMENT_TRANSACTION SET ContMasterID=@ContainerMasterId,OCRContainerNo=@Cont_No,UpdateStutus='T'

		where EqpTransID=@TransactionId



		update ESS_MST_TASK_MASTER set JobCompletionDate=@TransactionDateTime,ActualLocationId=@LocationId where ContainerNo=@Cont_No and JobCompletionDate is null

		update A Set  TaskCompletionDate=@TransactionDateTime  from ESS_MST_TASK_MASTER T LEFT JOIN ESS_MST_TASK_ALLOCATION A on A.JobID=T.JobID where ContainerNo=@Cont_No and JobCompletionDate is null

	



	END

		

END

-- dbo.UPD_DEVICEDATADETAIL_CONTNO_BY_API
GO
CREATE PROCEDURE [dbo].[UPD_DEVICEDATADETAIL_CONTNO_BY_API]

	-- Add the parameters for the stored procedure here

	@TranDate datetime,

	@Machine varchar(20),

    @ContNo varchar(100),

	@ModifiedBy uniqueidentifier

AS

BEGIN

	SET NOCOUNT ON;

	declare @IsSuccess int;

	set @IsSuccess=0;



	--declare @PlantID bigint=1,

	--@EqpTransID bigint=285633,

 --   @ContNo varchar(100)='FCIU9625236',

	--@ModifiedBy uniqueidentifier='FFEB32EB-65D3-49C6-90AF-C7DAD951C47B'

	

	Declare @Lattitude decimal(18,6);

	Declare @Longitude decimal(18,6);

	declare @EqpTransID bigint;

	declare @LocationId bigint,@NoofMoves int,@EquipmentId nvarchar(30);

	Declare @ContainerMasterId bigint,@RailContainerId bigint;

	declare @LastShiftDate datetime;

	declare @TransactionDateTime datetime;

	declare @DocumentNo nvarchar(50),@ContainerLocation nvarchar(50),@GateInDate datetime;

	--select @EqpTransID=EqpTransID from tb

 	select @EqpTransID=EqpTransID,@Lattitude=GpsLocLat,@Longitude=GpsLocLon,@LocationId=AreaID,

	@EquipmentId=ek.DeviceID,@TransactionDateTime=TransDate from EKL_TRN_EQUIPMENT_TRANSACTION ek

	inner join ESS_MST_EQUIPMENT ee on ek.DeviceID=ee.DeviceID

	where ee.Equipment_Code=@Machine and TransDate = @TranDate



	select @ContainerLocation=ContainerLocationName from ESS_MST_LOCATION where LocationID=@LocationId



	

	select @ContainerMasterId=ContMasterID,@LastShiftDate=LastShiftDate,@GateInDate=GateInDate,@NoofMoves=isnull(NoOfMoves,0),@DocumentNo=DocumentNo from EKL_TRN_INVENTORY

	where ContNo=@ContNo and GateOutDate is null;



	

	UPDATE EKL_TRN_EQUIPMENT_TRANSACTION set OCRContainerNo=@ContNo,UpdateStutus='M',ContMasterID=isnull(@ContainerMasterId,@RailContainerId),

	ModifiedBy=@ModifiedBy,ModifiedOn=GETDATE() where EqpTransID=@EqpTransID



	update EKL_TRN_INVENTORY set NoOfMoves=isnull(@NoofMoves,0)+1 where ContMasterID=@ContainerMasterId



	if @ContainerMasterId is not null

	BEGIN

		if @LastShiftDate is null and @GateInDate< @TransactionDateTime

		BEGIN

			update EKL_TRN_INVENTORY set LocLatitude=@Lattitude,LocLongitude=@Longitude,LastShiftDate=@TransactionDateTime,LastLocID=@LocationId,EquipmentID=@EquipmentId where ContMasterID=@ContainerMasterId

			

			--insert into [192.168.1.21].[GatewayRail].[dbo].[Gateway Rail Freight Limited$OCR Details] 

		 --   ([Process Type],[Container No_],[Size],[Document No_],[Nav Date Time],[Transaction Type],[Terminal],[Container Location],

		 --   [Reachstacker],[Mode],[Container Status],[OCR Date Time],[No_ of Moves],[Truck No_],[Booking Ref_ No_],[Wagon No_])

		 --   select 'YardOffload',PR.ContainerNo,PR.ContainerSize,PR.DocumentNo,NAVDateTime,PR.TransactionType,PR.Terminal,L.ContainerLocationName ,Equipment_Name,'Rail',PR.ContainerStatus

		 --   ,isnull(CI.OffloadDate,CI.LastShiftDate),NoOfMoves,'',PR.BookingNo,PR.WagonNo

		 --   from EKL_PRE_RAIL_IN PR 

			--LEFT JOIN EKL_TRN_INVENTORY CI ON PR.ContainerNo=CI.ContNo

			--Left Join ESS_MST_LOCATION L on CI.LastLocID=L.LocationID

			--LEFT JOIN ESS_MST_EQUIPMENT E ON E.DeviceID=CI.EquipmentID

			--where GateOutDate is null and ContNo=@ContNo and CI.DocumentNo=@DocumentNo and PR.Terminal='GHH' and LastLocID is not null

			--Union all

			--select  'YardOffload',PR.ContainerNo,PR.ContainerSize,PR.DocumentNo,NAVDateTime,PR.TransactionType,PR.Terminal,L.ContainerLocationName ,Equipment_Name,'Road',PR.ContainerStatus

			--,isnull(CI.OffloadDate,CI.LastShiftDate),NoOfMoves,PR.WagonNo as TruckNo,PR.BookingNo,''

			--from EKL_PRE_ROAD_IN PR

			--LEFT JOIN EKL_TRN_INVENTORY CI ON PR.ContainerNo=CI.ContNo

			--Left Join ESS_MST_LOCATION L on CI.LastLocID=L.LocationID

			--LEFT JOIN ESS_MST_EQUIPMENT E ON E.DeviceID=CI.EquipmentID

			--where GateOutDate is null and ContNo=@ContNo and CI.DocumentNo=@DocumentNo  and PR.Terminal='GHH' and LastLocID is not null

		END

		if  @TransactionDateTime > @LastShiftDate and @GateInDate < @TransactionDateTime

		BEGIN

			update EKL_TRN_INVENTORY set LocLatitude=@Lattitude,LocLongitude=@Longitude,LastShiftDate=@TransactionDateTime,LastLocID=@LocationId,EquipmentID=@EquipmentId where ContMasterID=@ContainerMasterId

			--update [192.168.1.21].[GatewayRail].[dbo].[Gateway Rail Freight Limited$OCR Details] set [Reachstacker]= '', 

			--[No_ of Moves]=@NoofMoves+1,[Container Location]=@ContainerLocation,[OCR Date Time]=@TransactionDateTime

			--where [Container No_]=@ContNo and [Document No_]=@DocumentNo and [Process Type]='YardOffload'

		END

		update ESS_MST_TASK_MASTER set JobCompletionDate=@TransactionDateTime,ActualLocationId=@LocationId where ContainerMasterID=@ContainerMasterId and JobCompletionDate is null

		update A Set  TaskCompletionDate=@TransactionDateTime  from ESS_MST_TASK_MASTER T LEFT JOIN ESS_MST_TASK_ALLOCATION A on A.JobID=T.JobID where ContainerMasterID=@ContainerMasterId and JobCompletionDate is null

	END

	

		 SET @IsSuccess=1 ; --'DATA SAVE SUCCESSFUlLY'

		SELECT @IsSuccess AS Result

END

-- dbo.UPD_DEVICEDATADETAIL_CONTNO_BY_IMG
GO
CREATE PROCEDURE [dbo].[UPD_DEVICEDATADETAIL_CONTNO_BY_IMG]  

 -- Add the parameters for the stored procedure here  

 @PlantID bigint,  

 @EqpTransID bigint,  

    @ContNo varchar(100),  

 @ModifiedBy bigint  

AS  

BEGIN  

 SET NOCOUNT ON;  

 declare @IsSuccess int;  

 set @IsSuccess=0;  

   

 Declare @Lattitude decimal(18,6);  

 Declare @Longitude decimal(18,6);  

 declare @LocationId bigint,@NoofMoves int,@EquipmentId nvarchar(30);  

 Declare @ContainerMasterId bigint,@RailContainerId bigint;  

 declare @LastShiftDate datetime;  

 declare @TransactionDateTime datetime;  

 declare @DocumentNo nvarchar(50),@ContainerLocation nvarchar(50),@GateInDate datetime;  

 select @Lattitude=GPS_LATITUDE,@Longitude=GPS_LONGITUDE,@LocationId=LOCATION_ID,

 @EquipmentId=DEVICE_ID,@TransactionDateTime=TRANSACTION_DATE from TBL_EQUIPMENT_TRANSACTION  

 where TRANSACTION_ID=@EqpTransID   

  

 select @ContainerLocation=ContainerLocationName from ESS_MST_LOCATION where LocationID=@LocationId  

   

 select @ContainerMasterId=INVENTORY_ID,@LastShiftDate=LAST_MOVED_DATE,

 @GateInDate=GATE_IN_DATE from TBL_CONTAINER_INVENTORY  

 where CONTAINER_NO=@ContNo and IS_PRE_GATE is null;  

  

   

 UPDATE TBL_EQUIPMENT_TRANSACTION set OCR_CONTAINER_NO=@ContNo,UPDATED_STATUS='M',

 INVENTORY_ID=isnull(@ContainerMasterId,0),  

 MODIFIED_BY=@ModifiedBy,MODIFIED_DATE=GETDATE() where TRANSACTION_ID=@EqpTransID  

  

 -- EKL_TRN_INVENTORY set NoOfMoves=isnull(@NoofMoves,0)+1 where ContMasterID=@ContainerMasterId  

  

 if @ContainerMasterId is not null  

 BEGIN  

  if @LastShiftDate is null and @GateInDate< @TransactionDateTime  

  BEGIN  

   update TBL_CONTAINER_INVENTORY set LAST_LAT=@Lattitude,LAST_LON=@Longitude,LAST_MOVED_DATE=@TransactionDateTime,LAST_LOCATION=@LocationId,LAST_EQP=@EquipmentId where INVENTORY_ID=@ContainerMasterId  

  

  END  

  if  @TransactionDateTime > @LastShiftDate and @GateInDate < @TransactionDateTime  

  BEGIN  

   update TBL_CONTAINER_INVENTORY set LAST_LAT=@Lattitude,LAST_LON=@Longitude,LAST_MOVED_DATE=@TransactionDateTime,LAST_LOCATION=@LocationId,LAST_EQP=@EquipmentId where INVENTORY_ID=@ContainerMasterId  



  END  

  --update ESS_MST_TASK_MASTER set JobCompletionDate=@TransactionDateTime,ActualLocationId=@LocationId 

  --where ContainerMasterID=@ContainerMasterId and JobCompletionDate is null  

 -- update A Set  TaskCompletionDate=@TransactionDateTime  from ESS_MST_TASK_MASTER T LEFT JOIN ESS_MST_TASK_ALLOCATION A on A.JobID=T.JobID where ContainerMasterID=@ContainerMasterId and JobCompletionDate is null  

 END  

   

   SET @IsSuccess=1 ; --'DATA SAVE SUCCESSFUlLY'  

  SELECT @IsSuccess AS Result  

END

-- dbo.UPD_IND_MST_USER_PASSWORD
GO
CREATE PROCEDURE [dbo].[UPD_IND_MST_USER_PASSWORD]  

 

 @UserID UNIQUEIDENTIFIER,  

 @Password NVARCHAR(50),  

 @IsSuccess INT OUTPUT  

AS  

BEGIN  

BEGIN TRY  

 

 SET NOCOUNT ON;  

 SET @IsSuccess=0  

 BEGIN TRAN  

  UPDATE IND_MST_USER SET Password=@Password,IsReset=1,  

  ModifiedBy=@UserID,ModifiedDate=GETDATE()   

  WHERE UserID=@UserID 

  

  SET @IsSuccess=1  

  SELECT @IsSuccess AS result  

 COMMIT TRAN  

END TRY  

BEGIN CATCH  

 ROLLBACK TRAN  

 SET @IsSuccess=ERROR_NUMBER()  

 SELECT @IsSuccess AS result  

 EXEC INS_ESS_MST_ERROR_LOG  

END CATCH  

END

-- dbo.UPD_JOB_ALLOW_STATUS
GO
CREATE PROCEDURE [dbo].[UPD_JOB_ALLOW_STATUS]    

@PlantID bigint,

@JobAllowId int,

@Equipment varchar(30),

@ModifiedBy uniqueidentifier

AS    

BEGIN    

 SET NOCOUNT ON;   

   UPDATE ESS_MST_EQUIPMENT SET JobAllow=@JobAllowId,JobAllowBy=@ModifiedBy,JobAllowDate=GETDATE() where Equipment_Name=@Equipment 

    select @@ROWCOUNT as Result;

 end

-- dbo.UPD_MISMATCH_INVENTORY
GO
CREATE PROCEDURE [dbo].[UPD_MISMATCH_INVENTORY]

AS

BEGIN

select [Serial No_],ContNo,ContainerStatus ,GateInDate,DocumentNo,

Process,Terminal,ContainerSize,ContainerType,ReleaseStatus

from EKL_TRN_INVENTORY I 

left join [192.168.1.21].[GatewayRail].[dbo].[Gateway Rail Freight Limited$Item Ledger Entry] RJH 

ON I.ContNo=RJH.[Serial No_] collate Latin1_General_100_CI_AI and I.DocumentNo=RJH.[Document No_] collate Latin1_General_100_CI_AI and [Open] =1

where 

[Serial No_] is null and GateOutDate is null and ReleaseStatus in (null,'R')

order by ContNo asc





END

-- dbo.UPD_PHYSICAL_CONTAINER_LOCATION
GO
CREATE PROCEDURE [dbo].[UPD_PHYSICAL_CONTAINER_LOCATION]

	-- Add the parameters for the stored procedure here

	@Cont_No varchar(50),

	@Location varchar(50)

AS

BEGIN

	SET NOCOUNT ON;

	declare @IsSuccess int;

	declare @ContMasterId bigint;

	set @IsSuccess=0;



	DECLARE @Lattitude as decimal(18,6);

	DECLARE @Longitude as decimal(18,6);

	declare @LocationID as bigint;

	select TOP 1 @LocationID=L.LocationID,@Lattitude=Polygon.STCentroid().STX,@Longitude=Polygon.STCentroid().STY FROM ESS_MST_LOCATION L

	LEFT JOIN ESS_MST_SLOT S ON S.SlotID=L.SlotId WHERE ContainerLocationName=@Location;



	IF (@LocationID IS NOT NULL )

	BEGIN

	SET @Cont_No=REPLACE(LTRIM(RTRIM(@Cont_No)),' ','');

	IF EXISTS(SELECT * FROM EKL_TRN_INVENTORY WHERE ContNo=@Cont_No AND GateOutDate IS NULL)

	BEGIN 



	UPDATE EKL_TRN_INVENTORY SET LastLocID=@LocationID,LocLatitude=@Lattitude,LocLongitude=@Longitude,LastShiftDate=GETDATE() WHERE ContNo=@Cont_No and GateOutDate IS NULL;

	INSERT INTO EKL_PHYSICAL_INVENTORY_LOG(PlantID,InventoryType,ContainerNo,Location,LocationId,Lattitude,Longtitude,UpdatedDate)

	VALUES(1,'PHYSICAL_UPDATE',@Cont_No,@Location,@LocationID,@Lattitude,@Longitude,GETDATE());

	    SET @IsSuccess=1;   

		SELECT @IsSuccess AS Result;

	END

	ELSE

	BEGIN

	insert into EKL_TRN_CONTAINER_IN (ContainerNo,GateInDateTime)

    values (@Cont_No,GETDATE());

	

	Insert into EKL_TRN_CONTAINER(ContNo,GateInDate,IsGateIn)  

	values( @Cont_No, GETDATE(),1); 

   

	set @ContMasterId=SCOPE_IDENTITY();  



	INSERT INTO EKL_TRN_INVENTORY (ContMasterID,ContNo,LastLocID,LocLatitude,LocLongitude,LastShiftDate,GateInDate)  

	values(@ContMasterId, @Cont_No,@LocationID,@Lattitude,@Longitude,GETDATE(),GETDATE());  

	INSERT INTO EKL_PHYSICAL_INVENTORY_LOG(PlantID,InventoryType,ContainerNo,Location,LocationId,Lattitude,Longtitude,UpdatedDate)

	VALUES(1,'PHYSICAL_UPDATE',@Cont_No,@Location,@LocationID,@Lattitude,@Longitude,GETDATE());

		SET @IsSuccess=1;   

		SELECT @IsSuccess AS Result;

	END

	END

	ELSE

	BEGIN

	INSERT INTO EKL_PHYSICAL_INVENTORY_LOG(PlantID,InventoryType,ContainerNo,Location,LocationId,Lattitude,Longtitude,UpdatedDate)

	VALUES(1,'INVALID_LOCATION',@Cont_No,@Location,@LocationID,@Lattitude,@Longitude,GETDATE());

	SET @IsSuccess=2;   

		SELECT @IsSuccess AS Result

	END

END

-- dbo.UPD_TRAILER_OUT_DETAIL
GO
CREATE PROCEDURE [dbo].[UPD_TRAILER_OUT_DETAIL]

@TrailerNo varchar(50),

@ContainerNo nvarchar(max),

@GateOutBy uniqueidentifier,

@PlantID bigint,

@IsSuccess int OUTPUT

as 

begin

set @IsSuccess=0



  update EKL_TRN_CONTAINER set GateOutDate=GETDATE(),GateOutBy=@GateOutBy,IsGateOut=1 

  where ContNo in (select Value from [dbo].Split_String(@ContainerNo,',')) and GateOutDate IS NULL



  --INSERT INTO EKL_TRP_INVENTORY(PlanName,ContRefNo,ContMasterID,ContNo,TrailerNo,Process,ActivityName,ContType,ArrivalType,

  --Size,Line,LastLocID,GateInDate,GateOutDate,GateInBy,GateOutBy)

  --SELECT P.PlantName,I.ContRefNo,I.ContNo,T.TrailerNo,PR.ProcessName,A.ActivityName,CT.ContTypeName,I.ArrivalType,

  --S.ContSize,L.LineName,I.LastLocID,I.GateInDate,I.GateOutDate,U.UserName,UM.UserName FROM  EKL_TRN_INVENTORY I

  --INNER JOIN ESS_MST_PLANT P ON P.PlantID=I.PlantID

  --INNER JOIN EKL_TRN_TRAILER T ON T.TrailerID=I.TrailerID and T.GateOutDate IS NULL and T.TrailerNo=@TrailerNo

  --INNER JOIN ESS_MST_PROCESS PR ON PR.ProcessID=I.ProcessID

  --INNER JOIN ESS_MST_ACTIVITY A ON A.ActivityID=I.ActivityID

  --INNER JOIN ESS_MST_CONTAINER_TYPE CT ON CT.ContTypeID=I.ContTypeId

  --INNER JOIN ESS_MST_CONTAINER_SIZE S ON S.ContSizeID=I.SizeID

  --INNER JOIN ESS_MST_LINE L ON L.LineID=I.LineID

  --INNER JOIN IND_MST_USER U ON U.UserID=I.GateInBy

  --INNER JOIN IND_MST_USER UM ON UM.UserID=I.GateOutBy

  --where I.ContNo in (select Value from [dbo].Split_String(@ContainerNo,',')) and I.GateOutDate IS NULL 





  update EKL_TRN_INVENTORY set GateOutDate=GETDATE(),GateOutBy=@GateOutBy,IsGateOut=1 

  where ContNo in (select Value from [dbo].Split_String(@ContainerNo,',')) and GateOutDate IS NULL 



  update EKL_TRN_TRAILER set GateOutDate=GETDATE(),GateOutBy=@GateOutBy where TrailerNo=@TrailerNo and GateOutDate IS NULL



  --INSERT INTO EKL_TRP_TRAILER(PlantName,TrailerNo,GateId,ContSize,Process,Activity,InContNo,OutContNo,ContRefNo,Line,GateStatus,Status,

  --TaskPriority,GateInBy,GateOutBy,GateInDate,GateOutDate,GateInType,GateOutType,CurrentLocation,ProposeLocation,GatePassNo,ContType)

  --select P.PlantName,T.TrailerNo,T.GateId,CS.ContSize,PR.ProcessName,A.ActivityName,T.InContNo,T.OutContNo,T.ContRefNo,L.LineName,T.GateStatus,T.Status,

  --T.TaskPriority,U.UserName,US.UserName,T.GateInDate,T.GateOutDate,GT.GateName,GTT.GateName,T.CurrentLocation,T.ProposeLocation,T.GatePassNo,CT.ContTypeName

  --from EKL_TRN_TRAILER T

  --INNER JOIN ESS_MST_PLANT P ON P.PlantID=T.PlantID

  --INNER JOIN ESS_MST_CONTAINER_SIZE CS ON CS.ContSizeID=T.ContSizeID

  --INNER JOIN ESS_MST_PROCESS PR ON PR.ProcessID=T.ProcessID

  --INNER JOIN ESS_MST_ACTIVITY A ON A.ActivityID=T.ActivityID

  --INNER JOIN ESS_MST_LINE L ON L.LineID=T.LineID

  --INNER JOIN IND_MST_USER U ON U.UserID=T.GateInBy

  --INNER JOIN IND_MST_USER US ON US.UserID=T.GateInBy

  --INNER JOIN ESS_MST_GATE GT ON GT.GateID=T.GateInType 

  --INNER JOIN ESS_MST_GATE GTT ON GTT.GateID=T.GateInType 

  --INNER JOIN ESS_MST_CONTAINER_TYPE CT ON CT.ContTypeID=T.ContTypeID

  --where ISNULL(T.InContNo,T.OutContNo) in (select Value from [dbo].Split_String(@ContainerNo,','))  

  --and T.TrailerNo=@TrailerNo and T.GateOutDate IS NULL 





SET @IsSuccess=1   --'DATA SAVE SUCCESSFUlLY'

SELECT @IsSuccess AS result



end

-- dbo.UPD_TRN_GATE_IN
GO
CREATE PROCEDURE [dbo].[UPD_TRN_GATE_IN]

@ContainerNo nvarchar(50),

@GateInDate datetime,

@ShippingLine nvarchar(200),

@GateType nvarchar(100),

@TrailerNo nvarchar(50)

AS

BEGIN



Declare @ContainerCount int,@TrailerId bigint,@OldTrailer nvarchar(50);



select @ContainerCount=count(*) from EKL_TRN_INVENTORY where ContNo=@ContainerNo and GateOutDate is null;







declare @ContainerSize nvarchar(20),@ContainerType nvarchar(20), @GateInDateTime datetime,@DocumentNo nvarchar(50),@TransactionType nvarchar(20),@Terminal nvarchar(20),@Mode nvarchar(20),@ContainerStatus nvarchar(20),@BookingNo nvarchar(20);



declare @ContainerMasterId bigint;



select @ContainerMasterId=ContMasterID,@TrailerId=TrailerID,@ContainerSize=ContainerSize,@ContainerType=ContainerType  from EKL_TRN_INVENTORY where ContNo=@ContainerNo and GateOutDate is null



SELECT TOP 1 @TrailerNo=TrailerNo FROM EKL_TRN_TRAILER WHERE RIGHT(TrailerNo,4)=RIGHT(@TrailerNo,4)and ContainerNo=@ContainerNo and GateOutDate is null

order by GateInDate desc





	

if @ContainerCount>0

BEGIN

	update EKL_TRN_CONTAINER set ShippingLine=@ShippingLine where ContNo=@ContainerNo and GateOutDate is null; 



	update EKL_TRN_INVENTORY set ShippingLine=@ShippingLine where ContNo=@ContainerNo and GateOutDate is null;

	select @OldTrailer =TrailerNo, @GateInDateTime=GateInDate from EKL_TRN_TRAILER where ContainerNo=@ContainerNo and GateOutDate is null

	update EKL_TRN_TRAILER set GateName=@GateType,SurveyTime=@GateInDate,ANPRVehicleNo=@TrailerNo where TrailerNo=@OldTrailer and cast(GateInDate as date)=cast(@GateInDateTime as date)



	select @TrailerNo as result;

END

END

-- dbo.UPD_UNWANTED_CONTAINERS
GO
CREATE PROCEDURE [dbo].[UPD_UNWANTED_CONTAINERS]

as    

begin    

   --=============+++++++ Temperary comment bcz server reference +++++++===========--

	--UPDATE I SET GateOutDate =GETDATE() FROM EKL_TRN_INVENTORY I

	--LEFT JOIN [192.168.1.21].[GatewayRail].[dbo].[Gateway Rail Freight Limited$Item Ledger Entry] RJH 

 --   ON I.ContNo = RJH.[Serial No_] COLLATE Latin1_General_100_CI_AI

	--and I.DocumentNo = RJH.[Document No_] COLLATE Latin1_General_100_CI_AI

	--WHERE I.GateOutDate IS NULL  -- Ensures only NULL GateOutDate is updated

 --   --AND RJH.[Serial No_]  in('TEMU0373714','DFSU1746370')  -- Ensures the container is NOT present in RJH

	--AND RJH.[Open] = 0

 --   AND RJH.[Location Code] = 'GHH'

 --   AND RJH.[Serial No_] <> ''

 --   AND RJH.[Product Group Code] <> 'POWERPACK'

	--and CAST([Posting Date] as DATE)<>CAST(GETDATE() as date);



	insert into EKL_TRN_INTEGRATION_STATUS(ProcessType,SyncTime) values ('UPD_UNWANTED',getdate())



End

-- dbo.UPD_WEIGHMENT_STATUS_CURSOR
GO
CREATE PROCEDURE [dbo].[UPD_WEIGHMENT_STATUS_CURSOR] 

AS

    declare

	@ContainerNo varchar(20),

	@DocumentNo varchar(50)

BEGIN

    SET NOCOUNT ON;

	BEGIN

	SET NOCOUNT ON;

		DECLARE UPDATE_WEIGHMENT_STATUS CURSOR FOR SELECT ContNo,DocumentNo FROM EKL_TRN_INVENTORY WHERE GateOutDate IS NULL and WeighmentStatus='N'

		OPEN UPDATE_WEIGHMENT_STATUS    

		FETCH NEXT FROM UPDATE_WEIGHMENT_STATUS INTO @ContainerNo,@DocumentNo

		WHILE @@FETCH_STATUS = 0 

		    BEGIN   

			    SELECT @ContainerNo=@ContainerNo,@DocumentNo=@DocumentNo

				--IF EXISTS(SELECT * FROM [192.168.1.21].[GatewayRail].[dbo].[Gateway Rail Freight Limited$WeighBridgemaininfo]

				IF EXISTS(SELECT * FROM EKL_TRN_INVENTORY WHERE GateOutDate IS NULL)

				BEGIN

				UPDATE EKL_TRN_INVENTORY SET WeighmentStatus='Y',WeighmentDate=GETDATE() where ContNo=@ContainerNo and DocumentNo=@DocumentNo and GateOutDate IS NULL and WeighmentStatus='N'

				END

				--ELSE

				--BEGIN

				--UPDATE EKL_TRN_INVENTORY SET WeighmentStatus='N' where ContNo=@ContainerNo and DocumentNo=@DocumentNo and GateOutDate IS NULL and WeighmentStatus='N'

				--END

			   

				FETCH NEXT FROM UPDATE_WEIGHMENT_STATUS INTO @ContainerNo,@DocumentNo

		    END

		CLOSE UPDATE_WEIGHMENT_STATUS    

		DEALLOCATE UPDATE_WEIGHMENT_STATUS

		  

END



END

-- dbo.UPLOAD_RAILPLAN_LIST_1
GO
CREATE PROCEDURE [dbo].[UPLOAD_RAILPLAN_LIST_1] 

(@BULK_RAILPLANLIST AS dbo.BULK_RAIL_PLAN READONLY)

AS

    declare

	@SrNo int ,

	@ContainerNo varchar(20),

	@ContainerSize varchar(10),

	@ToLocation varchar(100),

	@FileID bigint,

	@PlantID bigint,

	@ModifiedBy uniqueidentifier

BEGIN

    SET NOCOUNT ON;

	BEGIN

	--BEGIN TRY

	--BEGIN TRAN  

	SET NOCOUNT ON;

		DECLARE BULK_RAILPLAN_LIST_CURSOR CURSOR FOR SELECT * FROM @BULK_RAILPLANLIST 

		OPEN BULK_RAILPLAN_LIST_CURSOR    

		FETCH NEXT FROM BULK_RAILPLAN_LIST_CURSOR INTO @SrNo,@ContainerNo,@ContainerSize,@ToLocation,@FileID,@PlantID,@ModifiedBy

		WHILE @@FETCH_STATUS = 0 

		    BEGIN   

				BEGIN TRY

		      SELECT @SrNo=@SrNo,@ContainerNo=REPLACE(LTRIM(RTRIM(@ContainerNo)),' ',''),@ContainerSize=@ContainerSize,@ToLocation=@ToLocation,@FileID=@FileID,@PlantID=@PlantID,@ModifiedBy=@ModifiedBy



			   EXEC UPLOAD_RAILPLAN_LIST_2 @SrNo,@ContainerNo,@ContainerSize,@ToLocation,@FileID,@PlantID,@ModifiedBy

			   END TRY

				BEGIN CATCH



			   INSERT INTO EKL_TRN_ERRORLIST(FileID, ErrorName, SrNo, ServerDateTime) 

			   VALUES(@FileID, ERROR_MESSAGE(), @SrNo, GETDATE());

			 	END CATCH;

				 FETCH NEXT FROM BULK_RAILPLAN_LIST_CURSOR INTO @SrNo,@ContainerNo,@ContainerSize,@ToLocation,@FileID,@PlantID,@ModifiedBy

		    END

		CLOSE BULK_RAILPLAN_LIST_CURSOR    

		DEALLOCATE BULK_RAILPLAN_LIST_CURSOR

		  

		SELECT ErrorName,SrNo from EKL_TRN_ERRORLIST where FileID=@FileID;



END



END

-- dbo.UPLOAD_RAILPLAN_LIST_2
GO
CREATE PROCEDURE [dbo].[UPLOAD_RAILPLAN_LIST_2]

	@SrNo int ,

	@ContainerNo varchar(20),

	@ContainerSize varchar(10),

	@ToLocation varchar(100),

	@FileID bigint,

	@PlantID bigint,

	@ModifiedBy uniqueidentifier

AS

BEGIN

 DECLARE @exist bigint;

 DECLARE @Error_list  varchar(5000);

 SET @Error_list = ''; 



--SET @exist =(select count(*) from ESS_MST_TASK_MASTER where ContainerNo=@ContainerNo and CAST(JobCreation as date)=CAST(GETDATE() as date) and JobCompletionDate IS NULL and JobType='PICKUP');

SET @exist =(select count(*) from EKL_TRN_RAIL_PLAN where ContainerNo=@ContainerNo and CAST(RailPlanDate as date)=CAST(GETDATE() as date));



IF (LEN(@ContainerNo) <> 11)

BEGIN 

	SET @Error_list = @Error_list +','+'Please fill 11 digit or valid container number';

END

IF @exist != 0

	Begin

		SET @Error_list = @Error_list +','+'Container already exist in plan';

	end



if @Error_list=''

	Begin

		 

		  declare @ContainerType varchar(50),@TransactionType varchar(50),@ContMasterId int,@TrailerNo as varchar(50),

		  @DocumentNo varchar(250),@ShippingLine as varchar(250),@RailPlanName as varchar(100);



		  SET @RailPlanName='RailPlan_'+CAST(@FileID as varchar);



		  SELECT @ContainerType=I.ContainerType,@DocumentNo=DocumentNo,@ShippingLine=@ShippingLine,@TransactionType=I.Process,@ContMasterId=I.ContMasterID,@TrailerNo='N/A' from EKL_TRN_INVENTORY I

		  WHERE ContNo=@ContainerNo and I.GateOutDate IS NULL



		  INSERT INTO EKL_TRN_RAIL_PLAN(IsJobAllotted,RailPlanName,ContainerNo,ContainerSize,ContainerType,DocumentNo,ShippingLine,RailPlanDate,ModifiedDate,PlantID,ModifiedBy,ToLocation)

		  VALUES(0,@RailPlanName,@ContainerNo,@ContainerSize,@ContainerType,@DocumentNo,@ShippingLine,GETDATE(),GETDATE(),@PlantID,@ModifiedBy,@ToLocation);



		 

		  

		 -- EXEC [dbo].[INS_EKL_TASK_MASTER]  'PICKUP',@ContainerNo,@ContainerType,@TransactionType,@ContainerSize,@ContMasterId,0,@TrailerNo



		  --UPDATE ESS_MST_TASK_MASTER SET RailPlanName='RailPlan_'+CAST(@FileID as varchar) 

		 -- WHERE ContainerNo=@ContainerNo and JobCompletionDate is null and JobType='PICKUP'



	END

	ELSE

	BEGIN

	     INSERT INTO EKL_TRN_ERRORLIST(FileID,ErrorName,SrNo,ServerDateTime) values(@FileID,SUBSTRING(@Error_list, 2,LEN(@Error_list)),@SrNo,GETDATE())

END

END

-- dbo.YARD_DELETE
GO
CREATE   PROCEDURE [dbo].[YARD_DELETE]

( 

    @YardID BIGINT,

    @DeletedBy BIGINT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        UPDATE ESS_MST_YARD

        SET IsDelete = 1,

            DeletedBy = @DeletedBy,

            DeletedDate = GETDATE()

        WHERE YardID = @YardID;

        

        SELECT @@ROWCOUNT AS RowsAffected;

    END TRY

    BEGIN CATCH

        SELECT ERROR_MESSAGE() AS ErrorMessage,

               ERROR_LINE() AS ErrorLine,

               ERROR_NUMBER() AS ErrorNumber;

    END CATCH

END

-- dbo.YARD_GET
GO
CREATE PROCEDURE [dbo].[YARD_GET]

(

    @YardID BIGINT = NULL,

    @PlantID BIGINT = NULL,

    @IncludeDeleted BIT = 0

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        SELECT

            YardID,

            PlantID,

            YardName,

            YardCode,

            YardTypeID,

            LatLong,

            Polygon.STAsText() AS Polygon,

            IsActive,

            IsDelete,

            CreatedBy,

            CreatedDate,

            ModifiedBy,

            ModifiedDate,

            DeletedBy,

            DeletedDate

        FROM ESS_MST_YARD

        WHERE (@YardID IS NULL OR YardID = @YardID)

            AND (@PlantID IS NULL OR PlantID = @PlantID)

            AND (@IncludeDeleted = 1 OR IsDelete = 0)

        ORDER BY YardID DESC;

    END TRY

    BEGIN CATCH

        SELECT ERROR_MESSAGE() AS ErrorMessage,

               ERROR_LINE() AS ErrorLine,

               ERROR_NUMBER() AS ErrorNumber;

    END CATCH

END

-- dbo.YARD_GET_ALL
GO
CREATE PROCEDURE [dbo].[YARD_GET_ALL]

(

    @YardID BIGINT = NULL,

    @PlantID BIGINT = NULL,

    @IncludeDeleted BIT = 0

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        SELECT

            YardID,

            PlantID,

            YardName,

            YardCode,

            YardTypeID,

            LatLong,

            Polygon.STAsText() AS Polygon,

            IsActive,

            IsDelete,

            CreatedBy,

            CreatedDate,

            ModifiedBy,

            ModifiedDate,

            DeletedBy,

            DeletedDate

        FROM ESS_MST_YARD

        WHERE (@YardID IS NULL OR YardID = @YardID)

            AND (@PlantID IS NULL OR PlantID = @PlantID)

            AND (@IncludeDeleted = 1 OR IsDelete = 0)

        ORDER BY YardID DESC;

    END TRY

    BEGIN CATCH

        SELECT ERROR_MESSAGE() AS ErrorMessage,

               ERROR_LINE() AS ErrorLine,

               ERROR_NUMBER() AS ErrorNumber;

    END CATCH

END

-- dbo.YARD_INSERT
GO
CREATE PROCEDURE [dbo].[YARD_INSERT]

(

    @PlantID BIGINT = NULL,

    @YardName VARCHAR(100) = NULL,

    @YardCode VARCHAR(50) = NULL,

    @YardTypeID BIGINT = NULL,

    @LatLong VARCHAR(100) = NULL,

    @Polygon GEOMETRY = NULL,

    @IsActive BIT = 1,

    @IsDelete BIT = 0,

    @CreatedBy BIGINT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        INSERT INTO ESS_MST_YARD

        (

            PlantID,

            YardName,

            YardCode,

            YardTypeID,

            LatLong,

            Polygon,

            IsActive,

            CreatedBy,

            CreatedDate

        )

        VALUES

        (

            @PlantID,

            @YardName,

            @YardCode,

            @YardTypeID,

            @LatLong,

            @Polygon,

            @IsActive,

            @CreatedBy,

            GETDATE()

        );

        

        SELECT SCOPE_IDENTITY() AS InsertedID;

    END TRY

    BEGIN CATCH

        SELECT ERROR_MESSAGE() AS ErrorMessage,

               ERROR_LINE() AS ErrorLine,

               ERROR_NUMBER() AS ErrorNumber;

    END CATCH

END

-- dbo.YARD_UPDATE
GO
CREATE   PROCEDURE [dbo].[YARD_UPDATE]

(

    @YardID BIGINT,

    @PlantID BIGINT = NULL,

    @YardName VARCHAR(100) = NULL,

    @YardCode VARCHAR(50) = NULL,

    @YardTypeID BIGINT = NULL,

    @LatLong VARCHAR(100) = NULL,

    @Polygon GEOMETRY = NULL,

    @IsActive BIT = 1,

    @ModifiedBy BIGINT = NULL

)

AS

BEGIN

    SET NOCOUNT ON;

    BEGIN TRY

        UPDATE ESS_MST_YARD

        SET PlantID = @PlantID,

            YardName = @YardName,

            YardCode = @YardCode,

            YardTypeID = @YardTypeID,

            LatLong = @LatLong,

            Polygon = @Polygon,

            IsActive = @IsActive,

            ModifiedBy = @ModifiedBy,

            ModifiedDate = GETDATE()

        WHERE YardID = @YardID;

        

        SELECT @@ROWCOUNT AS RowsAffected;

    END TRY

    BEGIN CATCH

        SELECT ERROR_MESSAGE() AS ErrorMessage,

               ERROR_LINE() AS ErrorLine,

               ERROR_NUMBER() AS ErrorNumber;

    END CATCH

END

