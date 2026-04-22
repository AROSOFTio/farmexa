export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="section-title">{title}</h1>
          <p className="section-subtitle">This module is under construction</p>
        </div>
      </div>
      <div className="card p-12 text-center flex flex-col items-center justify-center bg-neutral-50/50">
        <h3 className="text-lg font-semibold text-neutral-800">Coming Soon</h3>
        <p className="text-sm text-neutral-500 mt-1">The {title} functionality is being built and will be available shortly.</p>
      </div>
    </div>
  )
}
