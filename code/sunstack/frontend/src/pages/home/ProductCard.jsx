import React from 'react';
import { AiFillStar } from 'react-icons/ai';
import { Link } from 'react-router-dom';
import { CiLocationOn } from "react-icons/ci";

export default function ProductCard({ product }) {
  const formatPrice = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <Link
      to={`/product/${encodeURIComponent(product.name.replace(/\s+/g, "-"))}.${product.id}`}
      className="group bg-white rounded-2xl overflow-hidden border border-gray-100/80 hover:border-transparent hover:shadow-[0_12px_40px_-8px_rgba(238,77,45,0.18)] hover:-translate-y-1 transition-all duration-300 flex flex-col w-full"
    >
      {/* Thumbnail — fixed aspect ratio using aspect-square */}
      <div className="relative w-full aspect-square overflow-hidden bg-gray-50 rounded-2xl">
        <img
          src={product.thumbnailUrl}
          alt={product.name}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-500 ease-out"
        />
        {product.sold > 100 && (
          <span className="absolute top-2.5 left-2.5 bg-primary text-white text-[9px] font-display font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md shadow-primary/30">
            Hot
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>

      {/* Info */}
      <div className="p-3.5 flex flex-col flex-1">
        <h3
          className="text-[12.5px] leading-[1.5] text-gray-600 line-clamp-2 min-h-[2.6rem] mb-3 font-medium group-hover:text-gray-900 transition-colors"
          title={product.name}
        >
          {product.name}
        </h3>

        {/* Price — bold & prominent */}
        <div className="flex flex-col mt-auto gap-0.5 mb-2.5">
          <span className="text-[10px] text-gray-400 font-medium tracking-wide">Giá chỉ từ</span>
          <span className="text-[17px] font-display font-black text-primary leading-none tracking-tight">
            {formatPrice(product.price)}
          </span>
        </div>

        {/* Rating + Location */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2.5 border-t border-gray-100 mt-1">
          {product.averageRating > 0 ? (
            <div className="flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-full">
              <AiFillStar size={11} className="text-amber-400" />
              <span className="font-bold text-amber-600 text-[11px]">{product.averageRating.toFixed(1)}</span>
            </div>
          ) : (
            <span className="text-gray-400">Chưa có đánh giá</span>
          )}
          <span className="text-gray-400">
            Đã bán {product.sold >= 1000 ? `${(product.sold / 1000).toFixed(1)}k` : product.sold}
          </span>
        </div>
      </div>
    </Link>
  );
};