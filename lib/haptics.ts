import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

// Check if we're running on a native platform
const isNative = Capacitor.isNativePlatform();

/**
 * Light haptic feedback - for selections, button presses
 */
export async function hapticLight() {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    // Ignore errors on platforms without haptic support
  }
}

/**
 * Medium haptic feedback - for confirmations, completions
 */
export async function hapticMedium() {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Heavy haptic feedback - for important actions, warnings
 */
export async function hapticHeavy() {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Success haptic pattern
 */
export async function hapticSuccess() {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Warning haptic pattern
 */
export async function hapticWarning() {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Error haptic pattern
 */
export async function hapticError() {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Selection changed haptic - for picker/toggle changes
 */
export async function hapticSelection() {
  if (!isNative) return;
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch (e) {
    // Ignore errors
  }
}
