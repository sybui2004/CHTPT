# Mongo Architecture Snapshot From Mongo Express

Snapshot source: `http://localhost:8081/`, Basic Auth `root / root`.

This file describes the MongoDB data that is actually visible in the running Mongo Express instance, not the ideal service design. Use this as memory/context for AI debugging.

## Mongo Express Databases

Visible databases:

| Database | Type | Notes |
|---|---|---|
| `admin` | system/auth | Mongo internal users/keys/version |
| `auth_db` | app | users, roles, addresses, follows, address catalog |
| `chat_db` | app | conversations, messages |
| `config` | system | Mongo replica/session internals |
| `local` | system | replica set internals/oplog |
| `order_db` | app | carts, wallets |
| `product_db` | app | products, SKUs, media |
| `shop_db` | app | shops, shop settings, address catalog |

Important: in the current DB there is no visible `voucher_db`, `review_db`, `notification_db`, `payment_db`, or `complaint_db` in Mongo Express.

## Main ID Relationships

```text
auth_db.users._id
  -> shop_db.shops.user
  -> auth_db.user_addresses.user_id
  -> auth_db.follows.user_id
  -> order_db.carts.user_id
  -> order_db.wallets.user_id
  -> chat_db.conversations.participants[]
  -> chat_db.messages.sender_id

shop_db.shops._id
  -> product_db.products.shop
  -> shop_db.shop_settings.shop_id
  -> auth_db.follows.shop_id

product_db.products._id
  -> product_db.product_skus.product
  -> order_db.carts.items[].product_id

product_db.product_skus._id
  -> product_db.products.skuList[]
  -> order_db.carts.items[].item_id, when cart item is a SKU

product_db.product_media._id
  -> product_db.products.mediaList[]
```

## `auth_db`

Collections shown by Mongo Express:

```text
districts
follows
provinces
roles
user_addresses
users
wards
```

### `auth_db.users`

Sample count from export: 5.

Fields actually present:

| Field | Type(s) | Example/meaning |
|---|---|---|
| `_id` | ObjectId | user id |
| `fullName` | string | seed user display name |
| `full_name` | string | OAuth/profile display name |
| `username` | string | login username |
| `password` | string | bcrypt hash |
| `email` | string | email |
| `phoneNumber` | string | seed phone |
| `avatarUrl` | string | avatar image |
| `gender` | string | seed gender |
| `createdAt` | Date | seed creation time |
| `created_at` | Date | service/OAuth creation time |
| `updated_at` | Date | service update time |
| `role` | ObjectId | points to `roles._id` |
| `roles` | string[] | e.g. `["user"]` |
| `fromSocial` | boolean | OAuth marker |
| `provider` | string | e.g. `google` |
| `provider_id` | string | OAuth provider id |
| `emailVerified` | boolean | email status |
| `locked` | boolean | lock flag |
| `deleted` | boolean | soft-delete flag |
| `demoSeed` | boolean | seed marker |

Demo shop users currently visible:

| username | `_id` | owns shop |
|---|---|---|
| `demo_shop` | `6a11847def42433d746905b3` | SunStack Demo Shop |
| `style_corner` | `6a11847def42433d74690655` | Style Corner |
| `tech_hub` | `6a11847def42433d746906fc` | Tech Hub |
| `home_living` | `6a11847def42433d7469078b` | Home Living |

There is also a non-seed/OAuth user in this DB, visible through mixed fields such as `full_name`, `provider`, `provider_id`, `created_at`, `updated_at`.

### `auth_db.roles`

Sample count: 1.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | role id |
| `name` | string | currently `USER` |
| `description` | string | role description |

### `auth_db.user_addresses`

Sample count: 1.

Fields actually present:

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | address id |
| `user_id` | string | references `auth_db.users._id` |
| `receiverName` | string | frontend-style receiver name |
| `full_name` | string | backend-normalized receiver name |
| `phoneNumber` | string | frontend-style phone |
| `phone` | string | backend-normalized phone |
| `detail` | string | frontend-style address detail |
| `address` | string | backend-normalized detail |
| `province` | string | province name |
| `district` | string | district name |
| `ward` | string | ward name |
| `province_name` | string | normalized province name |
| `district_name` | string | normalized district name |
| `ward_name` | string | normalized ward name |
| `primary` | boolean | frontend default flag |
| `is_default` | boolean | backend default flag |
| `created_at` | Date | create time |
| `updated_at` | Date | update time |

### `auth_db.follows`

Sample count: 1.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | follow id |
| `user_id` | string | user who follows |
| `shop_id` | string | followed shop id |
| `created_at` | Date | follow time |

Current sample follow:

```text
user_id = 6a12c5480b964fb81940ef42
shop_id = 6a11847def42433d74690656
```

