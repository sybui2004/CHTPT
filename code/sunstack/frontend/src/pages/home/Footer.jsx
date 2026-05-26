import { FaFacebook, FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa"
import { FiMail, FiPhone, FiMapPin } from "react-icons/fi"
import { Link } from "react-router-dom"

export default function Footer(){
    return(
        <footer className="mt-auto w-full max-w-full overflow-x-hidden border-t border-gray-200 bg-white text-gray-600">
            {/* Main footer content */}
            <div className="mx-auto w-full max-w-7xl px-4 py-10">
                <div className="grid grid-cols-1 gap-8 text-sm sm:grid-cols-2 md:grid-cols-4">

                    {/* Brand column */}
                    <div className="min-w-0 sm:col-span-2 md:col-span-1">
                        <Link to="/" className="flex items-center gap-2 mb-4">
                            <img src="/logo.svg" className="w-8 h-8" alt="SunStack" />
                            <span className="text-xl font-bold text-primary">SunStack</span>
                        </Link>
                        <p className="mb-4 max-w-full text-xs leading-relaxed text-gray-400">
                            Nền tảng thương mại điện tử kết nối người mua và người bán trên khắp Việt Nam.
                        </p>
                        <div className="flex items-center gap-3">
                            <a href="#" className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                                <FaFacebook size={15} />
                            </a>
                            <a href="#" className="w-8 h-8 flex items-center justify-center rounded-full bg-pink-50 text-pink-500 hover:bg-pink-100 transition-colors">
                                <FaInstagram size={15} />
                            </a>
                            <a href="#" className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors">
                                <FaTiktok size={15} />
                            </a>
                            <a href="#" className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                                <FaYoutube size={15} />
                            </a>
                        </div>
                    </div>

                    {/* Chăm sóc khách hàng */}
                    <div>
                        <h3 className="font-semibold text-gray-800 mb-4 uppercase text-xs tracking-wider">Chăm Sóc Khách Hàng</h3>
                        <ul className="space-y-2.5">
                            {["Hướng Dẫn Mua Hàng", "Chính Sách Bảo Hành", "Giải Quyết Khiếu Nại", "Trả Hàng & Hoàn Tiền"].map(item => (
                                <li key={item}>
                                    <span className="text-xs hover:text-primary hover:translate-x-1 inline-block transition-all duration-200">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Về SunStack */}
                    <div>
                        <h3 className="font-semibold text-gray-800 mb-4 uppercase text-xs tracking-wider">Về SunStack</h3>
                        <ul className="space-y-2.5">
                            {["Giới Thiệu", "Tuyển Dụng", "Điều Khoản Dịch Vụ", "Chính Sách Bảo Mật", "Blog SunStack"].map(item => (
                                <li key={item}>
                                    <a href="#" className="text-xs hover:text-primary hover:translate-x-1 inline-block transition-all duration-200">{item}</a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Liên hệ */}
                    <div>
                        <h3 className="font-semibold text-gray-800 mb-4 uppercase text-xs tracking-wider">Liên Hệ</h3>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-2 text-xs">
                                <FiMail size={13} className="text-primary shrink-0 mt-0.5" />
                                <span>support@sunstack.vn</span>
                            </li>
                            <li className="flex items-start gap-2 text-xs">
                                <FiPhone size={13} className="text-primary shrink-0 mt-0.5" />
                                <span>1900 1234 (Miễn phí)</span>
                            </li>
                            <li className="flex items-start gap-2 text-xs">
                                <FiMapPin size={13} className="text-primary shrink-0 mt-0.5" />
                                <span>Tòa nhà Ptit, Hà Nội, Việt Nam</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-gray-100 bg-gray-50">
                <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-center sm:flex-row sm:text-left">
                    <p className="text-xs text-gray-400">© 2026 SunStack. Tất cả các quyền được bảo lưu.</p>
                    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
                        <span className="hover:text-primary transition-colors">Trợ giúp</span>
                        <a href="#" className="hover:text-primary transition-colors">Riêng tư</a>
                        <a href="#" className="hover:text-primary transition-colors">Điều khoản</a>
                        <a href="#" className="hover:text-primary transition-colors">Sitemap</a>
                    </div>
                </div>
            </div>
        </footer>
    )
}
