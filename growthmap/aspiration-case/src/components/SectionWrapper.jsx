export default function SectionWrapper({ title, number, children }) {
  return (
    <section className="border border-border rounded-lg overflow-hidden">
      <div className="bg-bg-section border-b border-border px-6 py-3 flex items-center gap-3">
        {number && (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-blue text-white text-xs font-bold">
            {number}
          </span>
        )}
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}
