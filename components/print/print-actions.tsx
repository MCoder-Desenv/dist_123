'use client'

import { useEffect } from 'react'

type Props = {
  autoPrint?: boolean
  mode: 'a4' | 'cupom'
}

export default function PrintActions({ autoPrint, mode }: Props) {
  useEffect(() => {
    if (autoPrint) {
      setTimeout(() => window.print(), 300)
    }
  }, [autoPrint])

  return (
    <div className="print-actions">
      <button
        className="btn"
        onClick={() => window.print()}
      >
        Imprimir
      </button>
      <a
        className="btn"
        href={`?mode=${mode === 'cupom' ? 'a4' : 'cupom'}${autoPrint ? '&autoPrint=1' : ''}`}
      >
        Alternar modo
      </a>
    </div>
  )
}
