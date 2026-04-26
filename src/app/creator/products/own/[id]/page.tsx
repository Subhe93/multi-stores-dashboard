'use client';

import { useParams } from 'next/navigation';
import { ProductForm } from '@/components/product/ProductForm';

export default function CreatorEditOwnProductPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <ProductForm
      mode="edit"
      productId={id}
      backUrl="/creator/products"
      postCreateUrl="/creator/products/own"
    />
  );
}
