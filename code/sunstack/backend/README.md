# Backend SunStack

Thư mục `backend` chứa toàn bộ mã nguồn backend của SunStack. Backend được tổ chức theo kiến trúc microservices, mỗi service là một ứng dụng FastAPI riêng và được API Gateway điều phối request từ frontend.

Các service giao tiếp với nhau chủ yếu qua REST API nội bộ. Redis được dùng cho cache, trạng thái realtime và một số luồng Pub/Sub. MongoDB là database chính cho các service.

## 1. Kiến trúc tổng quan

Luồng request chính:

```text
Frontend -> Gateway -> Các backend service -> MongoDB/Redis
```

Khi chạy bằng Docker Compose ở thư mục `code/sunstack`, hệ thống gồm:

- Frontend React.
- API Gateway.
- Các backend microservice.
- MongoDB.
- Redis.
- Filebeat để gửi log sang ELK.

## 2. Danh sách service

| Service | Port | Vai trò |
| --- | --- | --- |
| `gateway` | `8000` | API Gateway, nhận request từ frontend và proxy tới các service nội bộ. |
| `auth-service` | `8001` | Đăng nhập, đăng ký, xác thực, phân quyền. |
| `user-service` | `8002` | Quản lý thông tin người dùng. |
| `product-service` | `8003` | Quản lý sản phẩm, danh mục, tìm kiếm sản phẩm. |
| `order-service` | `8004` | Quản lý đơn hàng. |
| `shop-service` | `8005` | Quản lý shop và thông tin người bán. |
| `payment-service` | `8006` | Xử lý thanh toán, tích hợp VNPay. |
| `chat-service` | `8010` | Chat realtime và WebSocket. |
| `upload-service` | `8011` | Upload file/ảnh, tích hợp Google Cloud Storage. |

## 3. Cấu trúc thư mục

```text
backend/
├── README.md
├── requirements.txt
├── Dockerfile
├── libs/
│   ├── middleware/
│   └── redis/
├── logs/
└── services/
    ├── gateway/
    ├── auth-service/
    ├── user-service/
    ├── product-service/
    ├── order-service/
    ├── shop-service/
    ├── payment-service/
    ├── chat-service/
    └── upload-service/
```

Trong mỗi service thường có cấu trúc:

```text
<service-name>/
├── main.py
├── Dockerfile
├── requirements.txt
├── .env.example
├── api/
├── core/
├── libs/
├── models/
├── schemas/
└── services/
```

## 4. Các thành phần dùng chung

### Redis

Redis được dùng cho:

- Cache dữ liệu.
- Quản lý trạng thái realtime.
- Pub/Sub giữa một số service.
- Hỗ trợ chat/WebSocket.

Các biến môi trường Redis thường dùng:

```env
REDIS_HOST=redis
REDIS_PORT=6379
```

### MongoDB

MongoDB là database chính. Mỗi service có thể dùng database riêng, ví dụ:

```env
AUTH_MONGO_DATABASE=auth_db
PRODUCT_MONGO_DATABASE=product_db
ORDER_MONGO_DATABASE=order_db
SHOP_MONGO_DATABASE=shop_db
PAYMENT_MONGO_DATABASE=payment_db
CHAT_MONGO_DATABASE=chat_db
UPLOAD_MONGO_DATABASE=upload_db
```

Khi chạy local bằng Docker Compose, MongoDB được khai báo trong `code/sunstack/docker-compose.yml`.

### Logging

Các service ghi log vào thư mục:

```text
/app/logs
```

Trên host, thư mục này được mount ra:

```text
code/sunstack/logs
```

Filebeat đọc log từ thư mục này và gửi về Logstash nếu `LOGSTASH_HOST` được cấu hình.

## 5. Chạy backend bằng Docker Compose

Khuyến nghị chạy backend thông qua Docker Compose ở thư mục `code/sunstack`, vì compose đã cấu hình đầy đủ frontend, backend service, MongoDB, Redis và Filebeat.

Từ thư mục gốc repository:

```bash
cd code/sunstack
docker compose up -d --build
```

Kiểm tra container:

```bash
docker compose ps
```

Xem log toàn hệ thống:

```bash
docker compose logs -f
```

