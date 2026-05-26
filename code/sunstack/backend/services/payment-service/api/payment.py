from datetime import datetime, timezone
import hashlib
import hmac
import logging
from urllib.parse import urlencode
from typing import Annotated, Any, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status

from core.db import get_db
from core.config import get_settings
from schemas.payment import (
    TransactionResponse,
)

router = APIRouter(prefix="/api/v1/payment", tags=["Payment"])
logger = logging.getLogger(__name__)


def serialize_doc(doc: dict[str, Any]) -> dict[str, Any]:
    if doc is None:
        return {}
    data = doc.copy()
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    return data


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    from jose import JWTError, jwt

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token",
        )
    token = authorization[7:]

    from core.config import get_settings
    settings = get_settings()

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        return user_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


@router.post("/vnpay/create")
async def create_vnpay_payment():
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="VNPay integration not implemented",
    )


@router.get("/vnpay/return")
async def vnpay_return(request: Request) -> dict[str, Any]:
    params = dict(request.query_params)
    secure_hash = params.pop("vnp_SecureHash", "")
    params.pop("vnp_SecureHashType", None)
    expected_hash = _create_vnpay_secure_hash(params)
    if not hmac.compare_digest(secure_hash.lower(), expected_hash.lower()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment signature")

    order_id = params.get("vnp_TxnRef", "")
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid orderId")

    is_success = params.get("vnp_ResponseCode") == "00" and params.get("vnp_TransactionStatus") == "00"
    now = datetime.now(timezone.utc)
    payment_update = {
        "status": "COMPLETED" if is_success else "FAILED",
        "response_code": params.get("vnp_ResponseCode"),
        "transaction_status": params.get("vnp_TransactionStatus"),
        "transaction_no": params.get("vnp_TransactionNo"),
        "bank_code": params.get("vnp_BankCode"),
        "paid_at": now if is_success else None,
        "updated_at": now,
    }

    order_db = get_db().client.get_database("order_db")
    update_data: dict[str, Any] = {
        "status": "CONFIRMED" if is_success else "PENDING",
        "shop_orders.$[].status": "CONFIRMED" if is_success else "PENDING",
        "payment.status": payment_update["status"],
        "payment.responseCode": payment_update["response_code"],
        "payment.transactionStatus": payment_update["transaction_status"],
        "payment.transactionNo": payment_update["transaction_no"],
        "payment.bankCode": payment_update["bank_code"],
        "updated_at": now,
    }
    if is_success:
        update_data.update({
            "completedPayment": True,
            "completed_payment": True,
            "payment.completedAt": now,
            "payment.completed_at": now,
        })

    result = await order_db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if is_success:
        try:
            order = await order_db.orders.find_one({"_id": ObjectId(order_id)})
            from backend.libs.redis import RedisStreams, get_redis_client

            RedisStreams(get_redis_client()).publish("order-events", {
                "event_type": "order.updated",
                "order_id": order_id,
                "user_id": order.get("user_id", "") if order else "",
                "status": "CONFIRMED",
                "shop_orders": order.get("shop_orders", []) if order else [],
            })
        except Exception as e:
            logger.warning("order_confirmed_event_publish_failed order_id=%s err=%s", order_id, e)

    await get_db().payments.update_one(
        {"order_id": order_id},
        {"$set": {"order_id": order_id, **payment_update}},
        upsert=True,
    )

    return {
        "status": "success" if is_success else "failed",
        "orderId": order_id,
        "message": "Payment completed" if is_success else "Payment failed",
    }


def _vnpay_datetime(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y%m%d%H%M%S")


def _create_vnpay_secure_hash(params: dict[str, Any]) -> str:
    settings = get_settings()
    sorted_params = sorted((key, str(value)) for key, value in params.items() if value is not None and value != "")
    hash_data = urlencode(sorted_params)
    return hmac.new(
        settings.vnpay_secret_key.encode("utf-8"),
        hash_data.encode("utf-8"),
        hashlib.sha512,
    ).hexdigest()


def _build_vnpay_payment_url(order_id: str, amount: int, request: Request) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    params = {
        "vnp_Version": "2.1.0",
        "vnp_Command": "pay",
        "vnp_TmnCode": settings.vnpay_tmn_code,
        "vnp_Amount": int(amount) * 100,
        "vnp_CurrCode": "VND",
        "vnp_TxnRef": order_id,
        "vnp_OrderInfo": f"Thanh toan don hang {order_id}",
        "vnp_OrderType": "other",
        "vnp_Locale": "vn",
        "vnp_ReturnUrl": settings.vnpay_return_url,
        "vnp_IpAddr": request.client.host if request.client else "127.0.0.1",
        "vnp_CreateDate": _vnpay_datetime(now),
    }
    sorted_params = sorted((key, str(value)) for key, value in params.items())
    hash_data = urlencode(sorted_params)
    secure_hash = _create_vnpay_secure_hash(params)
    return f"{settings.vnpay_url}?{hash_data}&vnp_SecureHash={secure_hash}"


@router.get("/payment_url")
async def get_payment_url(
    request: Request,
    orderId: str = Query(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    if not ObjectId.is_valid(orderId):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid orderId")

    order_db = get_db().client.get_database("order_db")
    order = await order_db.orders.find_one({"_id": ObjectId(orderId), "user_id": user_id})
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.get("payment_type") != "bank_transfer" and order.get("paymentType") != "bank_transfer":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order is not bank transfer")
    if order.get("completedPayment") or order.get("completed_payment") or order.get("payment", {}).get("status") == "COMPLETED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment already completed")

    expire_at = order.get("payment", {}).get("expireAt")
    if expire_at and expire_at.tzinfo is None:
        expire_at = expire_at.replace(tzinfo=timezone.utc)
    if expire_at and expire_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment expired")

    amount = int(order.get("payment", {}).get("amount") or order.get("final_amount") or 0)
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment amount")

    payment_url = _build_vnpay_payment_url(orderId, amount, request)
    await get_db().payments.update_one(
        {"order_id": orderId, "user_id": user_id},
        {"$set": {
            "order_id": orderId,
            "user_id": user_id,
            "amount": amount,
            "payment_method": "VNPAY",
            "status": "PENDING",
            "payment_url": payment_url,
            "updated_at": datetime.now(timezone.utc),
        }, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"url": payment_url, "paymentUrl": payment_url}


@router.post("/order/{order_id}/pay")
async def pay_order(
    order_id: str,
    payment_method: str = "VNPAY",
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    db = get_db()

    payment_data = {
        "user_id": user_id,
        "order_id": order_id,
        "payment_method": payment_method,
        "status": "PENDING",
        "created_at": datetime.now(timezone.utc),
    }

    result = await db.payments.insert_one(payment_data)
    payment_data["id"] = str(result.inserted_id)

    return {
        "status": "success",
        "payment_id": str(result.inserted_id),
        "message": "Payment initiated",
    }
