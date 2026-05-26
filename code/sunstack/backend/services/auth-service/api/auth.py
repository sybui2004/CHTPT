from datetime import datetime, timezone, timedelta
from typing import Annotated, Any
from urllib.parse import urlencode

from bson import ObjectId
from fastapi import APIRouter, Body, Cookie, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
import httpx

from core.config import get_settings
from core.db import get_db
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])
settings = get_settings()


def serialize_user(user: dict[str, Any]) -> dict[str, Any]:
    if user is None:
        return {}
    user_data = user.copy()
    if "_id" in user_data:
        user_data["id"] = str(user_data.pop("_id"))
    return user_data


def user_token_payload(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "sub": str(user["_id"]),
        "username": user.get("username") or str(user["_id"]),
        "fullName": user.get("fullName") or user.get("full_name") or user.get("username") or "",
        "avatarUrl": user.get("avatarUrl") or "",
    }


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token",
        )
    token = authorization[7:]
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
        return user_id
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        )


@router.post("/login")
async def login(request: LoginRequest, response: Response):
    db = get_db()
    user = await db.users.find_one({"username": request.username})

    if not user or not verify_password(request.password, user.get("password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if user.get("deleted") or user.get("locked"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    access_token = create_access_token(user_token_payload(user))
    refresh_token = create_refresh_token({"sub": str(user["_id"])})

    response.set_cookie(
        "refresh_token",
        refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=30 * 24 * 60 * 60,
        path="/",
    )

    return {"token": access_token}


@router.post("/register")
async def register(request: RegisterRequest):
    db = get_db()

    existing_user = await db.users.find_one({"username": request.username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    if request.email:
        existing_email = await db.users.find_one({"email": request.email})
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

    user_data = {
        "username": request.username,
        "password": get_password_hash(request.password),
        "roles": ["user"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "locked": False,
        "deleted": False,
        "emailVerified": False,
    }

    if request.email:
        user_data["email"] = request.email
    if request.phone:
        user_data["phone"] = request.phone
    if request.full_name:
        user_data["full_name"] = request.full_name
    if request.dob:
        user_data["dob"] = request.dob

    result = await db.users.insert_one(user_data)

    # Send verify email (best-effort)
    if request.email:
        from services.email import send_verify_email

        verify_token = create_access_token(
            {"sub": str(result.inserted_id), "email": request.email, "purpose": "verify_email"},
            expires_delta=timedelta(hours=24),
        )
        verify_url = f"{settings.public_base_url.rstrip('/')}/verify-email?token={verify_token}"
        try:
            send_verify_email(to_email=request.email, verify_url=verify_url)
        except Exception:
            # Don't fail registration if email can't be sent
            pass

    return {"status": "success"}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token", path="/")
    return {"status": "success", "message": "Logged out successfully"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest | None = None, refresh_token: str | None = Cookie(default=None)):
    token = request.refresh_token if request else refresh_token
    return await _do_refresh(token)


async def _do_refresh(token: str | None) -> TokenResponse:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )

    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or user.get("deleted") or user.get("locked"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled",
        )

    new_access_token = create_access_token(user_token_payload(user))
    new_refresh_token = create_refresh_token({"sub": user_id})

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
    )


@router.get("/refreshToken", response_model=RefreshTokenResponse)
async def refresh_token_alt(refresh_token: str | None = Cookie(default=None)):
    result = await _do_refresh(refresh_token)
    return RefreshTokenResponse(token=result.access_token)


@router.post("/change-password")
async def change_password(request: ChangePasswordRequest, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(request.old_password, user.get("password", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    new_hash = get_password_hash(request.new_password)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": new_hash, "updated_at": datetime.now(timezone.utc)}},
    )

    return {"status": "success", "message": "Password changed successfully"}


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Start password reset flow.

    - Always returns success to avoid user enumeration.
    - If email exists and SMTP is configured, sends reset link to user.
    """
    db = get_db()

    email = request.email.strip().lower()
    user = await db.users.find_one({"email": email})

    if not user:
        return {"status": "success"}

    from services.email import send_reset_password_email

    reset_token = create_access_token(
        {"sub": str(user["_id"]), "email": email, "purpose": "reset_password"},
        expires_delta=timedelta(hours=1),
    )
    reset_url = f"{settings.public_base_url.rstrip('/')}/reset-password/{reset_token}"

    try:
        send_reset_password_email(to_email=email, reset_url=reset_url)
    except Exception:
        pass

    return {"status": "success"}


@router.get("/verify-reset-token")
async def verify_reset_token(token: str = Query(...)):
    """Validate reset-password token before showing reset form."""
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    if payload.get("purpose") != "reset_password":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token purpose")

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id or not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token payload")

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.get("email") and user.get("email") != email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token email does not match user")

    return {"status": "success"}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Complete password reset flow."""
    try:
        payload = decode_token(request.token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    if payload.get("purpose") != "reset_password":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token purpose")

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id or not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token payload")

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.get("email") and user.get("email") != email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token email does not match user")

    new_hash = get_password_hash(request.new_password)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": new_hash, "updated_at": datetime.now(timezone.utc)}},
    )

    return {"status": "success"}


@router.post("/verify-email")
async def verify_email(request: VerifyEmailRequest):
    try:
        payload = decode_token(request.token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    if payload.get("purpose") != "verify_email":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token purpose")

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token payload")

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if email and user.get("email") and user.get("email") != email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token email does not match user")

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"emailVerified": True, "updated_at": datetime.now(timezone.utc)}},
    )

    return {"status": "success"}


@router.post("/google/auth")
async def google_auth(request: GoogleAuthRequest):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Google OAuth not implemented",
    )


OAUTH2_PROVIDERS = {
    "google": {
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope": "openid email profile",
    },
}


@router.get("/oauth2/authorization/{provider}")
async def oauth2_authorization(provider: str, request: Request):
    if provider not in OAUTH2_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unsupported OAuth2 provider: {provider}",
        )

    provider_config = OAUTH2_PROVIDERS[provider]
    state_data = {
        "redirect_uri": str(request.query_params.get("redirect_uri", "/")),
    }
    import json
    import base64
    state = base64.urlsafe_b64encode(
        json.dumps(state_data).encode()
    ).decode()

    callback_url = _frontend_oauth_callback_url(provider)

    auth_params = urlencode({
        'client_id': settings.google_client_id,
        'redirect_uri': callback_url,
        'response_type': 'code',
        'scope': provider_config['scope'],
        'state': state,
        'access_type': 'online',
    })
    auth_url = f"{provider_config['auth_url']}?{auth_params}"

    return RedirectResponse(url=auth_url)


@router.get("/login/oauth2/code/{provider}")
async def oauth2_callback(provider: str, code: str = Query(...), state: str = Query(...)):
    if provider not in OAUTH2_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unsupported OAuth2 provider: {provider}",
        )

    provider_config = OAUTH2_PROVIDERS[provider]

    import json
    import base64
    try:
        state_data = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
    except Exception:
        state_data = {"redirect_uri": "/"}

    callback_base = settings.cors_origins.split(",")[0].strip().rstrip("/")
    callback_url = f"{callback_base}/login/oauth2/code/{provider}"

    token_response = await _exchange_code_for_token(
        code=code,
        callback_url=callback_url,
        provider_config=provider_config,
    )

    access_token = token_response.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to obtain access token from OAuth2 provider",
        )

    user_info = await _get_user_info(access_token, provider_config)

    db = get_db()
    user = await db.users.find_one({"email": user_info["email"]})

    if not user:
        user_data = {
            "username": user_info.get("email", user_info["sub"]),
            "email": user_info.get("email"),
            "full_name": user_info.get("name"),
            "roles": ["user"],
            "provider": provider,
            "provider_id": user_info["sub"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "locked": False,
            "deleted": False,
        }
        result = await db.users.insert_one(user_data)
        user = await db.users.find_one({"_id": result.inserted_id})

    jwt_access = create_access_token(user_token_payload(user))
    jwt_refresh = create_refresh_token({"sub": str(user["_id"])})

    redirect_url = state_data.get("redirect_uri", "/")
    if "?" in redirect_url:
        separator = "&"
    else:
        separator = "?"
    redirect_url = f"{redirect_url}{separator}token={jwt_access}&refresh_token={jwt_refresh}"

    return RedirectResponse(url=redirect_url)


@router.post("/oauth2/login")
async def oauth2_login(response: Response, provider: str = Query(...), code: str = Query(...)):
    if provider not in OAUTH2_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unsupported OAuth2 provider: {provider}",
        )

    provider_config = OAUTH2_PROVIDERS[provider]
    token_response = await _exchange_code_for_token(
        code=code,
        callback_url=_frontend_oauth_callback_url(provider),
        provider_config=provider_config,
    )

    access_token = token_response.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to obtain access token from OAuth2 provider",
        )

    user_info = await _get_user_info(access_token, provider_config)
    user = await _find_or_create_oauth_user(provider, user_info)
    jwt_access = create_access_token(user_token_payload(user))
    jwt_refresh = create_refresh_token({"sub": str(user["_id"])})
    response.set_cookie(
        "refresh_token",
        jwt_refresh,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/",
    )
    return {"token": jwt_access}


