function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
}
export default function TareasLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6 min-h-full bg-slate-50">
      <div className="space-y-1"><Skeleton className="h-7 w-24" /><Skeleton className="h-4 w-44" /></div>
      <div className="grid grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}
