# SunStack

SunStack là website thương mại điện tử theo mô hình C2C (Customer-to-Customer), nơi một người dùng có thể vừa là người mua vừa là người bán. Dự án được triển khai theo kiến trúc microservices, gồm frontend, gateway, các backend service, database, cache, search và Filebeat để gửi log sang hệ thống ELK tập trung.

## 1. Yêu cầu về môi trường

### Môi trường local

Cần cài đặt các công cụ sau:

- Docker.
- Docker Compose v2.
- Node.js và npm nếu muốn chạy script seed dữ liệu trực tiếp ngoài Docker.
- `gcloud`/`gsutil` nếu cần kiểm tra hoặc cấu hình Google Cloud Storage.

Khuyến nghị cấu hình máy:

- RAM tối thiểu 8 GB.
- Còn trống ít nhất 10 GB dung lượng ổ đĩa.
- Hệ điều hành Linux hoặc môi trường có hỗ trợ Docker ổn định.

### Môi trường cloud

Khi triển khai lên GCP, cần chuẩn bị:

- Tài khoản Google Cloud Platform.
- Project GCP đã được cấu hình billing.
- `gcloud CLI`.
- Terraform.
- Ansible.
- SSH key để Ansible truy cập các VM.
- Domain nếu muốn trỏ về Load Balancer, ví dụ `sunstack.org`.
- ELK central VM nếu muốn gửi log từ các app VM về hệ thống giám sát tập trung.

## 2. Triển khai tại local

### Bước 1: Vào thư mục dự án

```bash
cd code/sunstack
```

### Bước 2: Cấu hình biến môi trường

Tạo file `.env` từ file mẫu:

```bash
cp .env.example .env
```

Mở file `.env` và kiểm tra các nhóm cấu hình chính:

