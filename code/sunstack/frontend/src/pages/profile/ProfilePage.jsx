import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../util/AuthUtil";
import { BASE_API_URL } from "../../constants";
import { uploadImage } from '../../util/UploadUtil';
import { sanitizePhoneNumber } from "../../util/FormUtil";
import { ToastContainer, toast } from "react-toastify";
import { FiUser, FiCamera, FiSave, FiMail, FiPhone, FiCalendar } from "react-icons/fi";

const genderOptions = [
    { value: "MALE", label: "Nam" },
    { value: "FEMALE", label: "Nữ" },
    { value: "OTHER", label: "Khác" },
];

const formatDateInput = (value) => {
    if (!value) return "";
    return new Date(value).toISOString().split("T")[0];
};

export default function ProfilePage(){
    const [profile, setProfile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const fetchProfile = () => {
        fetchWithAuth(`${BASE_API_URL}/v1/user/profile`, window.location, true)
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
            const url = await uploadImage(file);
            if (url) {
            const nextProfile = { ...profile, avatarUrl: url };
            setProfile(nextProfile);
            fetchWithAuth(`${BASE_API_URL}/v1/user/profile/update`, window.location, true, {
                method: "POST",
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    ...nextProfile,
                    phoneNumber: nextProfile.phoneNumber?.trim() || null,
                })
            })
                .then(async res => {
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || "Có lỗi xảy ra, vui lòng thử lại sau");
                    return data;
                })
                .then(res => {
                    setProfile(res);
                    const userData = {
                        username: res.username,
                        avatarUrl: res.avatarUrl,
                        fullName: res.fullName
                    };
                    localStorage.setItem('userData', JSON.stringify(userData));
                    toast.success("Đã cập nhật ảnh đại diện!");
                })
                .catch((error) => toast.error(error.message || "Ảnh đã tải lên nhưng chưa lưu được vào hồ sơ"));
            }
        } catch (error) {
            toast.error(error.message || "Khong the tai anh len");
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpdateProfile = () => {
        fetchWithAuth(`${BASE_API_URL}/v1/user/profile/update`, window.location, true, {
            method: "POST",
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                ...profile,
                phoneNumber: profile.phoneNumber?.trim() || null,
            })
        })
            .then(async res => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || "Có lỗi xảy ra, vui lòng thử lại sau");
                return data;
            })
            .then(res => {
                setProfile(res);
                const userData = {
                    username: res.username,
                    avatarUrl: res.avatarUrl,
                    fullName: res.fullName
                };
                localStorage.setItem('userData', JSON.stringify(userData));
                toast.success("Cập nhật thành công!");
            })
            .catch((error) => toast.error(error.message || "Có lỗi xảy ra, vui lòng thử lại sau"));
    };

    return (
        <div className="w-full">
            {/* Page header */}
            <div className="mb-5">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FiUser className="text-primary" size={20} />
                    Hồ sơ của tôi
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">Quản lý thông tin cá nhân của bạn</p>
            </div>

            {profile && (
                <div className="flex flex-col lg:flex-row gap-5">
                    {/* Form column — second on mobile, first on desktop */}
                    <div className="order-last lg:order-first flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-sm font-semibold text-gray-700">Thông tin cá nhân</h2>
                        </div>

                        <div className="p-5 space-y-5">
                            {/* Username (readonly) */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                    Username
                                </label>
                                <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm">
                                    {profile.username}
                                </div>
                            </div>

                            {/* Full name */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                    Họ và tên
                                </label>
                                <input
                                    type="text"
                                    value={profile.fullName || ""}
                                    onChange={e => handleChangeProfile("fullName", e.target.value)}
                                    placeholder="Nhập họ và tên..."
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                    <FiMail size={11} className="inline mr-1" />Email
                                </label>
                                <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                                    <span className="text-sm text-gray-600 truncate">{profile.email}</span>
                                    <span className="text-xs text-gray-400 shrink-0 ml-2 font-medium">Không thể đổi</span>
                                </div>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                    <FiPhone size={11} className="inline mr-1" />Số điện thoại
                                </label>
                                <input
                                    type="tel"
                                    value={profile.phoneNumber || ""}
                                    onChange={e => handleChangeProfile("phoneNumber", sanitizePhoneNumber(e.target.value))}
                                    placeholder="Nhập số điện thoại..."
                                    inputMode="numeric"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                                />
                            </div>

                            {/* Gender */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                    Giới tính
                                </label>
                                <div className="flex gap-4">
                                    {genderOptions.map(opt => (
                                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                profile.gender === opt.value
                                                    ? "border-primary"
                                                    : "border-gray-300 group-hover:border-gray-400"
                                            }`}>
                                                {profile.gender === opt.value && (
                                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                                )}
                                            </div>
                                            <input
                                                type="radio"
                                                className="hidden"
                                                name="gender"
                                                value={opt.value}
                                                checked={profile.gender === opt.value}
                                                onChange={() => handleChangeProfile("gender", opt.value)}
                                            />
                                            <span className="text-sm text-gray-700">{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Date of birth */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                    <FiCalendar size={11} className="inline mr-1" />Ngày sinh
                                </label>
                                <input
                                    type="date"
                                    value={formatDateInput(profile.dob)}
                                    onChange={e => handleChangeProfile("dob", e.target.value)}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                                />
                            </div>

                            {/* Save button */}
                            <div className="pt-2">
                                <button
                                    className="flex items-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-orange-600 cursor-pointer transition-colors shadow-sm"
                                    onClick={handleUpdateProfile}
                                >
                                    <FiSave size={15} />
                                    Lưu thay đổi
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Avatar column — shown FIRST on mobile */}
                    <div className="order-first lg:order-last lg:w-64 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-sm font-semibold text-gray-700">Ảnh đại diện</h2>
                        </div>
                        <div className="p-5 flex flex-col items-center">
                            <div className="relative mb-4">
                                <img
                                    src={profile.avatarUrl}
                                    alt="Avatar"
                                    className="w-28 h-28 rounded-full object-cover border-4 border-gray-100 shadow-md"
                                />
                                <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-orange-600 transition-colors shadow-sm">
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
                                    <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
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
                </div>
            )}

            <ToastContainer position="bottom-right" />
        </div>
    );
};