### `auth_db.provinces`

Sample count: 63.

| Field | Type | Notes |
|---|---|---|
| `_id` | int | province code |
| `name` | string | province/city name |

### `auth_db.districts`

Sample count: 696.

| Field | Type | Notes |
|---|---|---|
| `_id` | int | district code |
| `name` | string | district name |
| `provinceId` | int | references `provinces._id` |

### `auth_db.wards`

Sample count: 10051.

| Field | Type | Notes |
|---|---|---|
| `_id` | string | ward code |
| `name` | string | ward name |
| `districtId` | int | references `districts._id` |

## `shop_db`

Collections shown by Mongo Express:

```text
shop_settings
shops
```

### `shop_db.shops`

Sample count: 4.

This is the real source for shop identity in the current DB. Owner is stored as `user: ObjectId`, not `user_id`.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | shop id |
| `name` | string | shop display name |
| `description` | string | shop description |
| `avatarUrl` | string | shop avatar |
| `user` | ObjectId | references `auth_db.users._id` |
| `createdAt` | Date | create time |
| `productCount` | int | number of products |
| `revenue` | int | revenue total |
| `averageRating` | int | average rating |
| `totalReviews` | int | review count |
| `followerCount` | int | follower count |
| `deleted` | boolean | soft-delete flag |
| `demoSeed` | boolean | seed marker |

Current shops:

| Shop | `_id` | `user` owner id | `productCount` |
|---|---|---|---|
| SunStack Demo Shop | `6a11847def42433d746905b4` | `6a11847def42433d746905b3` | 20 |
| Style Corner | `6a11847def42433d74690656` | `6a11847def42433d74690655` | 20 |
| Tech Hub | `6a11847def42433d746906fd` | `6a11847def42433d746906fc` | 20 |
| Home Living | `6a11847def42433d7469078c` | `6a11847def42433d7469078b` | 20 |

### `shop_db.shop_settings`

Sample count: 1.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | setting id |
| `shop_id` | string | references `shop_db.shops._id` as string |
| `lowStockThreshold` | int | inventory warning threshold |
| `updated_at` | Date | update time |

Current sample:

```text
shop_id = 6a11847def42433d746905b4
lowStockThreshold = 100
```

### `shop_db.provinces`, `shop_db.districts`, `shop_db.wards`

Address catalog duplicated from `auth_db`.

| Collection | Count | Fields |
|---|---:|---|
| `provinces` | 63 | `_id` int, `name` string |
| `districts` | 696 | `_id` int, `name` string, `provinceId` int |
| `wards` | 10051 | `_id` string, `name` string, `districtId` int |

## `product_db`

Collections shown by Mongo Express:

```text
product_media
product_skus
products
```

### `product_db.products`

Sample count: 80.

This is the real product source for the current DB. Shop reference is stored as `shop: ObjectId`, not `shop_id`.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | product id |
| `name` | string | product name |
| `shop` | ObjectId | references `shop_db.shops._id` |
| `description` | string | product description |
| `thumbnailUrl` | string | main image |
| `price` | int | minimum/base price |
| `quantity` | int | total stock |
| `weight` | int | shipping weight in grams |
| `skuList` | ObjectId[] | references `product_db.product_skus._id` |
| `mediaList` | ObjectId[] | references `product_db.product_media._id` |
| `revenue` | int | revenue counter |
| `sold` | int | sold counter |
| `averageRating` | int | average rating |
| `totalReviews` | int | review count |
| `location` | string | shop/product location |
| `visible` | boolean | visible to buyers |
| `createdAt` | Date | create time |
| `updatedAt` | Date | update time |
| `restricted` | boolean | moderation flag |
| `restrictStatus` | string | normal value is `OPENED` |
| `deleted` | boolean | soft-delete flag |
| `demoSeed` | boolean | seed marker |

Current distribution:

```text
4 shops x 20 products = 80 products
```

Example product relationship:

```text
product: Ao thun cotton basic
product _id: 6a1324f2f0f8ce8c5d97628e
shop: 6a11847def42433d746905b4
skuList: [6a1324f2f0f8ce8c5d976291, ...]
mediaList: [6a1324f2f0f8ce8c5d97628f, ...]
```

### `product_db.product_skus`

Sample count: 165.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | SKU id |
| `product` | ObjectId | references `product_db.products._id` |
| `sku` | string | SKU code, e.g. `DEMO-01-01-01` |
| `price` | int | SKU price |
| `quantity` | int | SKU stock |
| `attributes` | object[] | variant attributes |
| `demoSeed` | boolean | seed marker |

`attributes[]` shape:

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | attribute row id |
| `name` | string | e.g. `Mau`, `Size` |
| `value` | string | e.g. `Trang`, `M` |

