'use client';

import { ProductForm } from '@/components/product/ProductForm';

export default function CreatorNewOwnProductPage() {
  return (
    <ProductForm
      mode="create"
      backUrl="/creator/products"
      postCreateUrl="/creator/products/own"
    />
  );
}
