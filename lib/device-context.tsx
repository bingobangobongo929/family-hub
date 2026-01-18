'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'

export type DeviceMode = 'auto' | 'mobile' | 'tablet' | 'kitchen'
export type DetectedDevice = 'mobile' | 'tablet' | 'desktop' | 'kitchen'

interface DeviceContextType {
  // Manual override setting
  deviceMode: DeviceMode
  setDeviceMode: (mode: DeviceMode) => Promise<void>

  // Actual computed device (respects manual override)
  device: DetectedDevice

  // Convenience booleans
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isKitchen: boolean

  // Size multipliers for kitchen mode
  scale: number
  avatarSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  tapTargetSize: number
  fontSize: string
}

const DeviceContext = createContext<DeviceContextType | null>(null)

// Detection thresholds for 4K displays (3840x2160)
// Kitchen: Large screen (>1400px width AND >900px height) in landscape
// This catches 27"+ 4K monitors
const KITCHEN_MIN_WIDTH = 1400
const KITCHEN_MIN_HEIGHT = 900
const TABLET_MIN_WIDTH = 768
const DESKTOP_MIN_WIDTH = 1024

function detectDevice(width: number, height: number): DetectedDevice {
  // Kitchen: Large landscape display (4K monitors)
  if (width >= KITCHEN_MIN_WIDTH && height >= KITCHEN_MIN_HEIGHT) {
    return 'kitchen'
  }

  // Desktop: Standard desktop/laptop
  if (width >= DESKTOP_MIN_WIDTH) {
    return 'desktop'
  }

  // Tablet: Medium screens
  if (width >= TABLET_MIN_WIDTH) {
    return 'tablet'
  }

  // Mobile: Everything else
  return 'mobile'
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [deviceMode, setDeviceModeState] = useState<DeviceMode>('auto')
  const [detectedDevice, setDetectedDevice] = useState<DetectedDevice>('desktop')
  const [mounted, setMounted] = useState(false)

  // Detect device on mount and resize
  useEffect(() => {
    setMounted(true)

    const updateDetection = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      setDetectedDevice(detectDevice(width, height))
    }

    updateDetection()

    window.addEventListener('resize', updateDetection)
    return () => window.removeEventListener('resize', updateDetection)
  }, [])

  // Load saved device mode from database or localStorage
  useEffect(() => {
    const loadDeviceMode = async () => {
      // Try localStorage first (works for non-logged-in users too)
      const saved = localStorage.getItem('family-hub-device-mode')
      if (saved && ['auto', 'mobile', 'tablet', 'kitchen'].includes(saved)) {
        setDeviceModeState(saved as DeviceMode)
      }

      // If logged in, also check database (takes precedence)
      if (user) {
        try {
          const { data } = await supabase
            .from('user_preferences')
            .select('device_mode')
            .eq('user_id', user.id)
            .single()

          if (data?.device_mode) {
            setDeviceModeState(data.device_mode as DeviceMode)
            localStorage.setItem('family-hub-device-mode', data.device_mode)
          }
        } catch (e) {
          // Table might not exist yet or no record
        }
      }
    }

    loadDeviceMode()
  }, [user])

  // Save device mode
  const setDeviceMode = useCallback(async (mode: DeviceMode) => {
    setDeviceModeState(mode)
    localStorage.setItem('family-hub-device-mode', mode)

    if (user) {
      try {
        await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            device_mode: mode,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' })
      } catch (e) {
        console.error('Failed to save device mode:', e)
      }
    }
  }, [user])

  // Compute actual device (respects manual override)
  const device: DetectedDevice = deviceMode === 'auto'
    ? detectedDevice
    : deviceMode as DetectedDevice

  // Convenience booleans
  const isMobile = device === 'mobile'
  const isTablet = device === 'tablet'
  const isDesktop = device === 'desktop'
  const isKitchen = device === 'kitchen'

  // Size multipliers for kitchen mode
  const scale = isKitchen ? 1.5 : isTablet ? 1.1 : 1

  const avatarSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = isKitchen
    ? 'xl'
    : isTablet
      ? 'lg'
      : 'md'

  // Tap target in pixels (44px minimum for accessibility)
  const tapTargetSize = isKitchen ? 64 : isTablet ? 52 : 44

  // Font size class for base text
  const fontSize = isKitchen ? 'text-lg' : 'text-base'

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <DeviceContext.Provider value={{
        deviceMode: 'auto',
        setDeviceMode: async () => {},
        device: 'desktop',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isKitchen: false,
        scale: 1,
        avatarSize: 'md',
        tapTargetSize: 44,
        fontSize: 'text-base'
      }}>
        {children}
      </DeviceContext.Provider>
    )
  }

  return (
    <DeviceContext.Provider value={{
      deviceMode,
      setDeviceMode,
      device,
      isMobile,
      isTablet,
      isDesktop,
      isKitchen,
      scale,
      avatarSize,
      tapTargetSize,
      fontSize
    }}>
      {children}
    </DeviceContext.Provider>
  )
}

export function useDevice() {
  const context = useContext(DeviceContext)
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider')
  }
  return context
}

// CSS custom properties for device-aware styling
export function getDeviceCSSVars(device: DetectedDevice) {
  const isKitchen = device === 'kitchen'
  const isTablet = device === 'tablet'

  return {
    '--avatar-size-sm': isKitchen ? '48px' : '32px',
    '--avatar-size-md': isKitchen ? '64px' : '40px',
    '--avatar-size-lg': isKitchen ? '80px' : '56px',
    '--avatar-size-xl': isKitchen ? '96px' : '64px',
    '--tap-target': isKitchen ? '64px' : isTablet ? '52px' : '44px',
    '--icon-size': isKitchen ? '28px' : '20px',
    '--icon-size-lg': isKitchen ? '36px' : '24px',
    '--spacing-base': isKitchen ? '1.5rem' : '1rem',
    '--font-scale': isKitchen ? '1.25' : '1',
  } as React.CSSProperties
}
