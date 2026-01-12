'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Check, X } from 'lucide-react'
import Modal from './ui/Modal'

interface ImageCropperProps {
  isOpen: boolean
  imageSrc: string
  onClose: () => void
  onCrop: (croppedBlob: Blob) => void
}

export default function ImageCropper({ isOpen, imageSrc, onClose, onCrop }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [minScale, setMinScale] = useState(1)

  const CROP_SIZE = 256 // Output size
  const DISPLAY_SIZE = 280 // Display area size

  // Load image when src changes
  useEffect(() => {
    if (!imageSrc) return

    const img = new Image()
    img.onload = () => {
      setImage(img)
      // Calculate minimum scale to cover the crop area
      const minScaleX = DISPLAY_SIZE / img.width
      const minScaleY = DISPLAY_SIZE / img.height
      const newMinScale = Math.max(minScaleX, minScaleY)
      setMinScale(newMinScale)
      setScale(newMinScale)
      setPosition({ x: 0, y: 0 })
    }
    img.src = imageSrc
  }, [imageSrc])

  // Draw image on canvas
  useEffect(() => {
    if (!image || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = DISPLAY_SIZE
    canvas.height = DISPLAY_SIZE

    // Clear canvas
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE)

    // Calculate centered position
    const scaledWidth = image.width * scale
    const scaledHeight = image.height * scale
    const x = (DISPLAY_SIZE - scaledWidth) / 2 + position.x
    const y = (DISPLAY_SIZE - scaledHeight) / 2 + position.y

    // Draw image
    ctx.drawImage(image, x, y, scaledWidth, scaledHeight)
  }, [image, scale, position])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }, [position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !image) return

    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y

    // Calculate bounds
    const scaledWidth = image.width * scale
    const scaledHeight = image.height * scale
    const maxOffsetX = Math.max(0, (scaledWidth - DISPLAY_SIZE) / 2)
    const maxOffsetY = Math.max(0, (scaledHeight - DISPLAY_SIZE) / 2)

    setPosition({
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, newX)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newY)),
    })
  }, [isDragging, dragStart, image, scale])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      })
    }
  }, [position])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !image || e.touches.length !== 1) return

    const newX = e.touches[0].clientX - dragStart.x
    const newY = e.touches[0].clientY - dragStart.y

    const scaledWidth = image.width * scale
    const scaledHeight = image.height * scale
    const maxOffsetX = Math.max(0, (scaledWidth - DISPLAY_SIZE) / 2)
    const maxOffsetY = Math.max(0, (scaledHeight - DISPLAY_SIZE) / 2)

    setPosition({
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, newX)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newY)),
    })
  }, [isDragging, dragStart, image, scale])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(prev => Math.max(minScale, Math.min(3, prev + delta)))
  }, [minScale])

  const handleZoomIn = () => setScale(prev => Math.min(3, prev + 0.2))
  const handleZoomOut = () => setScale(prev => Math.max(minScale, prev - 0.2))
  const handleReset = () => {
    setScale(minScale)
    setPosition({ x: 0, y: 0 })
  }

  const handleCrop = useCallback(() => {
    if (!image) return

    // Create output canvas
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = CROP_SIZE
    outputCanvas.height = CROP_SIZE
    const ctx = outputCanvas.getContext('2d')
    if (!ctx) return

    // Calculate the crop area from the display
    const scaledWidth = image.width * scale
    const scaledHeight = image.height * scale
    const x = (DISPLAY_SIZE - scaledWidth) / 2 + position.x
    const y = (DISPLAY_SIZE - scaledHeight) / 2 + position.y

    // Scale factor between display and output
    const outputScale = CROP_SIZE / DISPLAY_SIZE

    // Draw the cropped area
    ctx.drawImage(
      image,
      -x / scale,
      -y / scale,
      DISPLAY_SIZE / scale,
      DISPLAY_SIZE / scale,
      0,
      0,
      CROP_SIZE,
      CROP_SIZE
    )

    // Convert to blob
    outputCanvas.toBlob((blob) => {
      if (blob) {
        onCrop(blob)
      }
    }, 'image/jpeg', 0.9)
  }, [image, scale, position, onCrop])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crop Image" size="md">
      <div className="flex flex-col items-center">
        {/* Crop area */}
        <div
          ref={containerRef}
          className="relative rounded-full overflow-hidden cursor-move touch-none"
          style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
          />
          {/* Circular overlay guide */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: '0 0 0 1000px rgba(0,0,0,0.5)',
              borderRadius: '50%',
            }}
          />
          <div className="absolute inset-0 rounded-full border-2 border-white/50 pointer-events-none" />
        </div>

        {/* Instructions */}
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 text-center">
          Drag to reposition. Use controls or scroll to zoom.
        </p>

        {/* Zoom controls */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <div className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all"
              style={{ width: `${((scale - minScale) / (3 - minScale)) * 100}%` }}
            />
          </div>
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors ml-2"
            title="Reset"
          >
            <RotateCcw className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-6 w-full">
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-medium"
          >
            <X className="w-5 h-5" />
            Cancel
          </button>
          <button
            onClick={handleCrop}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-teal-500 text-white hover:bg-teal-600 transition-colors font-medium"
          >
            <Check className="w-5 h-5" />
            Apply
          </button>
        </div>
      </div>
    </Modal>
  )
}
