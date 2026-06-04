import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { XMarkIcon, CameraIcon } from '@heroicons/react/24/outline'

const SCANNER_DIV = 'bella-barcode-scanner'

const FORMATS = [
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
]

export default function MobileBarcodeScanner({ onScan, onClose }) {
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const scannerRef  = useRef(null)
  const startedRef  = useRef(false)  // guard StrictMode double-invoke
  const scannedRef  = useRef(false)  // prevent multiple scan callbacks

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const scanner = new Html5Qrcode(SCANNER_DIV, { verbose: false })
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 100 }, formatsToSupport: FORMATS },
      (decodedText) => {
        // Guard: only handle the first successful scan
        if (scannedRef.current) return
        scannedRef.current = true

        // Stop scanner first so the camera releases cleanly,
        // then hand the UPC to the parent (which unmounts us).
        scanner.stop()
          .catch(() => {})
          .finally(() => onScan(decodedText.trim()))
      },
      () => {} // per-frame "not found" — ignore
    )
      .then(() => setReady(true))
      .catch((err) => {
        const msg = String(err).toLowerCase()
        if (msg.includes('permission') || msg.includes('notallowed')) {
          setError('Camera permission denied.\n\nIn Safari: Settings → Safari → Camera → Allow.')
        } else {
          setError('Could not start camera.\nMake sure you are using the HTTPS address.')
        }
      })

    return () => {
      // Only stop if we haven't already stopped via a successful scan
      if (!scannedRef.current) {
        scannerRef.current?.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">

      {/* Top bar */}
      <div className="safe-top bg-black shrink-0">
        <div className="flex items-center justify-between px-4" style={{ height: 52 }}>
          <div className="flex items-center gap-2">
            <CameraIcon className="w-5 h-5 text-white/60" />
            <span className="text-white font-semibold text-base">Scan Barcode</span>
          </div>
          <button onClick={onClose} className="p-2 text-white/60 active:text-white rounded-xl">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Camera viewport */}
      <div className="flex-1 relative overflow-hidden bg-black">
        <div id={SCANNER_DIV} style={{ width: '100%', height: '100%' }} />

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/40 text-sm animate-pulse">Starting camera…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-8 bg-black">
            <div className="bg-neutral-900 rounded-2xl p-6 text-center max-w-xs">
              <CameraIcon className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/70 text-sm whitespace-pre-line leading-relaxed">{error}</p>
              <button
                onClick={onClose}
                className="mt-5 px-5 py-2.5 bg-warm-500 text-white rounded-xl text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="safe-bottom bg-black shrink-0">
        <p className="text-white/30 text-xs text-center px-4 py-4">
          Point camera at a product barcode
        </p>
      </div>

    </div>
  )
}
