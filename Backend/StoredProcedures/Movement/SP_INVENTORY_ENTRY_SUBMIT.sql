-- Inventory Entry Submit
-- 1. Resolves LocationID from Block + Row + Column (ESS_MST_LOCATION)
-- 2. Resolves INVENTORY_ID from ContainerNo (TBL_CONTAINER_INVENTORY, active row)
-- 3. Inserts a row in TBL_EQUIPMENT_TRANSACTION
-- 4. Updates LAST_LOCATION + LAST_MOVED_DATE on TBL_CONTAINER_INVENTORY
-- All steps run inside one transaction — all succeed or all roll back.
-- Note: ESS_MST_LOCATION.PlantID is NULL in this DB so plant filter is skipped.
CREATE OR ALTER PROCEDURE dbo.SP_INVENTORY_ENTRY_SUBMIT
    @PlantId     INT           = NULL,   -- kept for signature compat
    @ContainerNo NVARCHAR(30)  = NULL,
    @BlockName   NVARCHAR(100) = NULL,
    @RowNo       NVARCHAR(50)  = NULL,
    @ColumnName  NVARCHAR(50)  = NULL,
    @DeviceId    VARCHAR(50)   = NULL,
    @CreatedBy   INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Step 1: Resolve LocationID from Block / Row / Column
        DECLARE @LocationId INT = NULL;

        SELECT TOP 1 @LocationId = LocationID
        FROM ESS_MST_LOCATION
        WHERE LTRIM(RTRIM(BlockName))  = LTRIM(RTRIM(@BlockName))
          AND LTRIM(RTRIM(RowNo))      = LTRIM(RTRIM(@RowNo))
          AND LTRIM(RTRIM(ColumnName)) = LTRIM(RTRIM(@ColumnName))
        ORDER BY StackNo ASC;

        IF @LocationId IS NULL
        BEGIN
            SELECT CAST(0 AS INT) AS Status,
                   N'Location not found for Block=' + ISNULL(@BlockName,'?')
                   + ' Row=' + ISNULL(@RowNo,'?')
                   + ' Column=' + ISNULL(@ColumnName,'?') AS Message;
            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- Step 2: Resolve InventoryId from ContainerNo (latest active entry)
        DECLARE @InventoryId INT = NULL;

        SELECT TOP 1 @InventoryId = INVENTORY_ID
        FROM TBL_CONTAINER_INVENTORY
        WHERE CONTAINER_NO  = UPPER(LTRIM(RTRIM(@ContainerNo)))
          AND GATE_OUT_DATE IS NULL
        ORDER BY GATE_IN_DATE DESC;

        IF @InventoryId IS NULL
        BEGIN
            SELECT CAST(0 AS INT) AS Status,
                   N'Container not found in active inventory: ' + ISNULL(@ContainerNo,'NULL') AS Message;
            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- Step 3: Determine CONTAINER_TRANS_TYPE (4=first placement, 3=re-shift)
        DECLARE @TransType INT = 3;
        IF NOT EXISTS (
            SELECT 1 FROM TBL_EQUIPMENT_TRANSACTION WHERE INVENTORY_ID = @InventoryId
        )
            SET @TransType = 4;

        -- Step 4: Insert transaction record
        INSERT INTO TBL_EQUIPMENT_TRANSACTION (
            LOCATION_ID,
            INVENTORY_ID,
            OCR_CONTAINER_NO,
            DEVICE_ID,
            PACKET_TYPE,
            CONTAINER_TRANS_TYPE,
            TRANSACTION_DATE,
            CREATED_ON
        )
        VALUES (
            @LocationId,
            @InventoryId,
            UPPER(LTRIM(RTRIM(@ContainerNo))),
            @DeviceId,
            'MANUAL',
            @TransType,
            GETDATE(),
            GETDATE()
        );

        DECLARE @TransactionId INT = SCOPE_IDENTITY();

        -- Step 5: Update container inventory location
        UPDATE TBL_CONTAINER_INVENTORY
        SET
            LAST_LOCATION   = @LocationId,
            LAST_MOVED_DATE = GETDATE()
        WHERE INVENTORY_ID = @InventoryId;

        COMMIT TRANSACTION;

        SELECT
            CAST(1 AS INT) AS Status,
            N'Inventory entry submitted successfully' AS Message,
            @TransactionId AS TransactionId,
            @InventoryId   AS InventoryId,
            @LocationId    AS LocationId,
            @ContainerNo   AS ContainerNo,
            @BlockName     AS BlockName,
            @RowNo         AS RowNo,
            @ColumnName    AS ColumnName;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrNum INT            = ERROR_NUMBER();
        RAISERROR('SP_INVENTORY_ENTRY_SUBMIT failed (%d): %s', 16, 1, @ErrNum, @ErrMsg);
    END CATCH
END;
