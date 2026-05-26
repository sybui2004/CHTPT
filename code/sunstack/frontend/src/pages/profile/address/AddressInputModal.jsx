import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../../util/AuthUtil";
import { BASE_API_URL } from "../../../constants";
import { sanitizePhoneNumber } from "../../../util/FormUtil";
import { toast } from "react-toastify";
import { FiCheck, FiMapPin, FiPhone, FiUser, FiX } from "react-icons/fi";

export default function AddressInputModal({info, setInfo, setClose, onSuccess}){

    const isNew = info.addressId === null || info.addressId === undefined
    const disabledPrimary = info.primary === true
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);

    const fetchProvinceList = () => {
        fetchWithAuth(`${BASE_API_URL}/v1/address/provinces`, window.location, true)
            .then(res => res.json())
            .then(res => {
              setProvinces(res)
              setDistricts([])
              setWards([])
            })
    }

    const fetchDistrictList = (provinceId) => {
        fetchWithAuth(`${BASE_API_URL}/v1/address/districts?provinceId=${provinceId}`, window.location, true)
            .then(res => {
              if(res.ok) return res.json()
              return []
            })
            .then(res => {
              setDistricts(res)
              setWards([])
            })
    }

    const fetchWardList = (districtId) => {
        fetchWithAuth(`${BASE_API_URL}/v1/address/wards?districtId=${districtId}`, window.location, true)
            .then(res => {
              if(res.ok) return res.json()
              return []
            })
            .then(res => setWards(res))
    }

    useEffect(() => {
        fetchProvinceList()
    }, [])
    
    useEffect(() => {
        if(info.province){
            const selectedProvince = provinces.find((province) => province.name === info.province);
            const provinceId = selectedProvince ? selectedProvince.id : 0;
            fetchDistrictList(provinceId)
        }
    }, [info.province])

    useEffect(() => {
        if(info.district){
            const selectedDistrict = districts.find((district) => district.name === info.district);
            const provinceId = selectedDistrict ? selectedDistrict.id : 0;
            fetchWardList(provinceId)
        }
    }, [info.district])

    const handleChangeInfo = (e) => {
        const { name, type, value, checked } = e.target;
        const nextValue = name === "phoneNumber" ? sanitizePhoneNumber(value) : value;
    
        setInfo((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : nextValue
        }));
    
        // 🛑 Nếu chọn tỉnh, tìm ID từ danh sách `cities`
        if (name === "province") {
        setInfo((prev) => ({
            ...prev,
            province: value, // Vẫn lưu tên
            district: "",
            ward: ""
        }));
        }
        if (name === "district") {
        setInfo((prev) => ({
            ...prev,
            district: value,
            ward: ""
        }));
        }
    };

    const handleSubmit = () => {
        const { receiverName, phoneNumber, detail, ward, district, province } = info;
        if (!receiverName || !phoneNumber || !detail || !ward || !district || !province) {
            toast.error("Vui lòng điền đầy đủ thông tin!");
            return;
        }

        if (!/^0\d+$/.test(phoneNumber.trim())) {
            toast.error("Số điện thoại phải bắt đầu bằng số 0 và chỉ chứa chữ số!");
            return;
        }

        const addressPayload = {
            ...info,
            receiverName,
            phoneNumber,
            detail,
            province,
            district,
            ward,
            primary: Boolean(info.primary),
            full_name: receiverName,
            phone: phoneNumber,
            address: detail,
            province_name: province,
            district_name: district,
            ward_name: ward,
            is_default: Boolean(info.primary)
        }

        if(isNew) {
            fetchWithAuth(`${BASE_API_URL}/v1/user/address/add`, window.location, true, {
                method: "POST",
                body: JSON.stringify(addressPayload),
                headers: {
                'content-type': 'application/json'
                }
            })
                .then(async res => {
                  const data = await res.json().catch(() => ({}))
                  if(!res.ok || data.message){
                    toast.error(data.message || data.detail || "Có lỗi xảy ra, vui lòng thử lại sau!")
                  }
                  else{
                      toast.success(`Thêm địa chỉ thành công`)
                      onSuccess()
                  }
                })
        }
        else{
            fetchWithAuth(`${BASE_API_URL}/v1/user/address/update`, window.location, true, {
                method: "POST",
                body: JSON.stringify(addressPayload),
                headers: {
                    'content-type': 'application/json'
                }
            })
                .then(async res => {
                    const data = await res.json().catch(() => ({}))
                    if(!res.ok || data.message){
                        toast.error(data.message || data.detail || "Có lỗi xảy ra, vui lòng thử lại sau!")
                    }
                    else{
                        toast.success(`Cập nhật địa chỉ thành công`)
                        onSuccess()
                    }
                })
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-2xl shadow-orange-950/10">
            <div className="flex items-start justify-between gap-4 border-b border-orange-50 bg-gradient-to-r from-orange-50 to-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">SunStack Address</p>
                <h3 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-800">
                  <FiMapPin className="text-primary" size={20} />
                  {isNew ? 'Địa chỉ mới' : 'Cập nhật địa chỉ'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">Thông tin này dùng để giao hàng nhanh và chính xác hơn.</p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white hover:text-primary"
                onClick={setClose}
                aria-label="Đóng"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                    <FiUser size={13} /> Người nhận
                  </span>
                  <input
                    type="text"
                    name="receiverName"
                    placeholder="Họ tên người nhận"
                    value={info.receiverName}
                    onChange={handleChangeInfo}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-orange-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                    <FiPhone size={13} /> Số điện thoại
                  </span>
                  <input
                    type="tel"
                    name="phoneNumber"
                    placeholder="Số điện thoại"
                    value={info.phoneNumber}
                    onChange={handleChangeInfo}
                    inputMode="numeric"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-orange-100"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-500">Tỉnh/Thành phố</span>
                  <select
                    name="province"
                    value={info.province}
                    onChange={handleChangeInfo}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-orange-100"
                  >
                    <option value="">Chọn Tỉnh/Thành phố</option>
                    {provinces.map((province) => (
                      <option key={province.id} value={province.name}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-500">Quận/Huyện</span>
                  <select
                    name="district"
                    value={info.district}
                    onChange={handleChangeInfo}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-400 focus:border-primary focus:ring-4 focus:ring-orange-100"
                    disabled={!info.province}
                  >
                    <option value="">Chọn Quận/Huyện</option>
                    {districts.map((district) => (
                      <option key={district.id} value={district.name}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-500">Xã/Phường</span>
                  <select
                    name="ward"
                    value={info.ward}
                    onChange={handleChangeInfo}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-400 focus:border-primary focus:ring-4 focus:ring-orange-100"
                    disabled={!info.district}
                  >
                    <option value="">Chọn Xã/Phường</option>
                    {wards.map((ward) => (
                      <option key={ward.id} value={ward.name}>
                        {ward.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">Địa chỉ chi tiết</span>
                <input
                  type="text"
                  name="detail"
                  placeholder="Số nhà, tên đường..."
                  value={info.detail}
                  onChange={handleChangeInfo}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                disabledPrimary ? "border-orange-100 bg-orange-50/60 text-gray-500" : "border-gray-100 bg-gray-50 text-gray-700 hover:border-orange-200"
              }`}>
                <input
                  disabled={disabledPrimary}
                  type="checkbox"
                  name="primary"
                  checked={info.primary}
                  onChange={handleChangeInfo}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-60"
                />
                <span className="font-medium">Đặt làm địa chỉ mặc định</span>
              </label>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  onClick={setClose}
                >
                  Hủy
                </button>
                <button
                    type="button"
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition-colors hover:bg-orange-600"
                    onClick={() => handleSubmit()}
                >
                  <FiCheck size={16} />
                  {isNew ? 'Thêm địa chỉ' : 'Cập nhật'}
                </button>
              </div>
            </div>
          </div>
        </div>
    )
}
