/**
 * Keyboard utilities for native iOS app
 * Handles keyboard dismissal and visibility without requiring @capacitor/keyboard plugin
 */

/**
 * Dismiss the virtual keyboard
 * Works on both native iOS and web
 */
export async function dismissKeyboard(): Promise<void> {
  blurActiveElement()
}

/**
 * Blur the currently focused element to dismiss keyboard
 */
function blurActiveElement(): void {
  const active = document.activeElement as HTMLElement | null
  if (active && typeof active.blur === 'function') {
    active.blur()
  }
}

/**
 * Set up keyboard event listeners
 * Uses visual viewport API which works across platforms
 * Returns cleanup function
 */
export function setupKeyboardListeners(callbacks?: {
  onShow?: (height: number) => void
  onHide?: () => void
}): () => void {
  // Use Visual Viewport API for keyboard detection (works on iOS Safari and native)
  if (typeof window !== 'undefined' && window.visualViewport) {
    const viewport = window.visualViewport

    const handleResize = () => {
      const windowHeight = window.innerHeight
      const viewportHeight = viewport.height

      // If viewport is significantly smaller than window, keyboard is visible
      const keyboardHeight = windowHeight - viewportHeight
      const isKeyboardVisible = keyboardHeight > 100 // Threshold to avoid false positives

      if (isKeyboardVisible) {
        callbacks?.onShow?.(keyboardHeight)
        document.body.classList.add('keyboard-visible')
        document.body.style.setProperty('--keyboard-height', `${keyboardHeight}px`)
      } else {
        callbacks?.onHide?.()
        document.body.classList.remove('keyboard-visible')
        document.body.style.removeProperty('--keyboard-height')
      }
    }

    viewport.addEventListener('resize', handleResize)

    return () => {
      viewport.removeEventListener('resize', handleResize)
      document.body.classList.remove('keyboard-visible')
      document.body.style.removeProperty('--keyboard-height')
    }
  }

  return () => {}
}

/**
 * Scroll an element into view when keyboard shows
 * Useful for forms where input might be hidden by keyboard
 */
export function scrollInputIntoView(element: HTMLElement, delay = 100): void {
  setTimeout(() => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }, delay)
}