Xem log một service cụ thể:

```bash
docker compose logs -f gateway
docker compose logs -f auth-service
docker compose logs -f product-service
```

## 6. Chạy production stack

Production dùng file:

```text
code/sunstack/docker-compose-prod.yml
```

Chạy production stack:

```bash
cd code/sunstack
docker compose -f docker-compose-prod.yml up -d --build
```

Kiểm tra trạng thái:

```bash
docker compose -f docker-compose-prod.yml ps
```

Trong môi trường cloud, file này thường được Ansible chạy trên app VM tại:

```text
/opt/btl/docker-compose-prod.yml
```

## 7. Chạy riêng một service để phát triển

Thông thường nên chạy bằng Docker Compose. Nếu cần debug riêng một service, có thể vào thư mục service đó và chạy FastAPI bằng `uvicorn`.

Ví dụ với `auth-service`:

```bash
cd code/sunstack/backend/services/auth-service
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Trước khi chạy riêng service, cần export các biến môi trường cần thiết, ví dụ:

```env
MONGO_URI=mongodb://localhost:27017
MONGO_DATABASE=auth_db
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=<your_jwt_secret>
INTERNAL_API_KEY=<your_internal_api_key>
```

Lưu ý: khi chạy ngoài Docker, các hostname nội bộ như `mongo`, `redis`, `auth-service` sẽ không tự resolve nếu không cấu hình thêm. Vì vậy local development thủ công cần chỉnh lại các URL sang `localhost` hoặc địa chỉ service tương ứng.

## 8. Gateway và routing

Frontend gọi API thông qua Gateway tại:

```text
http://localhost:8000
```

Trong production, Nginx proxy các request `/api/*`, `/oauth2/*`, `/login/oauth2/*`, `/ws` về Gateway:

```text
127.0.0.1:8000
```

Gateway sau đó gọi các service nội bộ bằng các biến môi trường:

```env
AUTH_SERVICE_URL=http://auth-service:8001
USER_SERVICE_URL=http://user-service:8002
PRODUCT_SERVICE_URL=http://product-service:8003
ORDER_SERVICE_URL=http://order-service:8004
SHOP_SERVICE_URL=http://shop-service:8005
PAYMENT_SERVICE_URL=http://payment-service:8006
CHAT_SERVICE_URL=http://chat-service:8010
UPLOAD_SERVICE_URL=http://upload-service:8011
```

## 9. Upload ảnh

`upload-service` xử lý upload ảnh. Trong môi trường production, service này có thể upload lên Google Cloud Storage.

Các biến môi trường quan trọng:

```env
GCS_BUCKET_NAME=<your_gcs_bucket_name>
GCS_PROJECT_ID=<your_gcp_project_id>
GCS_CREDENTIALS_FILE=./secrets/gcs-key.json
```

Hướng dẫn chi tiết nằm tại:

```text
../GCS_UPLOAD_SETUP.md
```

## 10. Ghi chú về Dockerfile gốc

File `backend/Dockerfile` ở thư mục này không phải Dockerfile chính đang được Docker Compose dùng cho từng microservice. Các service hiện tại dùng Dockerfile riêng tại:

```text
backend/services/<service-name>/Dockerfile
```

Vì vậy khi build/chạy hệ thống, hãy ưu tiên dùng:

```text
code/sunstack/docker-compose.yml
code/sunstack/docker-compose-prod.yml
```

## 11. Troubleshooting

Kiểm tra Redis:

```bash
docker exec redis redis-cli ping
```

Kiểm tra MongoDB:

```bash
docker compose ps mongo
docker compose logs -f mongo
```

Kiểm tra health của service:

```bash
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:8003/health
```

Nếu service không kết nối được MongoDB hoặc Redis:

- Kiểm tra file `.env` ở `code/sunstack`.
- Kiểm tra `MONGO_URI`.
- Kiểm tra `REDIS_HOST` và `REDIS_PORT`.
- Kiểm tra các container có cùng network `sunstack_network`.

Nếu Gateway không gọi được service:

- Kiểm tra biến `*_SERVICE_URL`.
- Kiểm tra container service đã healthy hay chưa.
- Xem log của `gateway` và service đích.
