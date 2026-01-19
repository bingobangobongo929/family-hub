import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

// Check if we're running on a native platform
const isNative = Capacitor.isNativePlatform();

// Haptic cooldown to prevent rapid-fire vibrations (toddler-proof)
const HAPTIC_COOLDOWN_MS = 500;
const HAPTIC_COOLDOWN_INSTANT_MS = 50; // Minimal cooldown for UI feedback
let lastHapticTime = 0;
let lastInstantHapticTime = 0;

function canTriggerHaptic(): boolean {
  const now = Date.now();
  if (now - lastHapticTime < HAPTIC_COOLDOWN_MS) {
    return false;
  }
  lastHapticTime = now;
  return true;
}

// Instant haptic check with minimal cooldown (for UI interactions)
function canTriggerInstantHaptic(): boolean {
  const now = Date.now();
  if (now - lastInstantHapticTime < HAPTIC_COOLDOWN_INSTANT_MS) {
    return false;
  }
  lastInstantHapticTime = now;
  return true;
}

/**
 * Light haptic feedback - for selections, button presses
 */
export async function hapticLight() {
  if (!isNative || !canTriggerHaptic()) return;
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
  if (!isNative || !canTriggerHaptic()) return;
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
  if (!isNative || !canTriggerHaptic()) return;
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
  if (!isNative || !canTriggerHaptic()) return;
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
  if (!isNative || !canTriggerHaptic()) return;
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
  if (!isNative || !canTriggerHaptic()) return;
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
  if (!isNative || !canTriggerHaptic()) return;
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch (e) {
    // Ignore errors
  }
}

// ============================================================
// Instant haptics (minimal cooldown for UI feedback)
// These bypass the toddler-proof cooldown for responsive UI
// ============================================================

/**
 * Instant light tap - for button presses, no cooldown
 */
export async function hapticTap() {
  if (!isNative || !canTriggerInstantHaptic()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Instant selection tick - for toggles, switches, selections
 */
export async function hapticTick() {
  if (!isNative || !canTriggerInstantHaptic()) return;
  try {
    await Haptics.selectionChanged();
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Soft impact - softer than light, for subtle interactions
 */
export async function hapticSoft() {
  if (!isNative || !canTriggerInstantHaptic()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Rigid impact - firm feel for confirmations
 */
export async function hapticRigid() {
  if (!isNative || !canTriggerInstantHaptic()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {
    // Ignore errors
  }
}
