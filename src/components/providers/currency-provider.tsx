'use client'

// Moneda base de la organización para los componentes cliente. La carga el
// layout del dashboard; fuera de él (o sin organización) es CLP.

import { createContext, useContext } from 'react'
import { normalizeCurrency, type Currency } from '@/lib/money'

const CurrencyContext = createContext<Currency>('CLP')

export function CurrencyProvider({ currency, children }: { currency: string | null | undefined; children: React.ReactNode }) {
  return <CurrencyContext.Provider value={normalizeCurrency(currency)}>{children}</CurrencyContext.Provider>
}

export function useCurrency(): Currency {
  return useContext(CurrencyContext)
}
