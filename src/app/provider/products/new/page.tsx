'use client';

import { ProductForm } from '@/components/product/ProductForm';

export default function NewProduct() {
  return <ProductForm mode="create" backUrl="/provider/products" />;
}