- MongoDB database cho từng service.
- JWT/Auth.
- CORS.
- URL nội bộ giữa các service.
- VNPay nếu cần test thanh toán.
- Google Cloud Storage nếu cần upload ảnh.
- HOST_IP, LOGSTASH_HOST nếu muốn Filebeat gửi log sang ELK. (Dùng ipconfig)
- VNPAY Config cho thanh toán ([VNPAY](https://sandbox.vnpayment.vn/devreg/?utm_source=chatgpt.com))
- Mail username, password cho phần gửi mail confirm đăng ký, quên mật khẩu. (Tạo ở [đây]( https://myaccount.google.com/apppasswords?utm_source=chatgpt.com))
- Google client id và secret cho OAuth2. (Hướng dẫn ở [đây](https://www.youtube.com/watch?v=D8DMj2lQMwo))
Nếu muốn cấu hình upload ảnh lên Google Cloud Storage, đọc thêm file:

```text
GCS_UPLOAD_SETUP.md
```

### Bước 3: Khởi động toàn bộ stack local

Chạy Docker Compose tại thư mục `code/sunstack`:

```bash
docker compose up -d --build
```

Kiểm tra trạng thái container:

```bash
docker compose ps
```

Xem log khi cần debug:

```bash
docker compose logs -f
```

### Bước 4: Truy cập ứng dụng

Sau khi các container chạy thành công, truy cập frontend tại:

```text
http://localhost:5173
```

Gateway API chạy tại:

```text
http://localhost:8000
```

Đăng nhập bằng cách tạo tài khoản hoặc đăng nhập nhanh bằng tài khoản google và các account shop đã được tạo sẵn khi seed data được ghi trong file [Demo account shop](./Demo_account_shop.md).

### Bước 5: Seed dữ liệu demo

Có thể seed dữ liệu demo bằng Docker Compose:

```bash
docker compose build mongo_import
docker compose run --rm -e MONGO_URI="mongodb://root:root@mongo:27017/bdc?directConnection=true&authSource=bdc" mongo_import npm run seed:products
```

Script seed sẽ tạo các shop demo, danh mục và sản phẩm mẫu. Có thể chạy lại nhiều lần; dữ liệu sản phẩm demo cũ sẽ được xóa và tạo lại.

### Bước 6: Dừng hệ thống local

Dừng container:

```bash
docker compose down
```

Nếu muốn xóa cả volume dữ liệu local:

```bash
docker compose down -v
```

## 3. Triển khai lên cloud

Phần cloud của SunStack dùng GCP Compute Engine, Ansible để tạo/deploy app VM và Terraform để tạo HTTP Load Balancer phía trước các app VM.

Kiến trúc triển khai:

```text
User -> GCP HTTP Load Balancer -> btl-app-vm-1 -> Docker Compose app stack
                              -> btl-app-vm-2 -> Docker Compose app stack
```

Mỗi app VM chạy:

- Nginx port `80`.
- Frontend port `5173`.
- Gateway port `8000`.
- Các backend microservice.
- Redis.
- Filebeat gửi log về ELK qua `LOGSTASH_HOST`.

### Bước 1: Cài công cụ trên máy điều khiển

Cài dependency cho Ansible:

```bash
cd code/sunstack/iac/ansible
pip install -r requirements.txt
ansible-galaxy collection install -r requirements.yml
```

Đăng nhập GCP:

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project shopbee-485000
```

### Bước 2: Tạo app VM và Mongo VM bằng Ansible

Trong thư mục `code/sunstack/iac/ansible`, chạy:

```bash
ansible-playbook create_compute_instance.yaml
ansible-playbook create_mongo_instance.yaml
```

Playbook sẽ tạo các VM app, ví dụ:

```text
btl-app-vm-1
btl-app-vm-2
btl-mongo-vm
```

Sau khi tạo VM, cập nhật public IP của các VM vào file `inventory` trong nhóm `[btl_app]`.

Nếu đã có ELK central VM, cập nhật IP của ELK VM vào nhóm `[elk_central]` để Ansible cấu hình:

```env
LOGSTASH_HOST=<ELK_VM_IP>:5044
```

### Bước 3: Cấu hình biến môi trường cho từng node

Sửa lại file `.env_prod_node1.example` và `.env_prod_node2.example` rồi đổi tên lại thành `.env_prod_node1` và `.env_prod_node2`


### Bước 4: Deploy ứng dụng lên app VM

Trong thư mục `code/sunstack/iac/ansible`, chạy:

```bash
ansible-playbook -i inventory deploy.yaml
```

Playbook sẽ:

- Copy source code lên VM.
- Tạo thư mục dữ liệu và thư mục log.
- Cấu hình biến môi trường cho Filebeat.
- Cấu hình Nginx.
- Chạy stack bằng `docker-compose-prod.yml`.

Runtime trên VM:

```text
/opt/btl
├── docker-compose-prod.yml
├── elk/filebeat-app-vm.yml
└── logs/
```

Nginx trên mỗi app VM proxy request như sau:

```text
/               -> 127.0.0.1:5173
/api/*          -> 127.0.0.1:8000
/oauth2/*       -> 127.0.0.1:8000
/login/oauth2/* -> 127.0.0.1:8000
/ws             -> 127.0.0.1:8000
```

### Bước 5: Tạo Load Balancer bằng Terraform

Sau khi hai app VM đã chạy ổn định, tạo GCP HTTP Load Balancer:

```bash
cd code/sunstack/iac/terraform
terraform init
terraform plan
terraform apply
```

Lấy IP của Load Balancer:

```bash
terraform output btl_load_balancer_ip
```

Trỏ DNS domain về IP này:

```text
sunstack.org      A    <btl_load_balancer_ip>
www.sunstack.org  A    <btl_load_balancer_ip>
```

### Bước 6: Kiểm tra sau khi deploy

Kiểm tra trực tiếp trên từng app VM:

```bash
curl http://localhost/
curl http://localhost/api/
sudo systemctl status nginx
docker compose -f /opt/btl/docker-compose-prod.yml ps
```

Kiểm tra Load Balancer trong GCP Console:

```text
Network services -> Load balancing
```

Backend instance group cần có trạng thái `Healthy`.

### Bước 7: Cấu hình HTTPS

Terraform hiện tại tạo HTTP Load Balancer trên port `80`. Không nên chạy Certbot riêng trên từng app VM vì ACME challenge có thể bị route sang VM khác.

Nên cấu hình HTTPS tại GCP Load Balancer bằng Google-managed certificate cho:

```text
sunstack.org
www.sunstack.org
```

## 4. Ghi chú thêm

- Thực hiện phần SunStack trước khi cấu hình ELK để hệ thống có log gửi về.
- Hướng dẫn cấu hình Google Cloud Storage nằm trong `GCS_UPLOAD_SETUP.md`.
- Tài khoản demo nằm trong `Demo_account_shop.md`.
