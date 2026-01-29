"""
Authentication API endpoints
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.services.auth_service import AuthService

router = APIRouter(prefix="/api", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    user: Optional[dict] = None
    message: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    POST /api/login
    Authenticate user and return user data
    """
    try:
        if not request.email or not request.password:
            raise HTTPException(
                status_code=400,
                detail="Email and password are required"
            )
        
        user = AuthService.authenticate_user(request.email, request.password)
        
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        return {
            "success": True,
            "user": user,
            "message": "Login successful"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )
