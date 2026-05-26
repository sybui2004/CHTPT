import mongoose from 'mongoose';

function uriForDatabase(baseUri, databaseName) {
    if (!baseUri || !databaseName) return null;

    const parsed = new URL(baseUri);
    parsed.pathname = `/${databaseName}`;
    return parsed.toString();
}

// Separate database URIs for proper data separation
const AUTH_DB_URI = process.env.AUTH_DB_URI || uriForDatabase(process.env.MONGO_URI, process.env.AUTH_MONGO_DATABASE || 'auth_db') || 'mongodb://root:root@mongo:27017/auth_db?directConnection=true&authSource=admin';
const SHOP_DB_URI = process.env.SHOP_DB_URI || uriForDatabase(process.env.MONGO_URI, process.env.SHOP_MONGO_DATABASE || 'shop_db') || 'mongodb://root:root@mongo:27017/shop_db?directConnection=true&authSource=admin';
const PRODUCT_DB_URI = process.env.PRODUCT_DB_URI || uriForDatabase(process.env.MONGO_URI, process.env.PRODUCT_MONGO_DATABASE || 'product_db') || 'mongodb://root:root@mongo:27017/product_db?directConnection=true&authSource=admin';

const DEMO_PASSWORD_HASH = '$2a$10$QLOl3C.qEZ0b9H/Tyj5YLuJP9Y74rRcKG0fnrkGb46ZftngNxOgWW'; // password: password
const DEFAULT_DEMO_IMAGE_BASE_URL = 'https://storage.googleapis.com/shopbee-485000-tmdt-bucket-a1b7287e/seed/demo';
const DEMO_IMAGE_BASE_URL = (process.env.DEMO_IMAGE_BASE_URL || DEFAULT_DEMO_IMAGE_BASE_URL).replace(/\/+$/, '');

const objectId = () => new mongoose.Types.ObjectId();
const now = () => new Date();
const demoImage = (path) => `${DEMO_IMAGE_BASE_URL}/${path}`;

