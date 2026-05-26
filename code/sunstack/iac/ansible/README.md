# Triển khai SunStack bằng Ansible

Thư mục `code/sunstack/iac/ansible` dùng Ansible để tạo và triển khai các VM chạy SunStack trên Google Cloud Platform.

Hệ thống cloud gồm các thành phần chính:

- Hai app VM chạy SunStack sau Load Balancer:
  - `btl-app-vm-1`
  - `btl-app-vm-2`
- Một MongoDB VM dùng chung:
  - `btl-mongo-vm`
- Một ELK central VM để nhận log từ Filebeat:
  - Elasticsearch
  - Logstash
  - Kibana

Phần ELK central được quản lý riêng tại:

```text
code/elk/iac/ansible
```

## 1. Yêu cầu trước khi chạy

Cần chuẩn bị trên máy điều khiển:

- Python 3.
- `pip`.
- Ansible.
- Google Cloud CLI.
- SSH key để truy cập VM.
- Service account key có quyền tạo và quản lý Compute Engine.

Cài dependency cho Ansible:

```bash
pip install -r requirements.txt
ansible-galaxy collection install -r requirements.yml
```

Đăng nhập GCP:

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project shopbee-485000
```

## 2. Cấu trúc file quan trọng

```text
code/sunstack/iac/ansible/
├── README.md
├── inventory
├── requirements.txt
├── requirements.yml
├── create_compute_instance.yaml
├── create_mongo_instance.yaml
├── deploy.yaml
├── deploy_mongo.yaml
└── secrets/
```

Ý nghĩa các file:

- `create_compute_instance.yaml`: tạo hai VM chạy app SunStack.
- `create_mongo_instance.yaml`: tạo VM MongoDB dùng chung.
- `deploy.yaml`: cài Docker, Nginx, copy source code và chạy SunStack trên app VM.
- `deploy_mongo.yaml`: cài Docker, chạy MongoDB, import database và seed dữ liệu.
- `inventory`: khai báo IP, user SSH và SSH key của các VM.
- `secrets/`: chứa service account key dùng để gọi API GCP.

## 3. Lưu ý quan trọng trước khi tạo VM

Trong các playbook tạo VM, cần kiểm tra trường `state` trước khi chạy:

```yaml
state: present
```

Nếu `state: absent`, Ansible sẽ xóa tài nguyên thay vì tạo tài nguyên. Vì vậy, trước khi chạy các playbook tạo VM, hãy mở và kiểm tra:

```text
create_compute_instance.yaml
create_mongo_instance.yaml
```

## 4. Tạo app VM

Playbook `create_compute_instance.yaml` dùng để tạo hai VM:

```text
btl-app-vm-1
btl-app-vm-2
```

Chạy lệnh:

```bash
ansible-playbook create_compute_instance.yaml
```

Sau khi VM được tạo, lấy public IP của từng VM trên GCP Console hoặc bằng `gcloud`, rồi cập nhật vào nhóm `[btl_app]` trong file `inventory`.

Ví dụ:

```ini
[btl_app]
<app_vm_1_public_ip> ansible_user=<your_ssh_user> ansible_ssh_private_key_file=<path_to_private_key>
<app_vm_2_public_ip> ansible_user=<your_ssh_user> ansible_ssh_private_key_file=<path_to_private_key>
```

## 5. Tạo MongoDB VM

Playbook `create_mongo_instance.yaml` dùng để tạo VM MongoDB dùng chung:

```text
btl-mongo-vm
```

Chạy lệnh:

```bash
ansible-playbook create_mongo_instance.yaml
```

Sau khi VM được tạo, cập nhật public IP của MongoDB VM vào nhóm `[btl_mongo]` trong file `inventory`.

Ví dụ:

```ini
[btl_mongo]
<mongo_vm_public_ip> ansible_user=<your_ssh_user> ansible_ssh_private_key_file=<path_to_private_key>
```

## 6. Khai báo ELK central VM

Nếu đã triển khai ELK central, cập nhật IP của ELK VM vào nhóm `[elk_central]` trong file `inventory`.

Ví dụ:

```ini
[elk_central]
<elk_vm_public_ip> ansible_user=<your_ssh_user> ansible_ssh_private_key_file=<path_to_private_key>
```

`deploy.yaml` sẽ dùng IP này để ghi biến sau vào file `.env` trên từng app VM:

```env
LOGSTASH_HOST=<elk_vm_public_ip>:5044
```

Filebeat trên app VM sẽ đọc log trong thư mục `logs/` và gửi về Logstash qua port `5044`.

## 7. Cấu hình SSH metadata nếu cần

Nếu VM chưa nhận SSH key, có thể thêm SSH key bằng `gcloud`:

```bash
gcloud compute instances add-metadata <vm_name> \
  --zone=asia-southeast1-b \
  --metadata ssh-keys="<your_ssh_user>:<your_public_ssh_key>"
