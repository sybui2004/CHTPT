# Khởi tạo Load Balancer cho SunStack

Thư mục `code/sunstack/iac/terraform-lb` dùng Terraform để khởi tạo GCP external HTTP(S) Load Balancer đứng trước các VM chạy SunStack.

Luồng request:

```text
sunstack.org -> GCP HTTP(S) Load Balancer -> btl-app-vm-1:80
                                           -> btl-app-vm-2:80
```

Các app VM cần được tạo và deploy trước bằng Ansible. Nginx trên mỗi VM lắng nghe port `80` và proxy request về các container local.

## 1. Thành phần được khởi tạo

Terraform trong thư mục này tạo các tài nguyên sau:

- Instance group chứa các VM app có sẵn.
- Named port `http` trỏ tới port `80`.
- HTTP health check tới path `/`.
- Backend service dùng protocol HTTP.
- URL map.
- Target HTTP proxy.
- Google-managed SSL certificate.
- Target HTTPS proxy.
- Global static IP cho Load Balancer.
- Forwarding rule port `80`.
- Forwarding rule port `443`.
- Firewall rule cho phép Google Load Balancer health check truy cập port `80` của app VM.

Output sau khi apply:

- `btl_load_balancer_ip`: IP public để trỏ DNS.
- `btl_managed_certificate_name`: tên Google-managed SSL certificate.

## 2. Yêu cầu trước khi chạy

Cần cài đặt:

- Terraform.
- Google Cloud CLI.
- Tài khoản GCP có quyền tạo Load Balancer, firewall, instance group và certificate.

Cần có sẵn các VM app:

```text
btl-app-vm-1
btl-app-vm-2
```

Mỗi VM cần:

- Đã deploy SunStack bằng `docker-compose-prod.yml`.
- Nginx đang chạy trên port `80`.
- Route `/` trả về frontend.
- Route `/api/*` proxy về gateway.

## 3. Đăng nhập GCP

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project shopbee-485000
```

## 4. Kiểm tra biến cấu hình

Mở file `variables.tf` và kiểm tra:

```hcl
project_id = "shopbee-485000"
region     = "asia-southeast1"
zone       = "asia-southeast1-b"
```

Danh sách VM đưa vào Load Balancer:

```hcl
btl_instance_names = ["btl-app-vm-1", "btl-app-vm-2"]
```

Domain dùng cho Google-managed SSL certificate:

```hcl
btl_domain_names = ["sunstack.org", "www.sunstack.org"]
```

Nếu tên VM, zone hoặc domain khác, sửa lại trước khi chạy Terraform.

## 5. Kiểm tra app VM trước khi tạo Load Balancer

SSH vào từng app VM và kiểm tra:

```bash
curl http://localhost/
curl http://localhost/api/
sudo systemctl status nginx
docker compose -f /opt/btl/docker-compose-prod.yml ps
```

Nếu các lệnh trên chưa ổn định, cần sửa app VM trước rồi mới tạo Load Balancer.

## 6. Khởi tạo Load Balancer

Chạy trong thư mục `code/sunstack/iac/terraform-lb`:

```bash
cd code/sunstack/iac/terraform-lb
terraform init
terraform plan
terraform apply
```

Nhập `yes` khi Terraform yêu cầu xác nhận.

## 7. Lấy IP Load Balancer

Sau khi apply xong, lấy IP public:

```bash
terraform output btl_load_balancer_ip
```

Kiểm tra certificate được tạo:

```bash
terraform output btl_managed_certificate_name
```

## 8. Trỏ DNS về Load Balancer

Vào trang quản lý DNS của domain và tạo hoặc sửa A record:

```text
sunstack.org      A    <btl_load_balancer_ip>
www.sunstack.org  A    <btl_load_balancer_ip>
```

Không trỏ domain trực tiếp về public IP của từng VM app. Domain cần trỏ về IP của Load Balancer.

## 9. Kiểm tra trên GCP Console

Vào:

```text
Network services -> Load balancing
```

Mở Load Balancer vừa tạo và kiểm tra:

- Backend instance group có đủ các VM app.
- Health check trả về trạng thái `Healthy`.
- Forwarding rule port `80` hoạt động.
- Forwarding rule port `443` hoạt động.
- Managed certificate chuyển sang trạng thái `Active`.

Lưu ý: Google-managed certificate có thể cần một khoảng thời gian để được cấp sau khi DNS đã trỏ đúng về Load Balancer.

## 10. Kiểm tra truy cập

Kiểm tra HTTP:

```bash
curl -I http://sunstack.org
```

Kiểm tra HTTPS sau khi certificate đã active:

```bash
curl -I https://sunstack.org
```

## 11. Troubleshooting

Nếu backend bị `Unhealthy`, kiểm tra trên từng app VM:

```bash
curl http://localhost/
sudo systemctl status nginx
docker compose -f /opt/btl/docker-compose-prod.yml ps
```

Nếu HTTPS chưa hoạt động:

- Kiểm tra DNS đã trỏ đúng về `btl_load_balancer_ip`.
- Chờ Google-managed certificate chuyển sang `Active`.
- Kiểm tra domain trong `btl_domain_names`.

Nếu không truy cập được app:

- Kiểm tra firewall rule `allow-gcp-lb-to-btl-http`.
- Kiểm tra Nginx trên VM có lắng nghe port `80`.
- Kiểm tra health check path `/` có trả về response hợp lệ.

## 12. Xóa Load Balancer

Nếu muốn xóa toàn bộ tài nguyên Load Balancer do Terraform tạo:

```bash
terraform destroy
```
