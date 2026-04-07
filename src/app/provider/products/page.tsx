import Link from 'next/link';

export default function ProviderProducts() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Link
          href="/provider/products/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + Add Product
        </Link>
      </div>

      <div className="bg-white rounded-xl border p-12 text-center">
        <p className="text-gray-400 mb-4">No products yet</p>
        <Link
          href="/provider/products/new"
          className="text-blue-600 font-medium text-sm hover:underline"
        >
          Add your first product
        </Link>
      </div>
    </div>
  );
}