const demoShops = [
    {
        username: process.env.DEMO_SHOP_USERNAME || 'demo_shop',
        shopName: process.env.DEMO_SHOP_NAME || 'SunStack Demo Shop',
        ownerName: 'Demo Shop Owner',
        email: 'demo.shop@example.com',
        phoneNumber: '0900000000',
        avatarUrl: demoImage('shops/sunstack-demo-shop.jpg'),
        description: 'Shop tong hop dung de demo nhanh tinh nang san pham.',
        location: 'Thanh pho Ha Noi',
        products: [
            product('Ao thun cotton basic', 'Ao thun cotton mem, form unisex, phu hop mac hang ngay.', demoImage('products/ao-thun-cotton-basic-1.jpg'), [demoImage('products/ao-thun-cotton-basic-2.jpg')], 'Thoi trang nam', 300, [
                variant({ Mau: 'Trang', Size: 'M' }, 129000, 35),
                variant({ Mau: 'Trang', Size: 'L' }, 129000, 25),
                variant({ Mau: 'Den', Size: 'M' }, 139000, 30),
                variant({ Mau: 'Den', Size: 'L' }, 139000, 20)
            ]),
            product('Binh giu nhiet inox 750ml', 'Binh giu nhiet 2 lop, nap kin, phu hop di hoc va di lam.', demoImage('products/binh-giu-nhiet-inox-750ml-1.jpg'), [demoImage('products/binh-giu-nhiet-inox-750ml-2.jpg')], 'Do gia dung', 650, [
                variant({ Mau: 'Bac' }, 189000, 18),
                variant({ Mau: 'Xanh navy' }, 199000, 14)
            ]),
            product('Ban phim co mini 68 phim', 'Ban phim co layout gon, ket noi USB-C, switch go em va den nen RGB.', demoImage('products/ban-phim-co-mini-68-phim-1.jpg'), [demoImage('products/ban-phim-co-mini-68-phim-2.jpg')], 'Phu kien cong nghe', 900, [
                variant({ Switch: 'Blue', Mau: 'Trang' }, 799000, 10),
                variant({ Switch: 'Brown', Mau: 'Den' }, 849000, 12)
            ]),
            product('Set ly su toi gian 4 mon', 'Set ly su men min, thiet ke toi gian, dung cho ca phe va tra nong.', demoImage('products/set-ly-su-toi-gian-4-mon-1.jpg'), [demoImage('products/set-ly-su-toi-gian-4-mon-2.jpg')], 'Do gia dung', 1200, [
                variant({ Mau: 'Trang sua' }, 249000, 16),
                variant({ Mau: 'Xam da' }, 259000, 11)
            ]),
            product('Tui tote canvas di hoc', 'Tui canvas day dan, quai chac, dung vua laptop 14 inch va sach vo.', demoImage('products/tui-tote-canvas-di-hoc-1.jpg'), [demoImage('products/tui-tote-canvas-di-hoc-2.jpg')], 'Phu kien thoi trang', 400, [
                variant({ Mau: 'Be' }, 99000, 40),
                variant({ Mau: 'Den' }, 109000, 28)
            ])
        ]
    },
    {
        username: 'style_corner',
        shopName: 'Style Corner',
        ownerName: 'Style Corner Owner',
        email: 'style.corner@example.com',
        phoneNumber: '0900000001',
        avatarUrl: demoImage('shops/style-corner.jpg'),
        description: 'Thoi trang va phu kien tre trung cho di hoc, di lam.',
        location: 'Thanh pho Ho Chi Minh',
        products: [
            product('So mi linen oversize', 'Ao so mi linen thoang mat, form rong de phoi do.', demoImage('products/so-mi-linen-oversize-1.jpg'), [demoImage('products/so-mi-linen-oversize-2.jpg')], 'Thoi trang nu', 280, [
                variant({ Mau: 'Kem', Size: 'S' }, 219000, 22),
                variant({ Mau: 'Kem', Size: 'M' }, 219000, 26),
                variant({ Mau: 'Xanh bien', Size: 'M' }, 239000, 18)
            ]),
            product('Chan vay jean chu A', 'Chan vay jean lung cao, de mac hang ngay.', demoImage('products/chan-vay-jean-chu-a-1.jpg'), [demoImage('products/chan-vay-jean-chu-a-2.jpg')], 'Thoi trang nu', 420, [
                variant({ Mau: 'Xanh nhat', Size: 'S' }, 259000, 16),
                variant({ Mau: 'Xanh dam', Size: 'M' }, 269000, 20)
            ]),
            product('Giay sneaker canvas', 'Giay canvas co thap, de mem, phu hop di bo hang ngay.', demoImage('products/giay-sneaker-canvas-1.jpg'), [demoImage('products/giay-sneaker-canvas-2.jpg')], 'Giay dep', 850, [
                variant({ Mau: 'Trang', Size: '38' }, 349000, 12),
                variant({ Mau: 'Trang', Size: '39' }, 349000, 11),
                variant({ Mau: 'Den', Size: '40' }, 359000, 10)
            ]),
            product('Mu bucket kaki', 'Mu bucket chat kaki day, che nang tot va de gap gon.', demoImage('products/mu-bucket-kaki-1.jpg'), [demoImage('products/mu-bucket-kaki-2.jpg')], 'Phu kien thoi trang', 180, [
                variant({ Mau: 'Be' }, 89000, 35),
                variant({ Mau: 'Den' }, 99000, 30)
            ]),
            product('Vi mini da mem', 'Vi mini nhieu ngan, chat lieu da PU mem, vua tui nho.', demoImage('products/vi-mini-da-mem-1.jpg'), [demoImage('products/vi-mini-da-mem-2.jpg')], 'Phu kien thoi trang', 200, [
                variant({ Mau: 'Nau' }, 159000, 24),
                variant({ Mau: 'Den' }, 159000, 21)
            ])
        ]
    },
    {
        username: 'tech_hub',
        shopName: 'Tech Hub',
        ownerName: 'Tech Hub Owner',
        email: 'tech.hub@example.com',
        phoneNumber: '0900000002',
        avatarUrl: demoImage('shops/tech-hub.jpg'),
        description: 'Phu kien cong nghe, do setup goc lam viec va hoc tap.',
        location: 'Thanh pho Da Nang',
        products: [
            product('Chuot khong day silent', 'Chuot wireless bam em, pin lau, phu hop van phong.', demoImage('products/chuot-khong-day-silent-1.jpg'), [demoImage('products/chuot-khong-day-silent-2.jpg')], 'Phu kien cong nghe', 160, [
                variant({ Mau: 'Den' }, 229000, 30),
                variant({ Mau: 'Trang' }, 239000, 22)
            ]),
            product('Tai nghe bluetooth in-ear', 'Tai nghe bluetooth hop sac nhanh, mic ro, chong on thu dong.', demoImage('products/tai-nghe-bluetooth-in-ear-1.jpg'), [demoImage('products/tai-nghe-bluetooth-in-ear-2.jpg')], 'Dien tu', 180, [
                variant({ Mau: 'Trang' }, 499000, 18),
                variant({ Mau: 'Den' }, 529000, 15)
            ]),
            product('Gia do laptop nhom', 'Gia do laptop bang nhom, tang giam do cao, tan nhiet tot.', demoImage('products/gia-do-laptop-nhom-1.jpg'), [demoImage('products/gia-do-laptop-nhom-2.jpg')], 'Phu kien cong nghe', 700, [
                variant({ Mau: 'Bac' }, 299000, 17),
                variant({ Mau: 'Xam' }, 319000, 14)
            ]),
            product('Den ban LED chong can', 'Den LED nhieu muc sang, co hen gio va cong sac USB.', demoImage('products/den-ban-led-chong-can-1.jpg'), [demoImage('products/den-ban-led-chong-can-2.jpg')], 'Do gia dung', 900, [
                variant({ Mau: 'Trang' }, 399000, 13),
                variant({ Mau: 'Den' }, 419000, 10)
            ]),
            product('Cap sac nhanh USB-C 100W', 'Cap USB-C boc du, ho tro sac nhanh laptop va dien thoai.', demoImage('products/cap-sac-nhanh-usb-c-100w-1.jpg'), [demoImage('products/cap-sac-nhanh-usb-c-100w-2.jpg')], 'Phu kien cong nghe', 120, [
                variant({ DoDai: '1m' }, 149000, 45),
                variant({ DoDai: '2m' }, 179000, 38)
            ])
        ]
    },
    {
        username: 'home_living',
        shopName: 'Home Living',
        ownerName: 'Home Living Owner',
        email: 'home.living@example.com',
        phoneNumber: '0900000003',
        avatarUrl: demoImage('shops/home-living.jpg'),
        description: 'Do gia dung va decor nho gon cho can ho hien dai.',
        location: 'Thanh pho Hai Phong',
        products: [
            product('Bo ga goi cotton satiny', 'Bo ga goi cotton mem min, mau trung tinh, de giat may.', demoImage('products/bo-ga-goi-cotton-satiny-1.jpg'), [demoImage('products/bo-ga-goi-cotton-satiny-2.jpg')], 'Nha cua doi song', 1800, [
                variant({ Mau: 'Xam', Size: '1m6' }, 699000, 9),
                variant({ Mau: 'Kem', Size: '1m8' }, 749000, 8)
            ]),
            product('Ke go de ban 2 tang', 'Ke go mini de man hinh, sach va phu kien lam viec.', demoImage('products/ke-go-de-ban-2-tang-1.jpg'), [demoImage('products/ke-go-de-ban-2-tang-2.jpg')], 'Nha cua doi song', 2200, [
                variant({ Mau: 'Go sang' }, 329000, 12),
                variant({ Mau: 'Nau tram' }, 349000, 10)
            ]),
            product('Hop dung do vai gap gon', 'Hop vai co nap, dung quan ao va vat dung nho.', demoImage('products/hop-dung-do-vai-gap-gon-1.jpg'), [demoImage('products/hop-dung-do-vai-gap-gon-2.jpg')], 'Do gia dung', 600, [
                variant({ Mau: 'Xam' }, 89000, 32),
                variant({ Mau: 'Be' }, 99000, 28)
            ]),
            product('Tinh dau thom phong', 'Tinh dau mui nhe, dung voi may khuech tan hoac lo gom.', demoImage('products/tinh-dau-thom-phong-1.jpg'), [demoImage('products/tinh-dau-thom-phong-2.jpg')], 'Lam dep suc khoe', 220, [
                variant({ Mui: 'Lavender' }, 129000, 20),
                variant({ Mui: 'Cam ngot' }, 129000, 18)
            ]),
            product('Tham phong tam sieu tham', 'Tham phong tam long mem, de chong truot, nhanh kho.', demoImage('products/tham-phong-tam-sieu-tham-1.jpg'), [demoImage('products/tham-phong-tam-sieu-tham-2.jpg')], 'Nha cua doi song', 500, [
                variant({ Mau: 'Xam' }, 159000, 26),
                variant({ Mau: 'Xanh reu' }, 169000, 21)
            ])
        ]
    }
];

