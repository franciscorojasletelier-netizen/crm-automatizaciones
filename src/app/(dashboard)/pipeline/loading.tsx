function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
}
export default function PipelineLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 min-h-full bg-slate-50">
      <div className="flex items-start justify-between">
        <div className="space-y-1"><Skeleton className="h-7 w-28" /><Skeleton className="h-4 w-36" /></div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="min-w-[230px] space-y-2">
            <Skeleton className="h-6 rounded-lg" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  )
}