```

Thực hiện tương tự cho các VM cần truy cập:

```text
btl-app-vm-1
btl-app-vm-2
btl-mongo-vm
btl-elk-central-vm
```

## 8. Triển khai MongoDB VM

Sau khi đã cập nhật nhóm `[btl_mongo]` và `[btl_app]` trong `inventory`, chạy:

```bash
ansible-playbook -i inventory deploy_mongo.yaml
```

Playbook này sẽ:

- Cài Docker và Docker Compose plugin.
- Tạo thư mục `/opt/btl-mongo`.
- Tạo thư mục dữ liệu MongoDB.
- Copy project import database lên VM.
- Chạy MongoDB bằng Docker Compose.
- Chạy job import database.
- Chạy job seed dữ liệu demo.
- Cấu hình UFW chỉ cho phép app VM truy cập MongoDB port `27017`.

Runtime trên MongoDB VM:

```text
/opt/btl-mongo
├── docker-compose.yml
├── data/
└── mongo_import_prod/
```

## 9. Triển khai app VM

Sau khi MongoDB VM đã chạy ổn định, deploy SunStack lên hai app VM:

```bash
ansible-playbook -i inventory deploy.yaml
```

Playbook này sẽ:

- Cài các package hệ thống cần thiết.
- Cài Docker Engine và Docker Compose plugin.
- Cài Nginx.
- Copy source code SunStack lên `/opt/btl`.
- Tạo thư mục log và Redis data.
- Chọn file `.env_prod_node1` hoặc `.env_prod_node2` theo thứ tự VM trong `inventory`.
- Ghi lại `LOGSTASH_HOST` theo nhóm `[elk_central]`.
- Ghi lại `MONGO_URI` theo nhóm `[btl_mongo]`.
- Cấu hình UFW cho các port `22`, `80`, `443`.
- Cấu hình Nginx reverse proxy.
- Build và chạy stack bằng `docker-compose-prod.yml`.

Runtime trên app VM:

```text
/opt/btl
├── docker-compose-prod.yml
├── .env
├── elk/filebeat-app-vm.yml
└── logs/
```

## 10. Nginx reverse proxy

Nginx trên mỗi app VM lắng nghe port `80` và proxy request như sau:

```text
/               -> 127.0.0.1:5173
/api/*          -> 127.0.0.1:8000
/oauth2/*       -> 127.0.0.1:8000
/login/oauth2/* -> 127.0.0.1:8000
/ws             -> 127.0.0.1:8000
/actuator/*     -> 127.0.0.1:8000
/chatbot/*      -> 127.0.0.1:8000
```

HTTPS không cấu hình trực tiếp trên từng app VM. TLS nên được terminate tại GCP Load Balancer bằng Google-managed certificate.

## 11. Kiểm tra sau khi deploy

SSH vào từng app VM và kiểm tra:

```bash
sudo systemctl status nginx
docker compose -f /opt/btl/docker-compose-prod.yml ps
curl http://localhost/
curl http://localhost/api/
```

Kiểm tra log:

```bash
docker compose -f /opt/btl/docker-compose-prod.yml logs -f gateway
docker compose -f /opt/btl/docker-compose-prod.yml logs -f filebeat
```

SSH vào MongoDB VM và kiểm tra:

```bash
docker compose -f /opt/btl-mongo/docker-compose.yml ps
docker compose -f /opt/btl-mongo/docker-compose.yml logs -f mongo
```

## 12. Tạo Load Balancer sau khi deploy app

Sau khi hai app VM đã chạy ổn định, dùng Terraform để tạo Load Balancer:

```text
code/sunstack/iac/terraform-lb
```

Tham khảo hướng dẫn chi tiết trong:

```text
../terraform-lb/README.md
```

Domain như `sunstack.org` và `www.sunstack.org` nên trỏ về IP của Load Balancer, không trỏ trực tiếp về public IP của từng app VM.

## 13. Thứ tự triển khai đề xuất

Thực hiện theo thứ tự:

1. Triển khai ELK central nếu cần thu gom log.
2. Tạo MongoDB VM bằng `create_mongo_instance.yaml`.
3. Tạo app VM bằng `create_compute_instance.yaml`.
4. Cập nhật file `inventory`.
5. Deploy MongoDB bằng `deploy_mongo.yaml`.
6. Deploy app bằng `deploy.yaml`.
7. Tạo Load Balancer bằng Terraform trong `../terraform-lb`.
8. Trỏ DNS về IP của Load Balancer.

## 14. Troubleshooting

Nếu Ansible không SSH được vào VM:

- Kiểm tra public IP trong `inventory`.
- Kiểm tra `ansible_user`.
- Kiểm tra `ansible_ssh_private_key_file`.
- Kiểm tra SSH key đã được thêm vào metadata của VM.

Nếu app không kết nối được MongoDB:

- Kiểm tra nhóm `[btl_mongo]` trong `inventory`.
- Kiểm tra UFW trên MongoDB VM có cho phép IP của app VM.
- Kiểm tra `MONGO_URI` trong `/opt/btl/.env`.

Nếu không thấy log trong ELK:

- Kiểm tra nhóm `[elk_central]` trong `inventory`.
- Kiểm tra `LOGSTASH_HOST` trong `/opt/btl/.env`.
- Kiểm tra container `filebeat`.
- Kiểm tra Logstash port `5044` trên ELK VM.
