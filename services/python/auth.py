import os
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt.exceptions import PyJWTError as JWTError
from typing import Optional

SECRET = os.getenv("PYTHON_SERVICE_SECRET") or os.getenv("SESSION_SECRET", "")
ALGORITHM = "HS256"
ISSUER = "fintekpro-main"

security = HTTPBearer()


class TokenPayload:
    def __init__(self, sub: str, role: str, roles: list, email: Optional[str], mobile: Optional[str]):
        self.user_id = sub
        self.role = role
        self.roles = roles
        self.email = email
        self.mobile = mobile


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> TokenPayload:
    if not SECRET:
        raise HTTPException(status_code=500, detail="PYTHON_SERVICE_SECRET not configured on Python service")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM], issuer=ISSUER)
        return TokenPayload(
            sub=str(payload["sub"]),
            role=payload.get("role", "user"),
            roles=payload.get("roles", ["user"]),
            email=payload.get("email"),
            mobile=payload.get("mobile"),
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid service token: {str(e)}")
