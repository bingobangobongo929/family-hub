import { useState, useEffect, useRef, RefObject } from 'react'

export type WidgetSize = 'small' | 'medium' | 'large' | 'xlarge'

interface WidgetDimensions {
  width: number
  height: number
  size: WidgetSize
  isWide: boolean
  isTall: boolean
}

export function useWidgetSize(): [RefObject<HTMLDivElement>, WidgetDimensions] {
  const ref = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<WidgetDimensions>({
    width: 0,
    height: 0,
    size: 'small',
    isWide: false,
    isTall: false,
  })

  useEffect(() => {
    if (!ref.current) return

    const updateSize = () => {
      if (!ref.current) return

      const { width, height } = ref.current.getBoundingClientRect()

      // Determine size category based on area
      const area = width * height
      let size: WidgetSize = 'small'
      if (area > 120000) size = 'xlarge'
      else if (area > 60000) size = 'large'
      else if (area > 30000) size = 'medium'

      setDimensions({
        width,
        height,
        size,
        isWide: width > 350,
        isTall: height > 250,
      })
    }

    // Initial measurement
    updateSize()

    // Watch for resize
    const observer = new ResizeObserver(updateSize)
    observer.observe(ref.current)

    return () => observer.disconnect()
  }, [])

  return [ref, dimensions]
}
