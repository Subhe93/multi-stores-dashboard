import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Multi-Stores Dashboard</h1>
        <div className="flex flex-col gap-4">
          <Link
            href="/provider"
            className="px-8 py-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
          >
            Provider Dashboard
          </Link>
          <Link
            href="/creator"
            className="px-8 py-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition"
          >
            Creator Dashboard
          </Link>
          <Link
            href="/admin"
            className="px-8 py-4 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-900 transition"
          >
            Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
