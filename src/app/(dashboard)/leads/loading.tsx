function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />
}
export default function LeadsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 min-h-full bg-slate-50">
      <div className="flex items-start justify-between">
        <div className="space-y-1"><Skeleton className="h-7 w-24" /><Skeleton className="h-4 w-40" /></div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-14 rounded-lg" />
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  )
}
