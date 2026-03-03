export default function SectionWrapper({ title, number, children }) {
  return (
    <section className="glass-card rounded-2xl overflow-hidden">
      <div className="bg-white/30 border-b border-white/40 px-6 py-3 flex items-center gap-3">
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
