'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { CategoryForm } from '@/components/creator/categories/CategoryForm';

/** Reads `?parent=<id>` (set by "Add sub-collection" on the list page). */
function NewCategoryForm() {
  const searchParams = useSearchParams();
  const parent = searchParams.get('parent');
  return <CategoryForm mode="create" initialParentId={parent || null} />;
}

export default function NewCategoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <NewCategoryForm />
    </Suspense>
  );
}
