import { useState, useEffect } from "react";
import { fetchWithAuth } from "../../../util/AuthUtil";
import { BASE_API_URL } from "../../../constants";
import { toast, ToastContainer } from "react-toastify";
import Modal from "../../common/Modal";
import AddressInputModal from "./AddressInputModal";
import { FiMapPin, FiPlus, FiEdit2, FiTrash2, FiStar, FiPhone, FiUser } from "react-icons/fi";

export default function AddressPage(){
    const [addressList, setAddressList] = useState([]);
    const [newAddress] = useState({
        receiverName: "",
        phoneNumber: "",
        detail: "",
        ward: "",
        district: "",
        province: "",
        primary: false
    });
    const [modalInfo, setModalInfo] = useState(null);
    const [deleteAddress, setDeleteAddress] = useState(null);

    const getAddressPartName = (part) => {
        if (!part) return "";
        if (typeof part === "string") return part;
        return part.name || "";
    };

    const formatAddressLine = (addr) => {
        return [addr.ward, addr.district, addr.province]
            .map(getAddressPartName)
            .filter(Boolean)
            .join(", ");
    };

    const fetchAddressList = async () => {
        fetchWithAuth(`${BASE_API_URL}/v1/user/address/get-list`, window.location, true)
            .then(res => res.json())
            .then(data => setAddressList(data))
    };

    const setPrimary = (addressId) => {
        fetchWithAuth(`${BASE_API_URL}/v1/user/address/set-primary?addressId=${addressId}`, window.location, true, {
            method: "POST"
        })
            .then(res => res.json())
            .then(res => {
                if (res.message) toast.error(res.message);
                else {
                    fetchAddressList();
                    toast.success("Đã đặt địa chỉ mặc định!");
                }
            });
    };

    const handleDeleteAddress = (addressId) => {
        fetchWithAuth(`${BASE_API_URL}/v1/user/address/delete?addressId=${addressId}`, window.location, true, {
            method: "POST"
        })
            .then(res => res.json())
            .then(res => {
                if (res.message) toast.error(res.message);
                else {
                    setAddressList(prev => prev.filter(addr => addr.id !== addressId));
                    toast.success("Xóa địa chỉ thành công!");
                }
            });
    };

    useEffect(() => { fetchAddressList() }, []);

    return (
        <div className="w-full">
            {/* Page header */}
            <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FiMapPin className="text-primary" size={20} />
                        Địa chỉ của tôi
                    </h1>
                    <p className="text-sm text-gray-400 mt-0.5">Quản lý danh sách địa chỉ nhận hàng</p>
                </div>
                <button
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
                    onClick={() => setModalInfo(newAddress)}
                >
                    <FiPlus size={14} className="sm:hidden" />
                    <FiPlus size={16} className="hidden sm:block" />
                    <span>Thêm địa chỉ</span>
                </button>
            </div>

            {/* Address list */}
            {addressList.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                        <FiMapPin size={28} className="text-primary" />
                    </div>
                    <p className="text-gray-600 font-medium mb-1">Chưa có địa chỉ nào</p>
                    <p className="text-gray-400 text-sm mb-5">Thêm địa chỉ để dễ dàng đặt hàng</p>
                    <button
                        className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm"
                        onClick={() => setModalInfo(newAddress)}
                    >
                        <FiPlus size={15} /> Thêm địa chỉ đầu tiên
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {addressList.map((addr) => (
                        <div
                            key={addr.id}
                            className={`bg-white rounded-xl border shadow-sm transition-all duration-200 overflow-hidden ${
                                addr.primary ? "border-primary/30 ring-1 ring-primary/10" : "border-gray-100"
                            }`}
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        {/* Receiver info */}
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            <span className="font-semibold text-gray-800 flex items-center gap-1">
                                                <FiUser size={13} className="text-gray-400" />
                                                {addr.receiverName}
                                            </span>
                                            <span className="text-gray-400 text-sm flex items-center gap-1">
                                                <FiPhone size={12} />
                                                {addr.phoneNumber}
                                            </span>
                                            {addr.primary && (
                                                <span className="flex items-center gap-1 text-xs bg-orange-50 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-semibold">
                                                    <FiStar size={10} className="fill-current" />
                                                    Mặc định
                                                </span>
                                            )}
                                        </div>

                                        {/* Address detail */}
                                        <p className="text-sm text-gray-600 leading-relaxed">
                                            {addr.detail}
                                        </p>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            {formatAddressLine(addr)}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <div className="flex items-center gap-1">
                                            <button
                                                className="flex items-center gap-1 text-xs text-primary hover:bg-orange-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                onClick={() => setModalInfo({
                                                    addressId: addr.id,
                                                    receiverName: addr.receiverName,
                                                    phoneNumber: addr.phoneNumber,
                                                    detail: addr.detail,
                                                    ward: getAddressPartName(addr.ward),
                                                    district: getAddressPartName(addr.district),
                                                    province: getAddressPartName(addr.province),
                                                    primary: addr.primary
                                                })}
                                            >
                                                <FiEdit2 size={12} /> Sửa
                                            </button>
                                            {!addr.primary && (
                                                <button
                                                    className="flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                    onClick={() => setDeleteAddress(addr.id)}
                                                >
                                                    <FiTrash2 size={12} /> Xóa
                                                </button>
                                            )}
                                        </div>
                                        {!addr.primary && (
                                            <button
                                                className="text-xs border border-gray-200 text-gray-500 hover:border-primary hover:text-primary px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                onClick={() => setPrimary(addr.id)}
                                            >
                                                Đặt làm mặc định
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                open={deleteAddress !== null}
                title="Bạn muốn xóa địa chỉ này?"
                content="Hành động này không thể hoàn tác"
                onClose={() => setDeleteAddress(null)}
                onSucess={() => {
                    handleDeleteAddress(deleteAddress);
                    setDeleteAddress(null);
                }}
            />

            {modalInfo && (
                <AddressInputModal
                    info={modalInfo}
                    setInfo={setModalInfo}
                    setClose={() => setModalInfo(null)}
                    onSuccess={() => {
                        setModalInfo(null);
                        fetchAddressList();
                    }}
                />
            )}

            <ToastContainer position="bottom-right" />
        </div>
    );
};
