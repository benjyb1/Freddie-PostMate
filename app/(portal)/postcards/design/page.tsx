'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Upload, Trash2, ImageIcon, Eye, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Stannp prints A6 (148×105mm) — its default size and the closest match to the
// old 6×4" card. Artwork is supplied at 154×111mm (A6 + 3mm bleed on every edge)
// and Stannp trims 3mm off all round, so the design has to run past the trim;
// whatever sits in that outer 3mm band gets cut away. Stannp prints the
// recipient address itself, in a reserved "clear zone" on the back.
const CARD = {
  trimW: 148, // mm
  trimH: 105,
  bleed: 3, // trimmed off every edge (154×111mm artwork → 148×105mm trim)
  safe: 3, // Stannp's A6 safe zone is 142×99mm, i.e. 3mm inside the trim
}
const DOC_W = CARD.trimW + CARD.bleed * 2 // 154mm — full artwork width incl. bleed
const DOC_H = CARD.trimH + CARD.bleed * 2 // 111mm

// Aspect of the crop frame: the full bleed doc when the artwork already carries
// bleed, or the finished card when we synthesise the bleed for them.
const ASPECT_BLEED = DOC_W / DOC_H // 154 / 111
const ASPECT_TRIM = CARD.trimW / CARD.trimH // 148 / 105

// On the back, Stannp prints the postage, recipient address and barcode over a
// white panel covering the RIGHT HALF of the card, full height — measured from a
// live proof: the panel starts dead on the card's centre line (77mm of 154mm)
// and runs to all three outer edges. So the usable design area is the LEFT half;
// keep the message and logo there. clearzone=true whites this half out, so any
// artwork under it won't show.

// Stannp prints at 300 DPI. Below that an A6 card starts to look soft, so warn
// before the customer commits a design that'll print blurry.
const MIN_PRINT_DPI = 300
// Target pixel size of the finished artwork at 300 DPI (154×111mm incl. bleed).
const TARGET_PX = {
  w: Math.round((DOC_W / 25.4) * 300), // 1819
  h: Math.round((DOC_H / 25.4) * 300), // 1311
}

type Side = 'front' | 'back'

const SIDE_CONFIG = {
  front: { fileBase: 'design', settingsKey: 'postcard_design_url', label: 'Front' },
  back: { fileBase: 'design-back', settingsKey: 'postcard_design_back_url', label: 'Back' },
} as const

/** Frame geometry for the active mode: where the trim sits and the frame size. */
function geom(addBleed: boolean) {
  return {
    trimOff: addBleed ? 0 : CARD.bleed, // mm from frame edge to the cut line
    frameW: addBleed ? CARD.trimW : DOC_W,
    frameH: addBleed ? CARD.trimH : DOC_H,
  }
}
const pct = (mm: number, frameMm: number) => (mm / frameMm) * 100

/** Red dashed rectangle on the cut line, with the bleed band dimmed outside it. */
function CutGuide({ x, y, dim = true }: { x: number; y: number; dim?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute rounded-[1px] border border-dashed border-red-500/90"
      style={{
        top: `${y}%`,
        bottom: `${y}%`,
        left: `${x}%`,
        right: `${x}%`,
        ...(dim ? { boxShadow: '0 0 0 9999px rgba(15,23,42,0.20)' } : {}),
      }}
    />
  )
}

/** Blue dashed safe zone — keep important text and logos inside it. */
function SafeGuide({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="pointer-events-none absolute rounded-[1px] border border-dashed"
      style={{ top: `${y}%`, bottom: `${y}%`, left: `${x}%`, right: `${x}%`, borderColor: 'rgba(37,99,235,0.9)' }}
    />
  )
}

/**
 * Amber hatched panel marking the right half of the back, where Stannp prints
 * the postage, address and barcode over white. `left` is the panel's left edge
 * as a % of the frame (the card centre line); it runs to the other three edges.
 */
