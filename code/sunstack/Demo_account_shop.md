# Tài khoản shop demo

## Shop

Để tiết kiệm thời gian demo thì các tài khoản shop được tạo và seed sẵn product.

Tất cả tài khoản shop dưới đây dùng chung password: `password`.

| Shop | Username | Password | Ghi chú |
| --- | --- | --- | --- |
| SunStack Demo Shop | `demo_shop` | `password` | Shop tổng hợp mặc định, có thể đổi username/name bằng biến môi trường `DEMO_SHOP_USERNAME`, `DEMO_SHOP_NAME`. |
| Style Corner | `style_corner` | `password` | Shop thời trang và phụ kiện. |
| Tech Hub | `tech_hub` | `password` | Shop phụ kiện công nghệ. |
| Home Living | `home_living` | `password` | Shop đồ gia dụng và decor. |

## Ghi chú seed data

- File seed local: `databases/mongo_import/seed_demo_products.js`.
- File seed prod: `databases/mongo_import_prod/seed_demo_products.js`.
- Seed hiện tạo 4 shop demo và 20 sản phẩm.
- Script có thể chạy lại nhiều lần: sản phẩm demo cũ sẽ bị xóa và tạo lại, tài khoản/shop demo sẽ được cập nhật theo seed.
