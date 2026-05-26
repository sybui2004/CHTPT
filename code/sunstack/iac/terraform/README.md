# Khởi tạo Google Cloud Storage cho SunStack

Thư mục `code/sunstack/iac/terraform` dùng Terraform để khởi tạo bucket Google Cloud Storage phục vụ upload và lưu trữ ảnh cho SunStack.

Bucket được tạo theo dạng tên:

```text
<project_id>-tmdt-bucket-<random_suffix>
```

Ví dụ:

```text
shopbee-485000-tmdt-bucket-a1b7287e
```

## 1. Thành phần được khởi tạo

Terraform trong thư mục này tạo các tài nguyên sau:

- Google Cloud Storage bucket.
- Hậu tố ngẫu nhiên bằng `random_id` để tránh trùng tên bucket.
- Uniform bucket-level access.
- Versioning cho object trong bucket.
- Lifecycle rule tự động xóa object sau 30 ngày.
- IAM public read cho object trong bucket bằng role `roles/storage.objectViewer` với member `allUsers`.

Bucket này được backend dùng cho chức năng upload ảnh sản phẩm, avatar và ảnh seed demo.

## 2. Yêu cầu trước khi chạy

Cần cài đặt:

- Terraform.
- Google Cloud CLI.
- Tài khoản GCP có quyền tạo bucket và cấu hình IAM.

Đăng nhập GCP:

```bash
gcloud auth login
gcloud auth application-default login
```

Chọn đúng project của đồ án:

```bash
gcloud config set project shopbee-485000
```

## 3. Kiểm tra biến cấu hình

Mở file `variables.tf` và kiểm tra các biến chính:

```hcl
project_id = "shopbee-485000"
region     = "asia-southeast1"
```

Nếu dùng project hoặc region khác, sửa lại trước khi chạy Terraform.

## 4. Khởi tạo bucket GCS

Chạy trong thư mục `code/sunstack/iac/terraform`:

```bash
cd code/sunstack/iac/terraform
terraform init
terraform plan
terraform apply
```

Nhập `yes` khi Terraform yêu cầu xác nhận.

## 5. Lấy tên bucket sau khi tạo

Do bucket có hậu tố ngẫu nhiên, có thể kiểm tra bucket đã tạo bằng lệnh:

```bash
gcloud storage buckets list --project shopbee-485000
```

Hoặc xem trực tiếp trong Terraform state:

```bash
terraform state show google_storage_bucket.my_bucket
```

Tên bucket cần dùng trong file `.env` của SunStack là phần không có prefix `gs://`.

Ví dụ:

```env
GCS_BUCKET_NAME=shopbee-485000-tmdt-bucket-a1b7287e
GCS_PUBLIC_BASE_URL=https://storage.googleapis.com
```

## 6. Kiểm tra bucket

Kiểm tra bucket có tồn tại:

```bash
gsutil ls gs://shopbee-485000-tmdt-bucket-a1b7287e
```

Kiểm tra IAM policy:

```bash
gcloud storage buckets get-iam-policy gs://shopbee-485000-tmdt-bucket-a1b7287e
```

## 7. Cấu hình backend dùng bucket

Sau khi có tên bucket, cấu hình trong file `.env` của SunStack:

```env
GCS_BUCKET_NAME=<ten-bucket-vua-tao>
GCS_PUBLIC_BASE_URL=https://storage.googleapis.com
```

Nếu backend dùng service account key, cấu hình thêm:

```env
GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/gcs-key.json
```

Hướng dẫn chi tiết cho backend upload ảnh nằm ở:

```text
../../GCS_UPLOAD_SETUP.md
```

## 8. Xóa bucket khi không dùng nữa

Nếu muốn xóa tài nguyên do Terraform tạo:

```bash
terraform destroy
```

Lưu ý: trong `main.tf`, bucket đang bật `force_destroy = true`, nên khi destroy Terraform có thể xóa cả object bên trong bucket.
