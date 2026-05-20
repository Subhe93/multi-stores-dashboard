'use client';

import { useParams } from 'next/navigation';
import { CategoryForm } from '@/components/creator/categories/CategoryForm';

export default function EditCategoryPage() {
  const { id } = useParams<{ id: string }>();
  return <CategoryForm mode="edit" initialId={id} />;
}
