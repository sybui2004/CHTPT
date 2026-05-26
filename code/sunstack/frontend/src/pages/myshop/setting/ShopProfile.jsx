import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { ToastContainer, toast } from "react-toastify"
import { fetchWithAuth } from "../../../util/AuthUtil"
import { BASE_API_URL } from "../../../constants"
import { uploadImage } from "../../../util/UploadUtil"
import { FiSave, FiCamera, FiExternalLink, FiShield, FiMail, FiPhone, FiCalendar } from "react-icons/fi"
import { BsShopWindow } from "react-icons/bs"

export default function ShopProfile(){

    const [profile, setProfile] = useState(null)
    const [isUploading, setIsUploading] = useState(false)

    const fetchProfile = () => {
        fetchWithAuth(`${BASE_API_URL}/v1/shop/profile/get`, window.location, true)
            .then(res => res.json())
            .then(res => setProfile(res))
    }

    useEffect(() => { fetchProfile() }, [])

    const handleChangeProfile = (field, value) => {
        setProfile({ ...profile, [field]: value });
    };

    const handleChangeAvatar = async (file) => {
        if (!file) return;
        setIsUploading(true);
        try {
            const url = await uploadImage(file)
            if (url) {
            const nextProfile = { ...profile, avatarUrl: url };
            setProfile(nextProfile);
            fetchWithAuth(`${BASE_API_URL}/v1/shop/profile/update`, window.location, true, {
                method: "POST",
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(nextProfile)
            })
                .then(res => res.json())
                .then(res => {
                    if (res.message) toast.error(res.message)
                    else {
                        setProfile(res)
                        toast.success("Đã cập nhật logo cửa hàng!")
                    }
                })
                .catch(() => toast.error("Ảnh đã tải lên nhưng chưa lưu được vào hồ sơ shop"))
            }
        } catch (error) {
            toast.error(error.message || "Khong the tai anh len")
        } finally {
            setIsUploading(false);
        }
    }

    const handleUpdateProfile = () => {
        fetchWithAuth(`${BASE_API_URL}/v1/shop/profile/update`, window.location, true, {
            method: "POST",
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(profile)
        })
            .then(res => res.json())
            .then(res => {
                if(res.message) toast.error(res.message)
                else {
                    setProfile(res)
                    toast.success("Cập nhật thành công!")
                }
            })
            .catch(() => toast.error("Có lỗi xảy ra, vui lòng thử lại sau"))
    }

    return (
        <div className="w-full max-w-full overflow-x-hidden">
            {/* Page header */}
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <BsShopWindow className="text-orange-500" size={20} />
                        Hồ sơ cửa hàng
                    </h1>
                    <p className="text-sm text-gray-400 mt-0.5">Quản lý thông tin và hình ảnh cửa hàng</p>
                </div>
                {profile && (
                    <a
                        href={`/shop/${profile.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                        <FiExternalLink size={14} />
                        Xem cửa hàng
                    </a>
                )}
            </div>

            {profile && (
                // On mobile: flex-col (avatar card on top, form below)
                // On desktop lg: flex-row (form on left flex-1, avatar on right w-64)
                <div className="flex min-w-0 flex-col gap-5 lg:flex-row">

                    {/* === AVATAR COLUMN — shown FIRST on mobile, SECOND on desktop === */}
                    <div className="order-first space-y-4 lg:order-last lg:w-64 lg:shrink-0">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h2 className="text-sm font-semibold text-gray-700">Logo cửa hàng</h2>
                            </div>
                            <div className="p-5 flex flex-col items-center">
                                <div className="relative mb-4">
                                    <img
                                        src={profile.avatarUrl}
                                        alt="Shop Logo"
                                        className="w-28 h-28 rounded-full object-cover border-4 border-gray-100 shadow-md"
                                    />
                                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-orange-600 transition-colors shadow-sm">
                                        <FiCamera size={14} />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept=".jpg,.jpeg,.png"
                                            onChange={e => handleChangeAvatar(e.target.files[0])}
                                        />
                                    </label>
                                </div>

                                {isUploading && (
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                                        <div className="w-3 h-3 border border-orange-500 border-t-transparent rounded-full animate-spin" />
                                        Đang tải lên...
                                    </div>
                                )}

                                <label className="w-full text-center px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors">
                                    Chọn ảnh khác
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".jpg,.jpeg,.png"
                                        onChange={e => handleChangeAvatar(e.target.files[0])}
                                    />
                                </label>

                                <div className="mt-4 text-center text-xs text-gray-400 leading-relaxed">
                                    <p>Dung lượng tối đa <strong>1 MB</strong></p>
                                    <p>Định dạng: <strong>.JPEG, .PNG</strong></p>
                                </div>
                            </div>
                        </div>

                        {/* Tips */}
                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                            <div className="flex items-start gap-2">
                                <FiShield size={14} className="text-orange-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs font-semibold text-orange-700 mb-1">Mẹo tối ưu hồ sơ</p>
                                    <p className="text-xs text-orange-600 leading-relaxed">
                                        Thêm logo rõ ràng và mô tả chi tiết để khách hàng tin tưởng vào cửa hàng của bạn hơn.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* === FORM COLUMN — shown SECOND on mobile, FIRST on desktop === */}
                    <div className="order-last min-w-0 flex-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm lg:order-first">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-sm font-semibold text-gray-700">Thông tin cửa hàng</h2>
                        </div>

                        <div className="p-5 space-y-5">
                            {/* Shop name */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                    Tên cửa hàng
                                </label>
                                <input
                                    type="text"
                                    value={profile.shopName || ""}
                                    onChange={e => handleChangeProfile("shopName", e.target.value)}
                                    placeholder="Tên cửa hàng của bạn..."
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 transition-colors"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                    Mô tả cửa hàng
                                </label>
                                <textarea
                                    value={profile.description || ""}
                                    onChange={e => handleChangeProfile("description", e.target.value)}
                                    placeholder="Mô tả về cửa hàng của bạn..."
                                    rows={4}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 transition-colors resize-none"
                                />
                            </div>

                            {/* Email (readonly) */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                    <FiMail size={11} className="inline mr-1" />Email
                                </label>
                                <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                                    <span className="text-sm text-gray-600 truncate">{profile.email}</span>
                                    <Link to="/account/profile" className="text-xs text-orange-500 hover:underline shrink-0 ml-2 font-medium">Thay đổi</Link>
                                </div>
                            </div>

                            {/* Phone (readonly) */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                    <FiPhone size={11} className="inline mr-1" />Số điện thoại
                                </label>
                                <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                                    <span className="text-sm text-gray-600">{profile.phoneNumber || "Chưa cập nhật"}</span>
                                    <Link to="/account/profile" className="text-xs text-orange-500 hover:underline shrink-0 ml-2 font-medium">Thay đổi</Link>
                                </div>
                            </div>

                            {/* Join date */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                    <FiCalendar size={11} className="inline mr-1" />Ngày tham gia
                                </label>
                                <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                                    {new Date(profile.createdAt).toLocaleDateString("vi-VN")}
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 cursor-pointer sm:w-auto"
                                    onClick={handleUpdateProfile}
                                >
                                    <FiSave size={15} />
                                    Lưu thay đổi
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            <ToastContainer position="bottom-right" />
        </div>
    )
}
