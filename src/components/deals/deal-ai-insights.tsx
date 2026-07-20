'use client'

import { useState } from 'react'
import { Sparkles, Loader2, AlertTriangle, TrendingUp, RefreshCw, Globe, Target } from 'lucide-react'

interface Insights {
  resumen: string
  contexto_empresa?: string
  enfoque_recomendado?: string
  proxima_accion: string
  riesgo: 'bajo' | 'medio' | 'alto'
  razon_riesgo: string
}

const RIESGO_STYLE: Record<string, { badge: string; label: string }> = {
  bajo:  { badge: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200', label: 'Riesgo bajo' },
  medio: { badge: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',       label: 'Riesgo medio' },
  alto:  { badge: 'bg-red-100 text-red-700 ring-1 ring-red-200',             label: 'Riesgo alto' },
}

export default function DealAiInsights({ dealId }: { dealId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [insights, setInsights] = useState<Insights | null>(null)

  async function analyze() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/deal-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al analizar'); return }
      setInsights(data.insights)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100"
        style={{ background: 'linear-gradient(135deg, #f5f3ff, #eef2ff)' }}>
        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
        </div>
        <h2 className="flex-1 text-sm font-semibold text-slate-900">Análisis IA</h2>
        {insights && !loading && (
          <button onClick={analyze} title="Volver a analizar"
            className="p-1.5 rounded-lg hover:bg-white/60 text-slate-400 hover:text-violet-600 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-4">
        {!insights && !loading && !error && (
          <div className="text-center py-2 space-y-3">
            <p className="text-xs text-slate-400">
              Investiga la empresa en la web, resume el historial del deal, sugiere el enfoque de venta y evalúa el riesgo.
            </p>
            <button onClick={analyze}
              className="inline-flex items-center gap-2 text-xs font-semibold text-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
              <Sparkles className="w-3.5 h-3.5" />
              Analizar deal
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-violet-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-medium">Investigando la empresa y analizando el deal…</span>
          </div>
        )}

        {error && !loading && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
            <button onClick={analyze}
              className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">
              Reintentar
            </button>
          </div>
        )}

        {insights && !loading && (
          <div className="space-y-3.5">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Resumen</p>
              <p className="text-sm text-slate-700 leading-relaxed">{insights.resumen}</p>
            </div>

            {insights.contexto_empresa && (
              <div className="bg-sky-50/60 border border-sky-100 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Sobre la empresa
                </p>
                <p className="text-xs text-sky-900 leading-relaxed">{insights.contexto_empresa}</p>
              </div>
            )}

            {insights.enfoque_recomendado && (
              <div className="bg-violet-50/60 border border-violet-100 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Enfoque de venta
                </p>
                <p className="text-xs text-violet-900 leading-relaxed">{insights.enfoque_recomendado}</p>
              </div>
            )}

            <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Próxima acción sugerida
              </p>
              <p className="text-sm font-medium text-indigo-900">{insights.proxima_accion}</p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${RIESGO_STYLE[insights.riesgo]?.badge ?? RIESGO_STYLE.medio.badge}`}>
                {RIESGO_STYLE[insights.riesgo]?.label ?? insights.riesgo}
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">{insights.razon_riesgo}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
