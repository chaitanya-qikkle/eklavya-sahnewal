from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Rate limit configurations
RATE_LIMIT_PER_MINUTE = os.getenv("RATE_LIMIT_PER_MINUTE", "60")
LOGIN_RATE_LIMIT_PER_MINUTE = os.getenv("LOGIN_RATE_LIMIT_PER_MINUTE", "5")


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    Custom handler for rate limit exceeded errors
    """
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "message": "Rate limit exceeded. Please try again later.",
            "data": None
        }
    )
