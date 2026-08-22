from fastapi import HTTPException, Security, status
from typing import Optional
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from v1.api.auth.jwt_token import verify_token
from jose import JWTError

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    token = credentials.credentials
    
    try:
        payload = verify_token(token)
        
        # Verify token type
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        # Extract user info
        user_id = payload.get("sub")
        username = payload.get("username")
        plant_id = payload.get("plant_id")
        
        if not user_id or plant_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        return {
            "user_id": user_id,
            "username": username,
            "plant_id": plant_id
        }
        
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(optional_security)
) -> Optional[dict]:
    
    if not credentials:
        return None
    
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None
