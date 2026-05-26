import React from 'react';
import ProductCard from '../ProductCard';

export default function ProductGrid({products}){

  return (
    <div className="grid grid-cols-2 gap-2 animate-fade-in sm:grid-cols-3 sm:gap-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {products && products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
        />
      ))}
    </div>
  );
};
