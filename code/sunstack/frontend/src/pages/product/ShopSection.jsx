import { Link } from 'react-router-dom'
import { BsShopWindow } from "react-icons/bs";
import { IoChatboxEllipses } from "react-icons/io5";
import { useDispatch } from 'react-redux';
import { setUserId } from "../../redux/chatSlice";

export default function ShopSection({ shop }) {
    if (!shop) {
        return (
            <div className="w-full rounded-sm border border-gray-50 bg-white p-5 text-left shadow-[0_1px_1px_rgba(0,0,0,0.05)] md:flex md:items-center md:gap-8 lg:p-6">
                <p className="text-gray-500">Thông tin cửa hàng không khả dụng</p>
            </div>
        )
    }

    const dispatch = useDispatch()
    const username = shop.username || ""

    return (
        <div className="w-full rounded-sm border border-gray-50 bg-white p-5 text-left shadow-[0_1px_1px_rgba(0,0,0,0.05)] md:flex md:items-center md:gap-8 lg:p-6">
            {/* Shop identity */}
            <div className="flex items-center gap-5 pr-8 border-r border-gray-100 shrink-0 w-full md:w-auto mb-4 md:mb-0">
                <Link to={username ? `/shop/${username}` : "#"} className="shrink-0">
                    <img
                        src={shop.avatarUrl}
                        className="w-[78px] h-[78px] rounded-full object-cover border border-gray-200"
                        alt={shop.name}
                    />
                </Link>
                <div className="flex flex-col">
                    <Link to={username ? `/shop/${username}` : "#"}>
                        <p className="mb-2 line-clamp-1 text-[16px] font-medium text-gray-800 hover:text-primary lg:text-[18px]">{shop.name || "Cửa hàng"}</p>
                    </Link>
                    <div className="flex gap-2.5">
                        <button
                            className='flex h-8 items-center justify-center gap-1.5 rounded-sm border border-primary bg-primary/10 px-3 text-[13px] font-medium text-primary transition-colors hover:bg-primary/5 lg:h-9 lg:text-[14px] cursor-pointer'
                            onClick={() => {
                                dispatch(setUserId(shop.userId))
                            }}
                        >
                            <IoChatboxEllipses size={14} /> Chat Ngay
                        </button>
                        <Link to={username ? `../shop/${username}` : "#"}>
                            <button className="flex h-8 items-center justify-center gap-1.5 rounded-sm border border-gray-300 bg-white px-3 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50 lg:h-9 lg:text-[14px] cursor-pointer">
                                <BsShopWindow size={14} /> Xem Shop
                            </button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Shop stats */}
            <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-3 md:gap-x-6 md:text-[14px] lg:grid-cols-3 lg:text-[15px] xl:text-[16px]">
                <div className="flex items-center justify-between md:justify-start md:gap-3">
                    <span className="text-gray-500 capitalize whitespace-nowrap">Đánh giá</span>
                    <span className="text-primary font-medium">{shop.totalReviews ?? 0}</span>
                </div>
                <div className="flex items-center justify-between md:justify-start md:gap-3">
                    <span className="text-gray-500 capitalize whitespace-nowrap">Tỉ lệ phản hồi</span>
                    <span className="text-primary font-medium">99%</span>
                </div>
                <div className="flex items-center justify-between md:justify-start md:gap-3">
                    <span className="text-gray-500 capitalize whitespace-nowrap">Tham gia</span>
                    <span className="text-primary font-medium">{shop.createdAt ? new Date(shop.createdAt).toLocaleDateString('vi-VN') : '--'}</span>
                </div>
                <div className="flex items-center justify-between md:justify-start md:gap-3">
                    <span className="text-gray-500 capitalize whitespace-nowrap">Sản phẩm</span>
                    <span className="text-primary font-medium">{shop.totalProducts ?? 0}</span>
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-center justify-between md:justify-start md:gap-3 text-left">
                    <span className="text-gray-500 capitalize whitespace-nowrap">Thời gian phản hồi</span>
                    <span className="text-primary font-medium whitespace-nowrap">trong vài giờ</span>
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-center justify-between md:justify-start md:gap-3">
                    <span className="text-gray-500 capitalize whitespace-nowrap">Người theo dõi</span>
                    <span className="text-primary font-medium">{shop.followerCount ?? '--'}</span>
                </div>
            </div>
        </div>
    )
}