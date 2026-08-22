from fastapi import APIRouter, HTTPException, status, Request
from v1.api.auth.jwt_token import create_access_token, create_refresh_token
from utils.db_utils import SQLManager
from models.user_model import LoginRequest
from middleware.rate_limiter import limiter, LOGIN_RATE_LIMIT_PER_MINUTE
import logging

logger = logging.getLogger(__name__)
login_router = APIRouter()


@login_router.post("/login")
@limiter.limit(f"{LOGIN_RATE_LIMIT_PER_MINUTE}/minute")
async def login(request: Request, login_request: LoginRequest):
    db = SQLManager()

    try:
        response = db.execute_query("EXEC GET_IND_MST_USER", commit=False)

        if response.get("status") == "error":
            logger.error(f"DB error during login for user: {login_request.username} - {response.get('message')}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=response.get("message") or "Database unavailable"
            )

        users = response.get("data") or []
        user = next(
            (u for u in users if u.get("UserName", "").lower() == login_request.username.lower()),
            None
        )

        if not user:
            logger.warning(f"Login failed — user not found: {login_request.username}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        if user.get("Password") != login_request.password:
            logger.warning(f"Login failed — wrong password for user: {login_request.username}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        user_id  = str(user["UserID"])
        role_id  = str(user.get("RoleID") or "")
        plant_id = user.get("PlantID") or 0
        fname    = user.get("FName") or ""
        lname    = user.get("LName") or ""
        email    = user.get("EmailId") or ""

        access_token  = create_access_token(user_id=user_id, username=login_request.username, plant_id=plant_id)
        refresh_token = create_refresh_token(user_id=user_id)

        logger.info(f"Successful login: {login_request.username}, role_id={role_id}")

        return {
            "status": "success",
            "message": "Login successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_details": {
                "user_id": user_id,
                "username": login_request.username,
                "first_name": fname,
                "last_name": lname,
                "email": email,
                "role_id": role_id,
                "role": "User",
                "plant_id": plant_id
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error for user {login_request.username}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login"
        )

    finally:
        db.close_connection()
