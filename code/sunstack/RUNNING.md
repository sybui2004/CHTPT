# Hướng Dẫn Chạy Dự Án

## Cấu Trúc Dịch Vụ (Microservices)

Dự án sử dụng kiến trúc microservices với 13 services:

| Service | Port | Mô tả |
|---------|------|--------|
| gateway | 8000 | API Gateway - điều hướng request |
| auth-service | 8001 | Xác thực, JWT tokens |
| user-service | 8002 | Quản lý người dùng |
| product-service | 8003 | Quản lý sản phẩm |
| order-service | 8004 | Quản lý đơn hàng |
| shop-service | 8005 | Quản lý cửa hàng |
| payment-service | 8006 | Thanh toán (VNPay) |
| notification-service | 8007 | Thông báo |
| voucher-service | 8008 | Quản lý voucher |
| review-service | 8009 | Quản lý đánh giá |
| chat-service | 8010 | Chat nhắn tin |
| upload-service | 8011 | Upload file (Cloudinary) |
| complaint-service | 8012 | Khiếu nại |

## Yêu Cầu

- Docker & Docker Compose
- Python 3.11+ (nếu chạy local)

## Chạy Bằng Docker Compose

### 1. Chạy môi trường Development

```bash
docker-compose up --build
```

Truy cập:
- Frontend: http://localhost:5173
- API Gateway: http://localhost:8000
- MongoDB (Mongo Express): http://localhost:8081
- Auth Service: http://localhost:8001
- User Service: http://localhost:8002
- Product Service: http://localhost:8003
- Order Service: http://localhost:8004
- Shop Service: http://localhost:8005
- Payment Service: http://localhost:8006
- Notification Service: http://localhost:8007
- Voucher Service: http://localhost:8008
- Review Service: http://localhost:8009
- Chat Service: http://localhost:8010
- Upload Service: http://localhost:8011
- Complaint Service: http://localhost:8012

### 2. Chạy môi trường Production

```bash
docker-compose -f docker-compose-prod.yml up --build
```

### 3. Dừng các services

```bash
docker-compose down
```

### 4. Xóa toàn bộ dữ liệu

```bash
docker-compose down -v
```

## Chạy Local (Không Docker)

### 1. Cài đặt Python dependencies cho mỗi service

```bash
cd backend/services/<service-name>
pip install -r requirements.txt
```

### 2. Chạy MongoDB (Docker)

```bash
docker run -d -p 27018:27017 --name mongo mongo:6
```

### 3. Chạy từng service

```bash
cd backend/services/auth-service
uvicorn services.auth_service.main:app --reload --port 8001
```

Lặp lại cho các service khác với port tương ứng.

## Health Check

Kiểm tra trạng thái của các service:

```bash
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:8002/health
# ... các service khác tương tự
```

## Biến Môi Trường

Mỗi service sử dụng file `.env` riêng trong thư mục `backend/services/<service-name>/.env`

Các biến quan trọng:

| Biến | Mô tả |
|------|--------|
| `MONGO_URI` | Connection string MongoDB |
| `MONGO_DATABASE` | Tên database |
| `AUTH_SERVICE_URL` | URL của auth-service (cho các service khác) |
| `JWT_SECRET` | Secret key cho JWT |
| `CORS_ORIGINS` | Danh sách origins cho CORS |

## Cấu Trúc Phụ Thuộc Giữa Các Service

```
                            ┌─────────────┐
                            │   Gateway   │ (8000)
                            └──────┬──────┘
                                   │
                     ┌─────────────┴─────────────┐
                     │                           │
              ┌──────┴──────┐             ┌──────┴──────┐
              │ Auth Service│             │  Frontend   │
              └──────┬──────┘             └─────────────┘
                    │
    ┌───────────────┼───────────────┬───────────────┬───────────┐
    │               │               │               │           │
┌───┴───┐     ┌─────┴─────┐  ┌─────┴─────┐  ┌───┴───┐  ┌───┴────┐
│ User  │     │  Product  │  │   Order   │  │ Shop  │  │Payment │
│  Svc  │     │    Svc    │  │    Svc    │  │  Svc  │  │  Svc   │
└───────┘     └───────────┘  └─────┬─────┘  └───────┘  └────────┘
                                   │
                              ┌─────┴─────┐
                              │  Product  │
                              │    Svc    │
                              └───────────┘
```

## Các Service Độc Lập

Những service sau không phụ thuộc vào service khác (ngoài auth-service):

- `notification-service` - Thông báo
- `voucher-service` - Voucher
- `review-service` - Đánh giá
- `chat-service` - Chat nhắn tin
- `upload-service` - Upload file
- `complaint-service` - Khiếu nại

## Troubleshooting

### Service không khởi động được
- Kiểm tra MongoDB đã chạy chưa: `docker ps | grep mongo`
- Kiểm tra healthcheck: `curl http://localhost:<port>/health`

### Lỗi kết nối MongoDB
- Kiểm tra `MONGO_URI` trong `.env` file
- Đảm bảo MongoDB replica set đã được khởi tạo

### Lỗi CORS
- Kiểm tra `CORS_ORIGINS` trong `.env` file của từng service
- Frontend URL phải được thêm vào danh sách origins

### Lỗi JWT
- Kiểm tra `JWT_SECRET` trong auth-service và các service khác
- Secret phải giống nhau giữa các services
