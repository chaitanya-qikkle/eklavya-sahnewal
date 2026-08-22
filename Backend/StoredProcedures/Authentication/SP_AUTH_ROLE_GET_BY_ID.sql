-- ============================================================
-- SP_AUTH_ROLE_GET_BY_ID
-- Returns the ROLE name for a given ROLE_ID.
-- Used by: login flow as fallback when SP_USER_LOGIN
--          does not include the ROLE column in its result.
--
-- Parameters:
--   @RoleId  INT
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_AUTH_ROLE_GET_BY_ID
    @RoleId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        ROLE_ID AS ROLE_ID,
        ROLE    AS ROLE
    FROM TBL_MST_ROLE
    WHERE ROLE_ID   = @RoleId
      AND IS_DELETED = 0;
END;
GO
