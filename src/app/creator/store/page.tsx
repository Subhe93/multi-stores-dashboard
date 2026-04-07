'use client';

export default function CreatorStore() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Store</h1>

      <div className="space-y-6 max-w-3xl">
        {/* Store Info */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Store Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="My Store" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store URL (subdomain)</label>
              <div className="flex items-center">
                <input type="text" className="flex-1 px-3 py-2 border rounded-l-lg text-sm" placeholder="my-store" />
                <span className="px-3 py-2 bg-gray-100 border border-l-0 rounded-r-lg text-sm text-gray-500">.platform.com</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Tell customers about your store..." />
            </div>
          </div>
        </div>

        {/* Theme */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Theme</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
              <input type="color" defaultValue="#3B82F6" className="w-full h-10 rounded-lg cursor-pointer" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
              <input type="color" defaultValue="#6366F1" className="w-full h-10 rounded-lg cursor-pointer" />
            </div>
          </div>
        </div>

        {/* Languages */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Languages</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Language</label>
              <select className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="tr">Turkish</option>
                <option value="de">German</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Languages</label>
              <p className="text-xs text-gray-400 mb-2">Select languages your store supports</p>
              <div className="flex flex-wrap gap-2">
                {['English', 'Arabic', 'Turkish', 'German', 'French'].map((lang) => (
                  <label key={lang} className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" className="rounded text-blue-600" />
                    {lang}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          Save Changes
        </button>
      </div>
    </div>
  );
}
