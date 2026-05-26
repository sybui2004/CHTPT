import { useState, useEffect } from "react";
import { fetchWithAuth } from "../../../util/AuthUtil";
import { BASE_API_URL } from "../../../constants";
import { sanitizePhoneNumber } from "../../../util/FormUtil";
import { toast, ToastContainer } from "react-toastify";
import { FiTruck, FiMapPin, FiEdit2, FiX, FiCheck, FiUser, FiPhone, FiAlertCircle } from "react-icons/fi";

export default function ShopShipping(){
    const [address, setAddress] = useState()
    const [open, setOpen] = useState(false);
    const [error, setError] = useState("");
    const [newAddress, setNewAddress] = useState({
        senderName: "",
        phoneNumber: "",
        detail: "",
        ward: "",
        district: "",
        province: "",
    });
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);

    const handleChangeNewAddress = (e) => {
        const { name, value } = e.target;
        const nextValue = name === "phoneNumber" ? sanitizePhoneNumber(value) : value;
        setNewAddress((prev) => ({ ...prev, [name]: nextValue }));
        if (name === "province") {
            setNewAddress((prev) => ({ ...prev, province: nextValue, district: "", ward: "" }));
        }
        if (name === "district") {
            setNewAddress((prev) => ({ ...prev, district: nextValue, ward: "" }));
        }
    };

    const handleAddNewAddress = () => {
        const { senderName, phoneNumber, detail, ward, district, province } = newAddress;
        if (!senderName || !phoneNumber || !detail || !ward || !district || !province) {
            setError("Vui lòng điền đầy đủ thông tin!");
            return;
        }
        if (!/^0\d+$/.test(phoneNumber.trim())) {
            setError("Số điện thoại phải bắt đầu bằng số 0 và chỉ chứa chữ số!");
            return;
        }
        setError("");

        const selectedProvince = provinces.find((p) => p.name === province);
        const selectedDistrict = districts.find((d) => d.name === district);
        const selectedWard = wards.find((w) => w.name === ward);
        const addressPayload = {
            ...newAddress,
            province: selectedProvince ? { id: selectedProvince.id, name: selectedProvince.name } : province,
            district: selectedDistrict ? { id: selectedDistrict.id, name: selectedDistrict.name } : district,
            ward: selectedWard ? { id: selectedWard.id, name: selectedWard.name } : ward,
        };

        fetchWithAuth(`${BASE_API_URL}/v1/shop/profile/update_address`, window.location, true, {
            method: "POST",
            body: JSON.stringify(addressPayload),
            headers: { 'content-type': 'application/json' }
        })
            .then(res => {
                if (res.ok) {
                    setOpen(false)
                    fetchShopAddress()
                    toast.success("Cập nhật địa chỉ thành công!")
                }
            })
    };

    const fetchShopAddress = async () => {
        fetchWithAuth(`${BASE_API_URL}/v1/shop/profile/get_address`, window.location, true)
            .then(res => res.json())
            .then(data => setAddress(data))
    };

    const fetchProvinceList = () => {
        fetchWithAuth(`${BASE_API_URL}/v1/address/provinces`, window.location, true)
            .then(res => res.json())
            .then(res => { setProvinces(res); setDistricts([]); setWards([]) })
    };

    const fetchDistrictList = (provinceId) => {
        fetchWithAuth(`${BASE_API_URL}/v1/address/districts?provinceId=${provinceId}`, window.location, true)
            .then(res => res.json())
            .then(res => { setDistricts(res); setWards([]) })
    };

    const fetchWardList = (districtId) => {
        fetchWithAuth(`${BASE_API_URL}/v1/address/wards?districtId=${districtId}`, window.location, true)
            .then(res => res.json())
            .then(res => setWards(res))
    };

    useEffect(() => { fetchShopAddress() }, []);
    useEffect(() => { if (open) fetchProvinceList() }, [open]);
    useEffect(() => {
        if (newAddress.province) {
            const selectedProvince = provinces.find((p) => p.name === newAddress.province);
            if (selectedProvince) fetchDistrictList(selectedProvince.id)
        }
    }, [newAddress.province, provinces]);
    useEffect(() => {
        if (newAddress.district) {
            const selectedDistrict = districts.find((d) => d.name === newAddress.district);
            if (selectedDistrict) fetchWardList(selectedDistrict.id)
        }
    }, [newAddress.district, districts]);

    const openEditModal = () => {
        if (address) {
            setNewAddress({
                senderName: address.senderName || "",
                phoneNumber: address.phoneNumber || "",
                detail: address.detail || "",
                ward: address.ward?.name || "",
                district: address.district?.name || "",
                province: address.province?.name || "",
            });
        }
        setOpen(true);
    };

    const selectClass = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 transition-colors bg-white disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer";
    const inputClass = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 transition-colors";

    return (
        <div className="mx-auto w-full max-w-5xl overflow-x-hidden">
            {/* Page header */}
            <div className="mb-5">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FiTruck className="text-orange-500" size={20} />
                    Cài đặt vận chuyển
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">Địa chỉ gửi hàng mặc định của cửa hàng</p>
            </div>

            {/* Pickup address card */}
            <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <FiMapPin size={14} className="text-orange-500" />
                        Địa chỉ lấy hàng
                    </h2>
                    <button
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-orange-200 px-3 py-2 text-xs font-medium text-orange-500 transition-colors hover:bg-orange-50 sm:w-auto sm:py-1.5"
                        onClick={openEditModal}
                    >
                        <FiEdit2 size={12} />
                        {address ? "Cập nhật" : "Thêm địa chỉ"}
                    </button>
                </div>

                <div className="p-5 sm:p-6">
                    {address ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex items-center gap-2">
                                <FiUser size={14} className="text-gray-400 shrink-0" />
                                <span className="font-semibold text-gray-800 text-sm">{address.senderName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <FiPhone size={14} className="text-gray-400 shrink-0" />
                                <span className="text-sm text-gray-600">{address.phoneNumber}</span>
                            </div>
                            <div className="flex items-start gap-2 sm:col-span-2">
                                <FiMapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-gray-700">{address.detail}</p>
                                    <p className="text-sm text-gray-500">
                                        {address.ward?.name}, {address.district?.name}, {address.province?.name}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-h-[220px] flex-col items-center justify-center px-4 py-10 text-center text-gray-400 sm:min-h-[240px] sm:py-14">
                            <FiMapPin size={32} className="mb-3 text-gray-300" />
                            <p className="text-sm font-medium text-gray-600 mb-1">Chưa có địa chỉ lấy hàng</p>
                            <p className="text-xs text-gray-400">Thêm địa chỉ để bắt đầu nhận đơn hàng</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit modal */}
            {open && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-gray-800">Địa chỉ lấy hàng</h3>
                            <button
                                className="p-1.5 hover:bg-gray-200 rounded-full transition-colors cursor-pointer text-gray-500"
                                onClick={() => setOpen(false)}
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Họ tên người gửi</label>
                                    <input
                                        type="text"
                                        name="senderName"
                                        placeholder="Nguyễn Văn A..."
                                        value={newAddress.senderName}
                                        onChange={handleChangeNewAddress}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Số điện thoại</label>
                                    <input
                                        type="tel"
                                        name="phoneNumber"
                                        placeholder="0901 234 567..."
                                        value={newAddress.phoneNumber}
                                        onChange={handleChangeNewAddress}
                                        inputMode="numeric"
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tỉnh / Thành phố</label>
                                <select name="province" value={newAddress.province} onChange={handleChangeNewAddress} className={selectClass}>
                                    <option value="">Chọn tỉnh / thành phố</option>
                                    {provinces.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Quận / Huyện</label>
                                    <select name="district" value={newAddress.district} onChange={handleChangeNewAddress} className={selectClass} disabled={!newAddress.province}>
                                        <option value="">Chọn quận / huyện</option>
                                        {districts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Xã / Phường</label>
                                    <select name="ward" value={newAddress.ward} onChange={handleChangeNewAddress} className={selectClass} disabled={!newAddress.district}>
                                        <option value="">Chọn xã / phường</option>
                                        {wards.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Địa chỉ chi tiết</label>
                                <input
                                    type="text"
                                    name="detail"
                                    placeholder="Số nhà, tên đường, tổ..."
                                    value={newAddress.detail}
                                    onChange={handleChangeNewAddress}
                                    className={inputClass}
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
                                    <FiAlertCircle size={13} />
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Modal footer */}
                        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50">
                            <button
                                className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => setOpen(false)}
                            >
                                Hủy
                            </button>
                            <button
                                className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors cursor-pointer"
                                onClick={handleAddNewAddress}
                            >
                                <FiCheck size={14} />
                                Lưu địa chỉ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ToastContainer position="bottom-right" />
        </div>
    );
}
