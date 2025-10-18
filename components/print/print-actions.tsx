'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type Props = {
  autoPrint?: boolean
  mode: 'a4' | 'cupom'
}

export default function PrintActions({ autoPrint = false, mode }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (autoPrint) {
      // delay pequeno para garantir render/hidratação antes de chamar print
      timeoutRef.current = window.setTimeout(() => window.print(), 300)
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [autoPrint])

  function handlePrint() {
    window.print()
  }

  function toggleMode() {
    const params = new URLSearchParams(searchParams ? String(searchParams) : '')
    const nextMode = mode === 'cupom' ? 'a4' : 'cupom'
    params.set('mode', nextMode)
    if (autoPrint) params.set('autoPrint', '1')
    else params.delete('autoPrint')

    // replace para não empilhar histórico
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <div className="print-actions" role="toolbar" aria-label="Ações de impressão" style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        className="btn"
        onClick={handlePrint}
        aria-label="Imprimir"
      >
        Imprimir
      </button>

      <button
        type="button"
        className="btn"
        onClick={toggleMode}
        aria-label={`Alternar modo (atualmente ${mode})`}
      >
        Alternar modo ({mode === 'cupom' ? 'a4' : 'cupom'})
      </button>
    </div>
  )
}