def _frontend_oauth_callback_url(provider: str) -> str:
    frontend_base = settings.cors_origins.split(",")[0].strip().rstrip("/")
    return f"{frontend_base}/redirect/auth?provider={provider}"


async def _find_or_create_oauth_user(provider: str, user_info: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    email = user_info.get("email")
    user = await db.users.find_one({"email": email}) if email else None

    picture = user_info.get("picture")
    if not user:
        username = email or user_info.get("sub")
        user_data = {
            "username": username,
            "email": email,
            "fullName": user_info.get("name"),
            "full_name": user_info.get("name"),
            "avatarUrl": picture,
            "roles": ["user"],
            "provider": provider,
            "provider_id": user_info.get("sub"),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "locked": False,
            "deleted": False,
            "fromSocial": True,
            "emailVerified": bool(email),
        }
        result = await db.users.insert_one(user_data)
        user = await db.users.find_one({"_id": result.inserted_id})
    elif picture and user.get("avatarUrl") != picture:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"avatarUrl": picture, "updated_at": datetime.now(timezone.utc)}}
        )
        user = await db.users.find_one({"_id": user["_id"]})

    return user


async def _exchange_code_for_token(code: str, callback_url: str, provider_config: dict) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            provider_config["token_url"],
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": callback_url,
                "grant_type": "authorization_code",
            },
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to exchange code for token: {response.text}",
        )
    return response.json()


async def _get_user_info(access_token: str, provider_config: dict) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            provider_config["userinfo_url"],
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to fetch user info from OAuth2 provider",
        )
    return response.json()


@router.get("/ping")
async def ping(authorization: Annotated[str | None, Header()] = None):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing access token")
    try:
        payload = decode_token(authorization[7:])
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        return {"username": payload.get("sub")}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token")
