-- Create or Alter the SP_USER_LOGIN stored procedure
-- This procedure handles user authentication and returns user details with plant assignment

IF OBJECT_ID('dbo.SP_USER_LOGIN', 'P') IS NOT NULL
    DROP PROCEDURE dbo.SP_USER_LOGIN;
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
GO