function ClearZoneGuide({ left }: { left: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center border-l border-dashed border-amber-500"
      style={{
        left: `${left}%`,
        background:
          'repeating-linear-gradient(45deg, rgba(245,158,11,0.16) 0, rgba(245,158,11,0.16) 7px, transparent 7px, transparent 14px)',
      }}
    >
      <span className="rounded bg-amber-500/90 px-1.5 py-0.5 text-center text-[8px] font-medium uppercase leading-tight tracking-wide text-white">
        Address &amp; postage<br />printed here
      </span>
    </div>
  )
}

/** All overlays for one frame, given the mode and side. */
function GuideOverlay({ side, addBleed, showSafe = true }: { side: Side; addBleed: boolean; showSafe?: boolean }) {
  const g = geom(addBleed)
  const cut = { x: pct(g.trimOff, g.frameW), y: pct(g.trimOff, g.frameH) }
  const safe = { x: pct(g.trimOff + CARD.safe, g.frameW), y: pct(g.trimOff + CARD.safe, g.frameH) }
  // The address panel starts at the card's centre line (= 50% in either frame).
  const addressLeft = pct(g.trimOff + CARD.trimW / 2, g.frameW)
  return (
    <>
      {/* In add-bleed mode the frame edge IS the cut, so only show the safe line. */}
      {!addBleed && <CutGuide x={cut.x} y={cut.y} />}
      {showSafe && <SafeGuide x={safe.x} y={safe.y} />}
      {side === 'back' && <ClearZoneGuide left={addressLeft} />}
    </>
  )
}

function isPdfUrl(url: string) {
  return /\.pdf(\?|$)/i.test(url)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to create blob'))
    }, 'image/png')
  })
}

/**
 * Crop the rendered design to the chosen area and return a PNG.
 *
 * When `addBleed` is set, the crop area is the FINISHED A6 card and we synthesise
 * the 3mm bleed on all four edges by replicating the edge pixels outward — for
 * customers who upload artwork without bleed. The bleed band is trimmed off, so
 * the stretched edge never shows; it just stops a white sliver appearing if the
 * cut drifts.
 */
async function getCroppedImg(imageSrc: string, cropArea: Area, addBleed: boolean): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageSrc
  })

  const cw = Math.round(cropArea.width)
  const ch = Math.round(cropArea.height)

  if (!addBleed) {
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, cw, ch)
    return canvasToBlob(canvas)
  }

  // Bleed in pixels, scaled from the cropped trim region.
  const bx = Math.max(1, Math.round((cw * CARD.bleed) / CARD.trimW))
  const by = Math.max(1, Math.round((ch * CARD.bleed) / CARD.trimH))

  const canvas = document.createElement('canvas')
  canvas.width = cw + bx * 2
  canvas.height = ch + by * 2
  const ctx = canvas.getContext('2d')!

  // Finished artwork in the middle, offset by the bleed.
  ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, bx, by, cw, ch)

  // Replicate the outer rows/columns of the artwork into each margin + corner.
  ctx.drawImage(canvas, bx, by, 1, ch, 0, by, bx, ch) // left
  ctx.drawImage(canvas, bx + cw - 1, by, 1, ch, bx + cw, by, bx, ch) // right
  ctx.drawImage(canvas, bx, by, cw, 1, bx, 0, cw, by) // top
  ctx.drawImage(canvas, bx, by + ch - 1, cw, 1, bx, by + ch, cw, by) // bottom
  ctx.drawImage(canvas, bx, by, 1, 1, 0, 0, bx, by) // top-left
  ctx.drawImage(canvas, bx + cw - 1, by, 1, 1, bx + cw, 0, bx, by) // top-right
  ctx.drawImage(canvas, bx, by + ch - 1, 1, 1, 0, by + ch, bx, by) // bottom-left
  ctx.drawImage(canvas, bx + cw - 1, by + ch - 1, 1, 1, bx + cw, by + ch, bx, by) // bottom-right

  return canvasToBlob(canvas)
}