### `product_db.product_media`

Sample count: 160.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | media id |
| `url` | string | image URL |
| `type` | string | currently `IMAGE` |
| `demoSeed` | boolean | seed marker |

## `order_db`

Collections shown by Mongo Express:

```text
carts
wallets
```

There are no `orders` documents/collection visible in the current Mongo Express `order_db` snapshot.

### `order_db.carts`

Sample count: 1.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | cart id |
| `user_id` | string | references `auth_db.users._id` |
| `items` | object[] | cart item snapshots |
| `updated_at` | Date | update time |

`items[]` shape currently visible:

| Field | Type | Notes |
|---|---|---|
| `item_id` | string | selected SKU/cart item id |
| `product_id` | string | references product id |
| `name` | string | product snapshot |
| `thumbnailUrl` | string | image snapshot |
| `price` | int | selected price |
| `quantity` | int | cart quantity |
| `attributes` | object[] | selected variant attrs |
| `selected` | boolean | selected for checkout |
| `stock` | int | stock snapshot |
| `shop_id` | string | currently sample has `default`, which is not a real shop id |

Important current data issue:

```text
order_db.carts.items[].shop_id = "default" in the visible sample
```

That means cart/checkout grouping by shop may not resolve shop info unless this is corrected when cart items are added.

### `order_db.wallets`

Sample count: 1.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | wallet id |
| `user_id` | string | references `auth_db.users._id` |
| `balance` | int | balance |
| `available_balance` | int | available balance |
| `created_at` | Date | create time |

## `chat_db`

Collections shown by Mongo Express:

```text
conversations
messages
```

### `chat_db.conversations`

Sample count: 1.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | conversation id |
| `participants` | string[] | user/shop owner ids |
| `unread_count` | int | unread counter |
| `created_at` | Date | create time |
| `updated_at` | Date | update time |

Current sample participants:

```text
6a12c5480b964fb81940ef42
6a11847def42433d74690655
```

### `chat_db.messages`

Sample count: 14.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | message id |
| `conversation_id` | string | references `chat_db.conversations._id` |
| `content` | string | message text |
| `type` | string | currently `TEXT` |
| `sender_id` | string | sender user id |
| `created_at` | Date | send time |

## System Databases

### `admin`

Mongo internal collections visible:

```text
system.keys
system.users
system.version
```

Not part of app data. `system.users` contains the Mongo root user.

### `config`

Mongo internal collections visible:

```text
external_validation_keys
image_collection
system.indexBuilds
system.preimages
system.sessions
tenantMigrationDonors
tenantMigrationRecipients
transactions
```

Not part of app data.

### `local`

Mongo replica set internals visible:

```text
oplog.rs
replset.election
replset.initialSyncId
replset.minvalid
replset.oplogTruncateAfterPoint
startup_log
system.replset
system.rollback.id
system.tenantMigration.oplogView
system.views
```

Not part of app data.

## Correct Myshop Product Lookup For Current DB

For `/myshop/product-list`, the current DB requires this relationship:

```text
JWT sub
  = auth_db.users._id

shop_db.shops.findOne({ user: ObjectId(JWT sub) })
  -> shop_db.shops._id

product_db.products.find({ shop: ObjectId(shop_id), visible: true, deleted: false })
  -> product list

for each product:
  skuList ObjectIds -> product_db.product_skus
  mediaList ObjectIds -> product_db.product_media
```

If a user logs in with the OAuth/non-seed user `6a12c5480b964fb81940ef42`, that user does not own any shop in the visible `shop_db.shops`, so `/myshop/product-list` should be empty or return shop-not-found.

To see demo shop products, log in as a seed shop owner:

| Username | Password | Shop |
|---|---|---|
| `demo_shop` | `password` | SunStack Demo Shop |
| `style_corner` | `password` | Style Corner |
| `tech_hub` | `password` | Tech Hub |
| `home_living` | `password` | Home Living |

## Most Important Field Names In Current DB

Do not assume these alternate names exist in current Mongo data:

| Concept | Current field in DB |
|---|---|
| Shop owner | `shop_db.shops.user` as ObjectId |
| Product shop | `product_db.products.shop` as ObjectId || Product SKUs | `product_db.products.skuList` as ObjectId[] |
| Product media | `product_db.products.mediaList` as ObjectId[] |
| Product visible flag | `product_db.products.visible` |
| Product soft delete | `product_db.products.deleted` |
| Product restriction | `restricted`, `restrictStatus` || User address owner | `auth_db.user_addresses.user_id` as string |
| Follow relation | `auth_db.follows.user_id`, `auth_db.follows.shop_id` as strings |
