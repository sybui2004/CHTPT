import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BASE_API_URL } from "../../../constants";

export default function HandlePaymentReturn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("Dang xac nhan thanh toan...");

  useEffect(() => {
    const confirmPayment = async () => {
      try {
        const res = await fetch(`${BASE_API_URL}/v1/payment/vnpay/return?${searchParams.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.status !== "success") {
          setMessage("Thanh toan khong thanh cong. Dang chuyen ve don hang...");
          setTimeout(() => navigate("/account/orders?type=1", { replace: true }), 1200);
          return;
        }
        setMessage("Thanh toan thanh cong. Dang chuyen ve don cho van chuyen...");
        setTimeout(() => navigate("/account/orders?type=3", { replace: true }), 800);
      } catch {
        setMessage("Khong the xac nhan thanh toan. Dang chuyen ve don hang...");
        setTimeout(() => navigate("/account/orders?type=1", { replace: true }), 1200);
      }
    };

    confirmPayment();
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />
        <h2 className="text-xl font-bold text-gray-800">Xac nhan thanh toan</h2>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}
