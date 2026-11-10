import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, Token, UserCreate, UserResponse

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["Authentication"])
async def register_user(req: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if username or email already exists
    stmt = select(User).where(or_(User.username == req.username, User.email == req.email))
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email is already registered"
        )

    user = User(
        id=str(uuid.uuid4()),
        username=req.username,
        email=req.email,
        hashed_password=get_password_hash(req.password),
        role=req.role,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token, tags=["Authentication"])
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.username == req.username)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is deactivated"
        )

    token = create_access_token(
        subject=user.username,
        claims={"role": user.role.value, "user_id": user.id}
    )
    return Token(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )


@router.post("/token", response_model=Token, tags=["Authentication"])
async def token_endpoint(
    req: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """OAuth2 / JSON login endpoint returning access token."""
    return await login(req, db)


from app.api.deps import get_current_user


@router.get("/me", response_model=UserResponse, tags=["Authentication"])
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Returns currently authenticated user profile and roles."""
    return current_user

