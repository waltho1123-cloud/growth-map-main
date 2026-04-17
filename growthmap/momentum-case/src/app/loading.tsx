export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header skeleton */}
      <header className="px-4 sm:px-6 py-4 bg-white/70 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              <span className="text-[#00A651]">BW</span> 成長藍圖實作平台
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">建立自然增長情境 (Momentum Case)</p>
          </div>
        </div>
      </header>

      {/* Step bar skeleton */}
      <nav className="px-4 sm:px-6 py-3 bg-white/70 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-20 sm:w-28 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      </nav>

      {/* Content skeleton */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#00A651] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">載入中…</p>
        </div>
      </main>
    </div>
  );
}