export default function PostcardDesignPage() {
  const supabase = createClient()
  const frontFileInputRef = useRef<HTMLInputElement>(null)
  const backFileInputRef = useRef<HTMLInputElement>(null)
  // The original uploaded PDF per side, kept for the lossless "send as-is" path.
  const frontOriginalFile = useRef<File | null>(null)
  const backOriginalFile = useRef<File | null>(null)

  const [activeSide, setActiveSide] = useState<Side>('front')
  const [userId, setUserId] = useState<string | null>(null)

  // Front side state
  const [frontDesignUrl, setFrontDesignUrl] = useState<string | null>(null)
  const [frontImageSrc, setFrontImageSrc] = useState<string | null>(null)
  const [frontCrop, setFrontCrop] = useState({ x: 0, y: 0 })
  const [frontZoom, setFrontZoom] = useState(1)
  const [frontCroppedAreaPixels, setFrontCroppedAreaPixels] = useState<Area | null>(null)

  // Back side state
  const [backDesignUrl, setBackDesignUrl] = useState<string | null>(null)
  const [backImageSrc, setBackImageSrc] = useState<string | null>(null)
  const [backCrop, setBackCrop] = useState({ x: 0, y: 0 })
  const [backZoom, setBackZoom] = useState(1)
  const [backCroppedAreaPixels, setBackCroppedAreaPixels] = useState<Area | null>(null)

  // Whether to synthesise bleed for the customer, per side.
  const [frontAddBleed, setFrontAddBleed] = useState(false)
  const [backAddBleed, setBackAddBleed] = useState(false)

  // Lossless path: send the original print-ready PDF as-is (no rasterising).
  const [frontPassthrough, setFrontPassthrough] = useState(false)
  const [backPassthrough, setBackPassthrough] = useState(false)

  const [loading, setLoading] = useState(false)
  const [rendering, setRendering] = useState(false)

  // Exact-print proof (Stannp test-mode render)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Derived state for whichever side is active
  const isFront = activeSide === 'front'
  const currentDesignUrl = isFront ? frontDesignUrl : backDesignUrl
  const setCurrentDesignUrl = isFront ? setFrontDesignUrl : setBackDesignUrl
  const imageSrc = isFront ? frontImageSrc : backImageSrc
  const setImageSrc = isFront ? setFrontImageSrc : setBackImageSrc
  const crop = isFront ? frontCrop : backCrop
  const setCrop = isFront ? setFrontCrop : setBackCrop
  const zoom = isFront ? frontZoom : backZoom
  const setZoom = isFront ? setFrontZoom : setBackZoom
  const croppedAreaPixels = isFront ? frontCroppedAreaPixels : backCroppedAreaPixels
  const setCroppedAreaPixels = isFront ? setFrontCroppedAreaPixels : setBackCroppedAreaPixels
  const fileInputRef = isFront ? frontFileInputRef : backFileInputRef
  const originalFileRef = isFront ? frontOriginalFile : backOriginalFile
  const config = SIDE_CONFIG[activeSide]
  const addBleed = isFront ? frontAddBleed : backAddBleed
  const setAddBleed = isFront ? setFrontAddBleed : setBackAddBleed
  const passthrough = isFront ? frontPassthrough : backPassthrough
  const setPassthrough = isFront ? setFrontPassthrough : setBackPassthrough

  const bothSaved = Boolean(frontDesignUrl && backDesignUrl)

  // Crop frame: the bleed doc when the design already has bleed, or the finished
  // card when we're adding it. (Front and back share the same A6 frame now —
  // Stannp stamps the address itself rather than reserving half the back.)
  const cropAspect = addBleed ? ASPECT_TRIM : ASPECT_BLEED

  // Roughly how many DPI the cropped artwork will print at. The crop frame spans
  // this many mm across, so dividing the cropped pixel width by it gives DPI.
  const cropFrameMm = addBleed ? CARD.trimW : DOC_W
  const effectiveDpi = croppedAreaPixels
    ? Math.round(croppedAreaPixels.width / (cropFrameMm / 25.4))
    : null
  const lowRes = !passthrough && effectiveDpi != null && effectiveDpi < MIN_PRINT_DPI

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const res = await fetch('/api/settings')
      const { profile } = await res.json()
      setFrontDesignUrl(profile?.postcard_design_url ?? null)
      setBackDesignUrl(profile?.postcard_design_back_url ?? null)
    }
    load()
  }, [])

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [setCroppedAreaPixels])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }

    originalFileRef.current = file
    setRendering(true)
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const page = await pdf.getPage(1)

      // Render at ~400 DPI so the cropped print is sharp with headroom above
      // Stannp's 300 DPI. pdf.js scale 1 ≈ 72 DPI, so 400 DPI needs scale ≈ 5.56.
      // Cap the long edge so an oversized PDF doesn't blow up the canvas/upload —
      // 6.06" (154mm) at 400 DPI is ~2425px, well under the cap.
      const base = page.getViewport({ scale: 1 })
      const MAX_EDGE = 3200
      let scale = 400 / 72
      const longEdge = Math.max(base.width, base.height) * scale
      if (longEdge > MAX_EDGE) scale = MAX_EDGE / Math.max(base.width, base.height)

      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvas, viewport }).promise
      setImageSrc(canvas.toDataURL('image/png'))
    } catch {
      toast.error('Failed to render PDF – make sure it is a valid PDF file')
    } finally {
      setRendering(false)
      // Reset the input so the same file can be re-selected
      e.target.value = ''
    }
  }

  async function handleSave() {
    if (!imageSrc || !userId) return
    if (!passthrough && !croppedAreaPixels) return
    if (passthrough && !originalFileRef.current) return
    setLoading(true)

    try {
      // Lossless path: upload the original PDF untouched so Stannp prints from the
      // vector source. Otherwise rasterise the crop (with optional synthesised
      // bleed) to a high-resolution PNG.
      const ext = passthrough ? 'pdf' : 'png'
      const contentType = passthrough ? 'application/pdf' : 'image/png'
      const blob: Blob = passthrough
        ? originalFileRef.current!
        : await getCroppedImg(imageSrc, croppedAreaPixels!, addBleed)

      const path = `${userId}/${config.fileBase}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('postcard-designs')
        .upload(path, blob, { upsert: true, contentType })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('postcard-designs')
        .getPublicUrl(path)

      // The storage path is fixed per side, so the public URL never changes and
      // Supabase's CDN (and Stannp, and the browser) would keep serving the old
      // file. Append a version so everyone fetches the new artwork straight away.
      const versionedUrl = `${publicUrl}?v=${Date.now()}`

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [config.settingsKey]: versionedUrl }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to save')
      }

      setCurrentDesignUrl(versionedUrl)
      setImageSrc(null)
      setPreviewUrl(null) // design changed — the old proof is stale
      toast.success(`${config.label} design saved`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save design')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Render an exact print proof through Stannp's test mode. Nothing is printed,
   * posted or charged — it returns the same PDF the printer would use. Needs both
   * sides saved, since Stannp builds the whole card at once.
   */
  async function handlePreview() {
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/postcards/preview', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to render preview')
      setPreviewUrl(data.url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to render preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleRemove() {
    if (!userId) return
    setLoading(true)

    try {
      // Remove whichever format is on disk (PNG crop or passthrough PDF).
      await supabase.storage
        .from('postcard-designs')
        .remove([`${userId}/${config.fileBase}.png`, `${userId}/${config.fileBase}.pdf`])

      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [config.settingsKey]: null }),
      })

      setCurrentDesignUrl(null)
      setImageSrc(null)
      setPreviewUrl(null)
      toast.success(`${config.label} design removed`)
    } catch {
      toast.error('Failed to remove design')
    } finally {
      setLoading(false)
    }
  }

  function cancelEdit() {
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    originalFileRef.current = null
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Postcard Design</h1>
        <p className="text-sm text-slate-500">
          Upload your front and back artwork as PDFs. Cards print A6 (148×105mm) on 300gsm.
          Design at 154×111mm so there&apos;s 3mm of bleed to trim — or upload a print-ready PDF and send it untouched.
        </p>
      </div>

      {/* Front / Back tab toggle */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {(['front', 'back'] as const).map((side) => {
          const saved = side === 'front' ? frontDesignUrl : backDesignUrl
          return (
            <button
              key={side}
              type="button"
              onClick={() => setActiveSide(side)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                activeSide === side ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {SIDE_CONFIG[side].label}
              <span
                className={`h-1.5 w-1.5 rounded-full ${saved ? 'bg-green-500' : 'bg-slate-300'}`}
                title={saved ? 'Design saved' : 'No design yet'}
              />
            </button>
          )
        })}
      </div>

      {/* Design preview (left) and upload / crop tools (right), side by side. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Current saved design preview */}
        {currentDesignUrl && (
          <Card>
            <CardHeader>
              <CardTitle>{config.label} Design</CardTitle>
              <CardDescription>
                Red dashed line is the cut; anything outside it is trimmed off.
                {!isFront && ' The amber right half is where Stannp prints the address.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="relative mx-auto overflow-hidden rounded-md border border-slate-200 bg-white"
                style={{ aspectRatio: `${DOC_W}/${DOC_H}`, maxWidth: 460 }}
              >
                {isPdfUrl(currentDesignUrl) ? (
                  <iframe src={`${currentDesignUrl}#toolbar=0&view=Fit`} className="h-full w-full" title={`${config.label} design`} />
                ) : (
                  <img src={currentDesignUrl} alt={`Current postcard ${activeSide} design`} className="h-full w-full object-cover" />
                )}
                {/* Guides only line up on rasterised designs; a passthrough PDF is
                    verified through the exact proof below instead. */}
                {!isPdfUrl(currentDesignUrl) && <GuideOverlay side={activeSide} addBleed={false} showSafe={false} />}
              </div>
              <Button variant="outline" size="sm" onClick={handleRemove} disabled={loading}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remove {config.label.toLowerCase()} design
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upload / edit card */}
        <Card>
          <CardHeader>
            <CardTitle>{currentDesignUrl ? `Replace ${config.label} Design` : `Upload ${config.label} Design`}</CardTitle>
            <CardDescription>
              {isFront
                ? 'The front is your full design, edge to edge.'
                : 'Design the full card, but keep your message and logo in the LEFT half — Stannp prints the address over the amber right half, covered by a white panel.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input ref={frontFileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
            <input ref={backFileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />

            {!imageSrc && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={rendering}
                className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-200 p-10 text-slate-500 transition hover:border-slate-400 hover:text-slate-700 disabled:opacity-50"
              >
                {rendering ? (
                  <>
                    <ImageIcon className="h-8 w-8 animate-pulse" />
                    <span className="text-sm">Rendering PDF...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8" />
                    <span className="text-sm font-medium">Click to upload PDF</span>
                    <span className="text-xs">Crop, resize and bleed controls appear right here</span>
                  </>
                )}
              </button>
            )}

            {imageSrc && (
              <>
                {passthrough ? (
                  /* Lossless: show the rendered page with guides, no crop. */
                  <div
                    className="relative mx-auto w-full overflow-hidden rounded-md border border-slate-200 bg-white"
                    style={{ aspectRatio: `${ASPECT_BLEED}`, maxWidth: 560 }}
                  >
                    <img src={imageSrc} alt="Print-ready artwork" className="h-full w-full object-contain" />
                    <GuideOverlay side={activeSide} addBleed={false} />
                  </div>
                ) : (
                  /* Crop the whole card; the overlay shows the cut, safe zone and
                     (on the back) the address area. */
                  <div
                    className="relative mx-auto w-full overflow-hidden rounded-md border border-slate-200"
                    style={{ aspectRatio: `${cropAspect}`, maxWidth: 560 }}
                  >
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={cropAspect}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                    <GuideOverlay side={activeSide} addBleed={addBleed} />
                  </div>
                )}

                {/* Lossless passthrough toggle — the quality-first path. */}
                <label className="flex items-start gap-2 rounded-md border border-indigo-100 bg-indigo-50/60 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={passthrough}
                    onChange={(e) => setPassthrough(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-indigo-900">
                      <Sparkles className="h-3.5 w-3.5" /> Send my PDF as-is — maximum quality
                    </span>
                    <span className="mt-0.5 block text-xs text-indigo-700/80">
                      Skips cropping and rasterising — Stannp prints straight from your vector PDF, so there&apos;s zero
                      quality loss. Use this when your file is already A6 with 3mm bleed (154×111mm).
                    </span>
                  </span>
                </label>

                {!passthrough && (
                  <>
                    {/* Add-bleed helper — for designs that don't already include bleed */}
                    <label className="flex items-start gap-2 rounded-md bg-slate-50 p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={addBleed}
                        onChange={(e) => setAddBleed(e.target.checked)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span>
                        <span className="font-medium text-slate-700">My design doesn&apos;t include bleed — add it for me</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Tick this if your artwork is exactly the finished A6 size (148×105mm). We&apos;ll extend the
                          edges by 3mm so no white shows after trimming. Leave it off if you already designed at
                          154×111mm with bleed.
                        </span>
                      </span>
                    </label>

                    {/* Guide legend */}
                    <p className="text-xs text-slate-500">
                      {addBleed
                        ? 'Blue line is the safe zone — keep text and logos inside it.'
                        : 'Red line is the cut. Let the background run to the outer edge; keep text inside the blue safe line.'}
                      {!isFront && ' Keep your content in the left half — the amber right half becomes the address panel.'}
                    </p>

                    {/* Low-resolution warning */}
                    {lowRes && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        This crop is about {effectiveDpi} DPI, below the {MIN_PRINT_DPI} DPI Stannp prints at — it may
                        look soft. Zoom out, or upload a higher-resolution PDF.
                      </div>
                    )}

                    {/* Zoom slider */}
                    <div className="flex items-center gap-3">
                      <span className="w-10 text-xs text-slate-500">Zoom</span>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1"
                      />
                    </div>
                  </>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Design'}
                  </Button>
                  <Button variant="outline" onClick={cancelEdit} disabled={loading}>
                    Cancel
                  </Button>
                  <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                    Choose different file
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Exact print proof — the whole card, straight from Stannp. */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> Exact printed postcard
          </CardTitle>
          <CardDescription>
            The real print-ready PDF, rendered by Stannp from both sides of your card with a sample address. Nothing is
            printed, posted or charged — this is exactly what lands on the doormat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handlePreview} disabled={previewLoading || !bothSaved}>
              {previewLoading ? 'Rendering…' : 'Preview exact printed postcard'}
            </Button>
            {!bothSaved && (
              <span className="text-xs text-slate-500">Save a front and a back design to render the proof.</span>
            )}
          </div>
          {previewUrl && (
            <div className="space-y-2">
              <iframe src={previewUrl} className="h-[34rem] w-full rounded-md border border-slate-200" title="Postcard print proof" />
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
                Open the proof PDF in a new tab
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="border-slate-100 bg-slate-50">
        <CardContent className="pt-4">
          <p className="text-sm text-slate-600">
            <strong>Tip:</strong> For the sharpest print, design at 300 DPI and {TARGET_PX.w}×{TARGET_PX.h}px
            (154×111mm — A6 plus 3mm bleed on every edge). Keep important text and logos at least {CARD.safe}mm inside
            the cut. On the back, keep your message and logo in the left half — Stannp prints the address over the right half. Only the first page of the PDF is used.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