const extraProductsByShop = {
    demo_shop: [
        product('Ao polo pique co be', 'Ao polo vai pique thoang mat, co be lich su va de mac di lam.', demoImage('products/ao-thun-cotton-basic-1.jpg'), [demoImage('products/ao-thun-cotton-basic-2.jpg')], 'Thoi trang nam', 320, [
            variant({ Mau: 'Navy', Size: 'M' }, 179000, 24),
            variant({ Mau: 'Navy', Size: 'L' }, 179000, 18),
            variant({ Mau: 'Trang', Size: 'L' }, 189000, 16)
        ]),
        product('Quan short kaki nam', 'Quan short kaki co gian nhe, tui sau tien dung, hop di choi cuoi tuan.', demoImage('products/so-mi-linen-oversize-1.jpg'), [demoImage('products/so-mi-linen-oversize-2.jpg')], 'Thoi trang nam', 420, [
            variant({ Mau: 'Be', Size: 'M' }, 219000, 20),
            variant({ Mau: 'Den', Size: 'L' }, 229000, 18)
        ]),
        product('Ao khoac gio chong nang', 'Ao khoac mong nhe, co mu, can gio va che nang khi di chuyen.', demoImage('products/mu-bucket-kaki-1.jpg'), [demoImage('products/mu-bucket-kaki-2.jpg')], 'Thoi trang nam', 520, [
            variant({ Mau: 'Ghi', Size: 'M' }, 299000, 14),
            variant({ Mau: 'Xanh reu', Size: 'L' }, 319000, 13)
        ]),
        product('Set 3 doi tat co ngan', 'Tat cotton co ngan, thấm hut tot, phu hop sneaker hang ngay.', demoImage('products/giay-sneaker-canvas-1.jpg'), [demoImage('products/giay-sneaker-canvas-2.jpg')], 'Phu kien thoi trang', 120, [
            variant({ Mau: 'Trang' }, 59000, 60),
            variant({ Mau: 'Den' }, 69000, 55)
        ]),
        product('Balo laptop 15 inch', 'Balo nhieu ngan, chong soc laptop, vai day va chong tham nhe.', demoImage('products/tui-tote-canvas-di-hoc-1.jpg'), [demoImage('products/tui-tote-canvas-di-hoc-2.jpg')], 'Phu kien thoi trang', 850, [
            variant({ Mau: 'Den' }, 329000, 18),
            variant({ Mau: 'Xam' }, 349000, 15)
        ]),
        product('Hop com giu nhiet 3 ngan', 'Hop com inox 3 ngan, giu am lau, kem tui xach tien loi.', demoImage('products/binh-giu-nhiet-inox-750ml-1.jpg'), [demoImage('products/binh-giu-nhiet-inox-750ml-2.jpg')], 'Do gia dung', 780, [
            variant({ Mau: 'Xanh' }, 239000, 20),
            variant({ Mau: 'Hong' }, 239000, 16)
        ]),
        product('Bo muong dua inox', 'Bo muong dua inox 304, hop dung gon, phu hop van phong va du lich.', demoImage('products/set-ly-su-toi-gian-4-mon-1.jpg'), [demoImage('products/set-ly-su-toi-gian-4-mon-2.jpg')], 'Bep an', 250, [
            variant({ Kieu: '4 mon' }, 79000, 40),
            variant({ Kieu: '6 mon' }, 99000, 35)
        ]),
        product('Khay dung gia vi xoay', 'Khay gia vi xoay 360 do, kem lo thuy tinh va nhan dan.', demoImage('products/hop-dung-do-vai-gap-gon-1.jpg'), [demoImage('products/hop-dung-do-vai-gap-gon-2.jpg')], 'Bep an', 1100, [
            variant({ SoLo: '6 lo' }, 189000, 16),
            variant({ SoLo: '8 lo' }, 229000, 12)
        ]),
        product('Sach ghi chu dot grid A5', 'So tay giay kem, dong dot grid, phu hop bullet journal.', demoImage('products/ke-go-de-ban-2-tang-1.jpg'), [demoImage('products/ke-go-de-ban-2-tang-2.jpg')], 'Sach van phong', 280, [
            variant({ Mau: 'Nau kraft' }, 69000, 45),
            variant({ Mau: 'Xanh la' }, 79000, 32)
        ]),
        product('But gel muc den combo 5 cay', 'But gel net 0.5mm, muc deu, than cam chac tay.', demoImage('products/ban-phim-co-mini-68-phim-1.jpg'), [demoImage('products/ban-phim-co-mini-68-phim-2.jpg')], 'Sach van phong', 120, [
            variant({ MauMuc: 'Den' }, 49000, 80),
            variant({ MauMuc: 'Xanh' }, 49000, 70)
        ]),
        product('Den ngu cam bien anh sang', 'Den ngu LED cam bien, anh sang am, tu bat khi troi toi.', demoImage('products/den-ban-led-chong-can-1.jpg'), [demoImage('products/den-ban-led-chong-can-2.jpg')], 'Nha cua doi song', 260, [
            variant({ MauAnhSang: 'Vang am' }, 89000, 28),
            variant({ MauAnhSang: 'Trang am' }, 89000, 25)
        ]),
        product('Khung anh go de ban', 'Khung anh go toi gian, dung duoc ngang doc, kem chan dung.', demoImage('products/ke-go-de-ban-2-tang-1.jpg'), [demoImage('products/ke-go-de-ban-2-tang-2.jpg')], 'Nha cua doi song', 350, [
            variant({ Size: '13x18' }, 99000, 22),
            variant({ Size: '20x25' }, 129000, 18)
        ]),
        product('Day nhay the thao', 'Day nhay co vong bi, tay cam chong truot, dieu chinh chieu dai.', demoImage('products/cap-sac-nhanh-usb-c-100w-1.jpg'), [demoImage('products/cap-sac-nhanh-usb-c-100w-2.jpg')], 'The thao du lich', 220, [
            variant({ Mau: 'Den' }, 89000, 36),
            variant({ Mau: 'Do' }, 99000, 30)
        ]),
        product('Binh nuoc the thao 1L', 'Binh nuoc nhua Tritan, nap bat, co vach nhac uong nuoc.', demoImage('products/binh-giu-nhiet-inox-750ml-1.jpg'), [demoImage('products/binh-giu-nhiet-inox-750ml-2.jpg')], 'The thao du lich', 300, [
            variant({ Mau: 'Xanh bien' }, 119000, 24),
            variant({ Mau: 'Tim' }, 119000, 21)
        ]),
        product('Tui dung my pham du lich', 'Tui chong tham nhieu ngan, treo duoc trong phong tam.', demoImage('products/vi-mini-da-mem-1.jpg'), [demoImage('products/vi-mini-da-mem-2.jpg')], 'Lam dep suc khoe', 180, [
            variant({ Mau: 'Be' }, 99000, 26),
            variant({ Mau: 'Den' }, 109000, 20)
        ])
    ],
    style_corner: [
        product('Dam midi hoa nho', 'Dam midi vai mem, hoa nho thanh lich, phu hop di lam va cafe.', demoImage('products/so-mi-linen-oversize-1.jpg'), [demoImage('products/so-mi-linen-oversize-2.jpg')], 'Thoi trang nu', 360, [variant({ Mau: 'Hoa xanh', Size: 'S' }, 329000, 18), variant({ Mau: 'Hoa do', Size: 'M' }, 339000, 15)]),
        product('Ao croptop rib co tron', 'Ao croptop rib co gian, dang om vua, de phoi voi jean.', demoImage('products/ao-thun-cotton-basic-1.jpg'), [demoImage('products/ao-thun-cotton-basic-2.jpg')], 'Thoi trang nu', 220, [variant({ Mau: 'Trang', Size: 'S' }, 129000, 26), variant({ Mau: 'Den', Size: 'M' }, 139000, 22)]),
        product('Quan jean ong suong', 'Quan jean ong suong lung cao, chat denim mem va dung form.', demoImage('products/chan-vay-jean-chu-a-1.jpg'), [demoImage('products/chan-vay-jean-chu-a-2.jpg')], 'Thoi trang nu', 650, [variant({ Mau: 'Xanh nhat', Size: 'S' }, 359000, 16), variant({ Mau: 'Xanh dam', Size: 'M' }, 379000, 14)]),
        product('Ao blazer mong', 'Blazer vai mong, form rong nhe, phu hop khoac ngoai mua he.', demoImage('products/so-mi-linen-oversize-1.jpg'), [demoImage('products/so-mi-linen-oversize-2.jpg')], 'Thoi trang nu', 520, [variant({ Mau: 'Kem', Size: 'M' }, 399000, 12), variant({ Mau: 'Den', Size: 'L' }, 429000, 10)]),
        product('Tui deo cheo mini', 'Tui deo cheo nho gon, ngan khoa keo, day dieu chinh.', demoImage('products/tui-tote-canvas-di-hoc-1.jpg'), [demoImage('products/tui-tote-canvas-di-hoc-2.jpg')], 'Phu kien thoi trang', 300, [variant({ Mau: 'Den' }, 189000, 24), variant({ Mau: 'Trang' }, 199000, 20)]),
        product('Khan lua vuong', 'Khan lua hoa tiet nhe, dung lam khan co hoac phu kien tui.', demoImage('products/mu-bucket-kaki-1.jpg'), [demoImage('products/mu-bucket-kaki-2.jpg')], 'Phu kien thoi trang', 80, [variant({ Mau: 'Pastel' }, 79000, 40), variant({ Mau: 'Do dat' }, 89000, 36)]),
        product('Kinh mat oval', 'Kinh mat gong nhe, trong UV400, hop mat tron va mat trai xoan.', demoImage('products/vi-mini-da-mem-1.jpg'), [demoImage('products/vi-mini-da-mem-2.jpg')], 'Phu kien thoi trang', 150, [variant({ Mau: 'Den' }, 129000, 28), variant({ Mau: 'Nau tra' }, 139000, 22)]),
        product('Sandals quai ngang', 'Sandals de bet, quai mem, di em chan trong ngay dai.', demoImage('products/giay-sneaker-canvas-1.jpg'), [demoImage('products/giay-sneaker-canvas-2.jpg')], 'Giay dep', 600, [variant({ Mau: 'Kem', Size: '37' }, 249000, 12), variant({ Mau: 'Den', Size: '38' }, 259000, 10)]),
        product('Giay bup be mui vuong', 'Giay bup be mui vuong thanh lich, de mem, phu hop cong so.', demoImage('products/giay-sneaker-canvas-1.jpg'), [demoImage('products/giay-sneaker-canvas-2.jpg')], 'Giay dep', 620, [variant({ Mau: 'Den', Size: '37' }, 299000, 11), variant({ Mau: 'Be', Size: '38' }, 309000, 9)]),
        product('Hop trang suc du lich', 'Hop dung trang suc mini, chia ngan gon, lot nhung mem.', demoImage('products/hop-dung-do-vai-gap-gon-1.jpg'), [demoImage('products/hop-dung-do-vai-gap-gon-2.jpg')], 'Phu kien thoi trang', 180, [variant({ Mau: 'Hong' }, 119000, 18), variant({ Mau: 'Xanh' }, 119000, 17)]),
        product('Son duong co mau', 'Son duong co mau nhe, cap am moi va tao sac tu nhien.', demoImage('products/tinh-dau-thom-phong-1.jpg'), [demoImage('products/tinh-dau-thom-phong-2.jpg')], 'Lam dep suc khoe', 90, [variant({ Mau: 'Cam dao' }, 99000, 35), variant({ Mau: 'Hong dat' }, 99000, 30)]),
        product('Mat na giay cap am combo 10', 'Mat na giay tinh chat cap am, dung cho da kho va thieu nuoc.', demoImage('products/tinh-dau-thom-phong-1.jpg'), [demoImage('products/tinh-dau-thom-phong-2.jpg')], 'Lam dep suc khoe', 260, [variant({ Loai: 'Cap am' }, 149000, 28), variant({ Loai: 'Lam diu' }, 159000, 24)]),
        product('Luoc go massage da dau', 'Luoc go rang tron, cham soc toc va massage da dau nhe nhang.', demoImage('products/ke-go-de-ban-2-tang-1.jpg'), [demoImage('products/ke-go-de-ban-2-tang-2.jpg')], 'Lam dep suc khoe', 180, [variant({ Kieu: 'Rang thua' }, 89000, 33), variant({ Kieu: 'Rang day' }, 99000, 30)]),
        product('Vo tap pilates co chong truot', 'Vo tap pilates co hat chong truot, chat vai thoang khi.', demoImage('products/giay-sneaker-canvas-1.jpg'), [demoImage('products/giay-sneaker-canvas-2.jpg')], 'The thao du lich', 120, [variant({ Mau: 'Hong' }, 69000, 40), variant({ Mau: 'Xam' }, 69000, 38)]),
        product('Tui canvas mini in chu', 'Tui canvas mini day deo cheo, nhe va tien khi di dao pho.', demoImage('products/tui-tote-canvas-di-hoc-1.jpg'), [demoImage('products/tui-tote-canvas-di-hoc-2.jpg')], 'Phu kien thoi trang', 260, [variant({ Mau: 'Be' }, 119000, 35), variant({ Mau: 'Den' }, 129000, 28)])
    ],
    tech_hub: [
        product('Hub USB-C 6 in 1', 'Hub USB-C gom HDMI, USB 3.0 va doc the nho cho laptop.', demoImage('products/cap-sac-nhanh-usb-c-100w-1.jpg'), [demoImage('products/cap-sac-nhanh-usb-c-100w-2.jpg')], 'Phu kien cong nghe', 180, [variant({ Mau: 'Xam' }, 399000, 18), variant({ Mau: 'Bac' }, 419000, 15)]),
        product('Sac nhanh GaN 65W', 'Cu sac GaN nho gon, 2 cong USB-C, tuong thich laptop va dien thoai.', demoImage('products/cap-sac-nhanh-usb-c-100w-1.jpg'), [demoImage('products/cap-sac-nhanh-usb-c-100w-2.jpg')], 'Phu kien cong nghe', 220, [variant({ Cong: '2C1A' }, 499000, 16), variant({ Cong: '3C' }, 549000, 13)]),
        product('Lot chuot da PU co lon', 'Lot chuot da PU chong truot, kich thuoc lon cho ban lam viec.', demoImage('products/chuot-khong-day-silent-1.jpg'), [demoImage('products/chuot-khong-day-silent-2.jpg')], 'Phu kien cong nghe', 350, [variant({ Mau: 'Den' }, 139000, 35), variant({ Mau: 'Nau' }, 149000, 30)]),
        product('Webcam full HD 1080p', 'Webcam 1080p co mic, kep man hinh, hop hoc online va hop nhom.', demoImage('products/ban-phim-co-mini-68-phim-1.jpg'), [demoImage('products/ban-phim-co-mini-68-phim-2.jpg')], 'Dien tu', 260, [variant({ Mau: 'Den' }, 459000, 12), variant({ Mau: 'Trang' }, 479000, 10)]),
        product('Micro thu am USB mini', 'Micro USB de ban, loc am co ban, phu hop livestream va podcast.', demoImage('products/tai-nghe-bluetooth-in-ear-1.jpg'), [demoImage('products/tai-nghe-bluetooth-in-ear-2.jpg')], 'Dien tu', 520, [variant({ Mau: 'Den' }, 599000, 9), variant({ Mau: 'Bac' }, 629000, 8)]),
        product('O cung SSD portable 512GB', 'SSD portable toc do cao, vo kim loai, cap USB-C kem san.', demoImage('products/gia-do-laptop-nhom-1.jpg'), [demoImage('products/gia-do-laptop-nhom-2.jpg')], 'Dien tu', 180, [variant({ DungLuong: '512GB' }, 1299000, 8), variant({ DungLuong: '1TB' }, 1999000, 6)]),
        product('Pin sac du phong 20000mAh', 'Pin sac du phong dung luong lon, sac nhanh 22.5W, co man hinh.', demoImage('products/binh-giu-nhiet-inox-750ml-1.jpg'), [demoImage('products/binh-giu-nhiet-inox-750ml-2.jpg')], 'Dien tu', 420, [variant({ Mau: 'Den' }, 499000, 14), variant({ Mau: 'Trang' }, 519000, 12)]),
        product('Gia do dien thoai gap gon', 'Gia do hop kim gap gon, chong truot, dieu chinh goc nhin.', demoImage('products/gia-do-laptop-nhom-1.jpg'), [demoImage('products/gia-do-laptop-nhom-2.jpg')], 'Phu kien cong nghe', 160, [variant({ Mau: 'Bac' }, 99000, 45), variant({ Mau: 'Xam' }, 109000, 38)]),
        product('Mieng dan cuong luc dien thoai', 'Kinh cuong luc 9H, bo cong, chong bam van tay.', demoImage('products/den-ban-led-chong-can-1.jpg'), [demoImage('products/den-ban-led-chong-can-2.jpg')], 'Phu kien cong nghe', 60, [variant({ DongMay: 'iPhone' }, 69000, 60), variant({ DongMay: 'Samsung' }, 69000, 55)]),
        product('Bao da may tinh bang', 'Bao da gap dung may tinh bang, nam cham hit, chong xuoc.', demoImage('products/vi-mini-da-mem-1.jpg'), [demoImage('products/vi-mini-da-mem-2.jpg')], 'Phu kien cong nghe', 320, [variant({ Size: '10 inch' }, 199000, 18), variant({ Size: '11 inch' }, 219000, 15)]),
        product('Bo ve sinh laptop', 'Bo dung cu ve sinh man hinh, ban phim va khe tan nhiet.', demoImage('products/hop-dung-do-vai-gap-gon-1.jpg'), [demoImage('products/hop-dung-do-vai-gap-gon-2.jpg')], 'Phu kien cong nghe', 180, [variant({ Kieu: 'Co ban' }, 79000, 50), variant({ Kieu: 'Day du' }, 119000, 36)]),
        product('Router wifi mini', 'Router wifi bang tan kep, cau hinh nhanh cho phong nho.', demoImage('products/chuot-khong-day-silent-1.jpg'), [demoImage('products/chuot-khong-day-silent-2.jpg')], 'Dien tu', 360, [variant({ TocDo: 'AC1200' }, 599000, 9), variant({ TocDo: 'AX1800' }, 899000, 7)]),
        product('Den led monitor bar', 'Den treo man hinh, chong loi mat, dieu chinh nhiet mau.', demoImage('products/den-ban-led-chong-can-1.jpg'), [demoImage('products/den-ban-led-chong-can-2.jpg')], 'Phu kien cong nghe', 650, [variant({ Mau: 'Den' }, 699000, 10), variant({ Mau: 'Bac' }, 729000, 8)]),
        product('Ke sap xep day cap', 'Bo kep day cap silicon, dan mat ban, giu goc lam viec gon gang.', demoImage('products/cap-sac-nhanh-usb-c-100w-1.jpg'), [demoImage('products/cap-sac-nhanh-usb-c-100w-2.jpg')], 'Phu kien cong nghe', 100, [variant({ SoLuong: '6 cai' }, 59000, 70), variant({ SoLuong: '10 cai' }, 89000, 55)]),
        product('Tui chong soc laptop', 'Tui chong soc vai day, lot mem, co ngan phu kien.', demoImage('products/tui-tote-canvas-di-hoc-1.jpg'), [demoImage('products/tui-tote-canvas-di-hoc-2.jpg')], 'Phu kien cong nghe', 420, [variant({ Size: '13 inch' }, 189000, 20), variant({ Size: '15 inch' }, 209000, 18)])
    ],
    home_living: [
        product('Noi chien khong dau mini', 'Noi chien mini 3L, phu hop gia dinh nho, de thao rua.', demoImage('products/hop-dung-do-vai-gap-gon-1.jpg'), [demoImage('products/hop-dung-do-vai-gap-gon-2.jpg')], 'Bep an', 3200, [variant({ DungTich: '3L' }, 899000, 8), variant({ DungTich: '4.5L' }, 1199000, 6)]),
        product('Thot go nghien chu nhat', 'Thot go day, be mat min, dung cat thai va decor bep.', demoImage('products/ke-go-de-ban-2-tang-1.jpg'), [demoImage('products/ke-go-de-ban-2-tang-2.jpg')], 'Bep an', 1500, [variant({ Size: 'Nho' }, 189000, 14), variant({ Size: 'Lon' }, 249000, 10)]),
        product('Bo hop thuy tinh dung thuc pham', 'Hop thuy tinh nap kin, dung lo vi song va may rua chen.', demoImage('products/set-ly-su-toi-gian-4-mon-1.jpg'), [demoImage('products/set-ly-su-toi-gian-4-mon-2.jpg')], 'Bep an', 1800, [variant({ SoLuong: '3 hop' }, 259000, 16), variant({ SoLuong: '5 hop' }, 399000, 12)]),
        product('Rem cua linen mau tron', 'Rem linen can sang nhe, mau trung tinh, hop phong ngu va phong khach.', demoImage('products/bo-ga-goi-cotton-satiny-1.jpg'), [demoImage('products/bo-ga-goi-cotton-satiny-2.jpg')], 'Nha cua doi song', 900, [variant({ Mau: 'Kem', Size: '1m4' }, 299000, 12), variant({ Mau: 'Xam', Size: '1m8' }, 349000, 10)]),
        product('Goi tua lung sofa', 'Goi tua lung vo vai bo, ruot bong mem, de phoi sofa.', demoImage('products/bo-ga-goi-cotton-satiny-1.jpg'), [demoImage('products/bo-ga-goi-cotton-satiny-2.jpg')], 'Nha cua doi song', 450, [variant({ Mau: 'Be' }, 129000, 22), variant({ Mau: 'Xanh reu' }, 139000, 18)]),
        product('Lo hoa gom trang', 'Lo hoa gom men trang, dang toi gian, hop hoa kho va hoa tuoi.', demoImage('products/set-ly-su-toi-gian-4-mon-1.jpg'), [demoImage('products/set-ly-su-toi-gian-4-mon-2.jpg')], 'Nha cua doi song', 700, [variant({ Size: '20cm' }, 179000, 16), variant({ Size: '28cm' }, 239000, 12)]),
        product('Ke giay 4 tang lap ghep', 'Ke giay nhua lap ghep, chiu luc tot, tiet kiem dien tich.', demoImage('products/ke-go-de-ban-2-tang-1.jpg'), [demoImage('products/ke-go-de-ban-2-tang-2.jpg')], 'Do gia dung', 2200, [variant({ Mau: 'Trang' }, 299000, 10), variant({ Mau: 'Den' }, 319000, 8)]),
        product('Cay lau nha xoay 360', 'Cay lau nha kem thung vat, bong lau microfiber, de thay the.', demoImage('products/tham-phong-tam-sieu-tham-1.jpg'), [demoImage('products/tham-phong-tam-sieu-tham-2.jpg')], 'Do gia dung', 2500, [variant({ Mau: 'Xanh' }, 249000, 18), variant({ Mau: 'Xam' }, 269000, 14)]),
        product('Tui hut chan khong dung chan men', 'Tui hut chan khong nhieu size, bao quan chan men va quan ao.', demoImage('products/hop-dung-do-vai-gap-gon-1.jpg'), [demoImage('products/hop-dung-do-vai-gap-gon-2.jpg')], 'Do gia dung', 400, [variant({ SoLuong: '5 tui' }, 129000, 30), variant({ SoLuong: '10 tui' }, 219000, 20)]),
        product('Sap thom phong dang hop', 'Sap thom mui diu, dung tu quan ao, phong ngu va phong tam.', demoImage('products/tinh-dau-thom-phong-1.jpg'), [demoImage('products/tinh-dau-thom-phong-2.jpg')], 'Lam dep suc khoe', 180, [variant({ Mui: 'Hoa nhai' }, 69000, 40), variant({ Mui: 'Tra xanh' }, 69000, 35)]),
        product('May khuech tan tinh dau mini', 'May khuech tan mini cong USB, co den dem, phun suong nhe.', demoImage('products/tinh-dau-thom-phong-1.jpg'), [demoImage('products/tinh-dau-thom-phong-2.jpg')], 'Lam dep suc khoe', 350, [variant({ Mau: 'Trang' }, 199000, 18), variant({ Mau: 'Go' }, 229000, 14)]),
        product('Khan tam cotton cao cap', 'Khan tam cotton day, tham hut tot, mem va nhanh kho.', demoImage('products/tham-phong-tam-sieu-tham-1.jpg'), [demoImage('products/tham-phong-tam-sieu-tham-2.jpg')], 'Nha cua doi song', 520, [variant({ Mau: 'Trang' }, 159000, 24), variant({ Mau: 'Xam' }, 169000, 22)]),
        product('Bo chen an com men nham', 'Bo chen men nham toi gian, gom chen, dia va to canh.', demoImage('products/set-ly-su-toi-gian-4-mon-1.jpg'), [demoImage('products/set-ly-su-toi-gian-4-mon-2.jpg')], 'Bep an', 2400, [variant({ SoMon: '8 mon' }, 499000, 9), variant({ SoMon: '12 mon' }, 699000, 7)]),
        product('Nha cay mini de ban', 'Chau cay mini de ban lam viec, de cham soc, kem dia lot.', demoImage('products/ke-go-de-ban-2-tang-1.jpg'), [demoImage('products/ke-go-de-ban-2-tang-2.jpg')], 'Nha cua doi song', 600, [variant({ Loai: 'Sen da' }, 99000, 25), variant({ Loai: 'Truong sinh' }, 119000, 20)]),
        product('Bat an cho thu cung chong truot', 'Bat an inox de cao su, chong truot va de ve sinh.', demoImage('products/binh-giu-nhiet-inox-750ml-1.jpg'), [demoImage('products/binh-giu-nhiet-inox-750ml-2.jpg')], 'Cham soc thu cung', 280, [variant({ Size: 'S' }, 79000, 32), variant({ Size: 'M' }, 99000, 26)])
    ]
};

