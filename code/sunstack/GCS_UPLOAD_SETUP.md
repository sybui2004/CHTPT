# Hướng dẫn cấu hình upload ảnh lên Google Cloud Storage

Backend có endpoint upload `/api/v1/upload/image` dùng Google Cloud Storage. 

Bucket đã được tạo bằng Terraform được hướng dẫn trong thư mục `code/sunstack/iac/terraform/README.md`:

```text
gs://shopbee-485000-tmdt-bucket-a1b7287e
```

Tên bucket cần điền vào biến môi trường:

```text
shopbee-485000-tmdt-bucket-a1b7287e
```

## 1. Kiểm tra bucket

Trên máy có `gcloud`/`gsutil`, kiểm tra bucket có tồn tại hay không:

```bash
gsutil ls gs://shopbee-485000-tmdt-bucket-a1b7287e
```

Kiểm tra quyền IAM của bucket:

```bash
gcloud storage buckets get-iam-policy gs://shopbee-485000-tmdt-bucket-a1b7287e
```

## 2. Cấp quyền ghi cho backend

Backend cần quyền ghi object vào bucket. Có 2 cách cấu hình:

### Cách A: Dùng service account của VM

Nếu backend chạy trên GCE VM và VM có service account, hãy gán quyền ghi bucket cho service account đó:

```bash
gcloud storage buckets add-iam-policy-binding gs://shopbee-485000-tmdt-bucket-a1b7287e \
  --member=serviceAccount:YOUR_VM_SERVICE_ACCOUNT \
  --role=roles/storage.objectAdmin
```

### Cách B: Dùng service account key

Đặt key trên server:

```bash
cd /opt/sunstack
mkdir -p secrets
cp /path/to/gcs-key.json secrets/gcs-key.json
```

Docker Compose đã mount sẵn thư mục `./secrets` vào `/app/secrets` trong container backend, nên đường dẫn trong container là:

```env
GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/gcs-key.json
```

## 3. Cho phép browser đọc ảnh

Nếu bucket được bật public read, ảnh sẽ hiển thị trực tiếp bằng URL dạng `https://storage.googleapis.com/...`.

Cấp quyền public read cho object trong bucket:

```bash
gcloud storage buckets add-iam-policy-binding gs://shopbee-485000-tmdt-bucket-a1b7287e \
  --member=allUsers \
  --role=roles/storage.objectViewer
```

Nếu bucket không public, upload vẫn thành công nhưng browser sẽ không xem được ảnh bằng public URL. Khi đó cần dùng signed URL hoặc CDN có cơ chế xác thực riêng.

## 4. Cấu hình env trên server

Mở file env backend trên server:

```bash
cd /opt/sunstack
nano backend/src/main/resources/.env
```

Thêm hoặc sửa các biến sau:

```env
GCS_BUCKET_NAME=shopbee-485000-tmdt-bucket-a1b7287e
GCS_PUBLIC_BASE_URL=https://storage.googleapis.com
```

Nếu dùng service account key, thêm:

```env
GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/gcs-key.json
```

## 5. Chạy local bằng Docker Compose

Khi chạy local bằng Docker Compose, backend container không tự dùng được phiên đăng nhập `gcloud auth` trên máy host. Cần đặt service account key vào thư mục `secrets` của project:

```bash
cd /home/sy/Documents/PTIT/BTL
mkdir -p secrets
cp /path/to/gcs-key.json secrets/gcs-key.json
```

Thêm vào file `backend/src/main/resources/.env`:

```env
GCS_BUCKET_NAME=shopbee-485000-tmdt-bucket-a1b7287e
GCS_PUBLIC_BASE_URL=https://storage.googleapis.com
GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/gcs-key.json
```

Khởi động lại backend:

```bash
docker compose up -d --build back-end
docker compose logs -f back-end
```

Kiểm tra biến môi trường trong container:

```bash
docker compose exec back-end printenv | grep -E 'GCS|GOOGLE_APPLICATION_CREDENTIALS'
```

## 6. Deploy lại backend

```bash
cd /opt/sunstack
docker compose -f docker-compose-prod.yml up -d --build back-end
docker compose -f docker-compose-prod.yml logs -f back-end
```

## 7. Test nhanh

Đăng nhập web và upload ảnh sản phẩm/avatar. URL trả về sẽ có dạng:

```text
https://storage.googleapis.com/shopbee-485000-tmdt-bucket-a1b7287e/uploads/images/2026/05/<uuid>.jpg
```

Có thể test URL bằng:

```bash
curl -I "https://storage.googleapis.com/shopbee-485000-tmdt-bucket-a1b7287e/uploads/images/2026/05/<uuid>.jpg"
```

## 8. Ảnh seed demo

Script seed demo không còn dùng ảnh Unsplash trực tiếp. Các URL ảnh được lưu vào Mongo theo prefix GCS:

```text
https://storage.googleapis.com/shopbee-485000-tmdt-bucket-a1b7287e/seed/demo
```

Có thể đổi prefix bằng biến môi trường:

```env
DEMO_IMAGE_BASE_URL=https://storage.googleapis.com/<bucket>/seed/demo
```

Cần upload các object seed vào bucket theo các thư mục:

```text
seed/demo/shops/*.jpg
seed/demo/products/*.jpg
```

Tải ảnh seed từ Unsplash về local:

```bash
cd /home/sy/Documents/PTIT/BTL
node databases/seed_assets/download_seed_images.js
```

Upload ảnh seed lên GCS:

```bash
cd /home/sy/Documents/PTIT/BTL
GCS_BUCKET_NAME=shopbee-485000-tmdt-bucket-a1b7287e ./scripts/upload_seed_images_to_gcs.sh
```

Nếu dùng service account key trên local:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/home/sy/Documents/PTIT/BTL/secrets/gcs-key.json
```

Kiểm tra nhanh một file sau khi upload:

```bash
curl -I "https://storage.googleapis.com/shopbee-485000-tmdt-bucket-a1b7287e/seed/demo/products/ao-thun-cotton-basic-1.jpg"
```

Sau đó chạy lại seed Mongo để database lưu URL GCS:

```bash
docker compose up -d --build mongo_import
```

Prod:

```bash
docker compose -f docker-compose-prod.yml up -d --build mongo_import_prod
```

## Lỗi thường gặp

- `GCS_BUCKET_NAME` phải là tên bucket, không có prefix `gs://`.
- Nếu backend báo lỗi upload, kiểm tra service account/key đã có role `roles/storage.objectAdmin` hay chưa.
- Nếu upload thành công nhưng web không hiển thị ảnh, kiểm tra bucket/object đã có public read `roles/storage.objectViewer` cho `allUsers` hay chưa.
- Nếu dùng key, kiểm tra file `secrets/gcs-key.json` có tồn tại trên server và env đã có `GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/gcs-key.json`.
- Nếu chạy local bằng Docker mà không có `GOOGLE_APPLICATION_CREDENTIALS`, thường sẽ gặp lỗi `Cannot upload image to GCS`.