for (const shop of demoShops) {
    shop.products.push(...(extraProductsByShop[shop.username] || []));
}


function product(name, description, thumbnailUrl, extraMediaUrls, category, weight, variants) {
    const slug = slugify(name);
    const seedThumbnailUrl = demoImage(`products/${slug}-1.jpg`);
    const seedExtraUrl = demoImage(`products/${slug}-2.jpg`);
    return {
        name,
        description,
        thumbnailUrl: seedThumbnailUrl,
        mediaUrls: [seedThumbnailUrl, seedExtraUrl],
        category,
        weight,
        variants
    };
}

function slugify(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function variant(attrs, price, quantity) {
    return { attrs, price, quantity };
}

async function cleanupOldDemoProducts(db) {
    const oldProducts = await db.collection('products')
        .find({ demoSeed: true }, { projection: { _id: 1, mediaList: 1 } })
        .toArray();
    const oldProductIds = oldProducts.map(product => product._id);
    const oldMediaIds = oldProducts.flatMap(product => product.mediaList || []);

    if (oldProductIds.length > 0) {
        await db.collection('product_skus').deleteMany({ product: { $in: oldProductIds } });
        await db.collection('products').deleteMany({ _id: { $in: oldProductIds } });
    }

    if (oldMediaIds.length > 0) {
        await db.collection('product_media').deleteMany({ _id: { $in: oldMediaIds } });
    }

    return oldProductIds.map(id => id.toString());
}

async function createProducts(db, shop, seedShop, categories, shopIndex) {
    const products = [];
    const skus = [];
    const media = [];

    for (const [index, item] of seedShop.products.entries()) {
        const productId = objectId();
        const productMedia = item.mediaUrls.map(url => ({
            _id: objectId(),
            url,
            type: 'IMAGE',
            demoSeed: true
        }));

        const productSkus = item.variants.map((variant, variantIndex) => ({
            _id: objectId(),
            product: productId,
            sku: `DEMO-${String(shopIndex + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}-${String(variantIndex + 1).padStart(2, '0')}`,
            price: variant.price,
            quantity: variant.quantity,
            attributes: Object.entries(variant.attrs).map(([name, value]) => ({
                _id: objectId(),
                name,
                value
            })),
            demoSeed: true
        }));

        products.push({
            _id: productId,
            name: item.name,
            shop: shop._id,
            description: item.description,
            thumbnailUrl: item.thumbnailUrl,
            price: Math.min(...productSkus.map(sku => sku.price)),
            quantity: productSkus.reduce((sum, sku) => sum + sku.quantity, 0),
            category: categories[item.category]._id,
            weight: item.weight,
            skuList: productSkus.map(sku => sku._id),
            mediaList: productMedia.map(mediaItem => mediaItem._id),
            revenue: 0,
            sold: 0,
            averageRating: 0,
            totalReviews: 0,
            location: seedShop.location,
            visible: true,
            createdAt: now(),
            updatedAt: now(),
            restricted: false,
            restrictStatus: 'OPENED',
            deleted: false,
            demoSeed: true
        });

        skus.push(...productSkus);
        media.push(...productMedia);
    }

    await db.collection('product_media').insertMany(media);
    await db.collection('product_skus').insertMany(skus);
    await db.collection('products').insertMany(products);
    return products;
}

async function seed() {
    // Connect to auth_db for users
    const authConn = await mongoose.createConnection(AUTH_DB_URI).asPromise();
    const authDb = authConn.db;

    // Connect to shop_db for shops
    const shopConn = await mongoose.createConnection(SHOP_DB_URI).asPromise();
    const shopDb = shopConn.db;

    // Connect to product_db for products/categories
    const productConn = await mongoose.createConnection(PRODUCT_DB_URI).asPromise();
    const productDb = productConn.db;

    try {
        // Create users in auth_db
        const role = await authDb.collection('roles').findOne({ name: 'USER' });
        if (!role) {
            await authDb.collection('roles').insertOne({
                _id: objectId(),
                name: 'USER',
                description: 'Role for users and shops'
            });
        }

        // Create categories in product_db
        const categories = await createCategoriesInDb(productDb);
        const shops = [];

        // Cleanup old demo products from product_db
        await cleanupOldDemoProducts(productDb);
        const products = [];

        for (const [shopIndex, seedShop] of demoShops.entries()) {
            // Create user in auth_db
            const user = await getOrCreateUserInAuthDb(authDb, seedShop);

            // Create shop in shop_db
            const shop = await getOrCreateShopInShopDb(shopDb, user, seedShop);
            shops.push(shop);

            // Create products in product_db
            const shopProducts = await createProducts(productDb, shop, seedShop, categories, shopIndex);
            products.push(...shopProducts);
            await updateCountersInDb(productDb, shopDb, shop, categories);

            console.log(`Created shop: ${seedShop.shopName} with user: ${seedShop.username}`);
        }

        console.log(`Seeded ${products.length} demo products for ${shops.length} demo shops.`);
        console.log(`Demo shop usernames: ${demoShops.map(shop => shop.username).join(', ')}`);
        console.log('Demo shop password: password');
    } finally {
        await authConn.close();
        await shopConn.close();
        await productConn.close();
    }
}

async function createCategoriesInDb(db) {
    const root = await db.collection('categories').findOne({ name: 'Danh muc demo' });
    let rootId;
    if (root) {
        rootId = root._id;
    } else {
        const doc = {
            _id: objectId(),
            name: 'Danh muc demo',
            description: 'Danh muc cha cho du lieu demo',
            parent: null,
            hasChildren: true,
            productCount: 0,
            createdAt: now(),
            demoSeed: true
        };
        await db.collection('categories').insertOne(doc);
        rootId = doc._id;
    }

    const categories = {};
    const names = [...new Set(demoShops.flatMap(shop => shop.products.map(product => product.category)))];
    for (const name of names) {
        const existing = await db.collection('categories').findOne({ name });
        if (existing) {
            categories[name] = existing;
        } else {
            const doc = {
                _id: objectId(),
                name,
                description: `Danh muc demo: ${name}`,
                parent: rootId,
                hasChildren: false,
                productCount: 0,
                createdAt: now(),
                demoSeed: true
            };
            await db.collection('categories').insertOne(doc);
            categories[name] = doc;
        }
    }
    return categories;
}

async function getOrCreateUserInAuthDb(db, seedShop) {
    let user = await db.collection('users').findOne({ username: seedShop.username });
    if (!user) {
        user = {
            _id: objectId(),
            fullName: seedShop.ownerName,
            username: seedShop.username,
            password: DEMO_PASSWORD_HASH,
            email: seedShop.email,
            phoneNumber: seedShop.phoneNumber,
            phone: seedShop.phoneNumber,
            avatarUrl: seedShop.avatarUrl,
            roles: ['user'],
            createdAt: now(),
            created_at: now(),
            updated_at: now(),
            locked: false,
            deleted: false,
            emailVerified: true,
            fromSocial: false,
            demoSeed: true
        };
        await db.collection('users').insertOne(user);
    } else {
        await db.collection('users').updateOne(
            { _id: user._id },
            {
                $set: {
                    password: DEMO_PASSWORD_HASH,
                    avatarUrl: seedShop.avatarUrl,
                    phoneNumber: seedShop.phoneNumber,
                    phone: seedShop.phoneNumber,
                    roles: ['user'],
                    emailVerified: true,
                    locked: false,
                    deleted: false,
                    demoSeed: true
                }
            }
        );
        user = await db.collection('users').findOne({ _id: user._id });
    }
    return user;
}

async function getOrCreateShopInShopDb(db, user, seedShop) {
    let shop = await db.collection('shops').findOne({ user: user._id });
    if (!shop) {
        shop = {
            _id: objectId(),
            name: seedShop.shopName,
            description: seedShop.description,
            avatarUrl: seedShop.avatarUrl,
            user: user._id,
            createdAt: now(),
            productCount: 0,
            revenue: 0,
            averageRating: 0,
            totalReviews: 0,
            followerCount: 0,
            deleted: false,
            demoSeed: true
        };
        await db.collection('shops').insertOne(shop);
    } else {
        await db.collection('shops').updateOne(
            { _id: shop._id },
            {
                $set: {
                    name: seedShop.shopName,
                    description: seedShop.description,
                    avatarUrl: seedShop.avatarUrl,
                    deleted: false,
                    demoSeed: true
                }
            }
        );
        shop = await db.collection('shops').findOne({ _id: shop._id });
    }
    return shop;
}

async function updateCountersInDb(productDb, shopDb, shop, categories) {
    const shopProductCount = await productDb.collection('products').countDocuments({
        shop: shop._id,
        visible: true,
        deleted: false
    });

    await shopDb.collection('shops').updateOne(
        { _id: shop._id },
        { $set: { productCount: shopProductCount } }
    );

    for (const category of Object.values(categories)) {
        const count = await productDb.collection('products').countDocuments({
            category: category._id,
            visible: true,
            deleted: false
        });
        await productDb.collection('categories').updateOne(
            { _id: category._id },
            { $set: { productCount: count } }
        );
    }
}

seed().catch(async error => {
    console.error('Seed demo products failed:', error);
    await mongoose.disconnect();
    process.exit(1);
});
