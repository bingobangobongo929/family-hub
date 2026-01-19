/**
 * Family Hub Native Plugin
 *
 * TypeScript wrapper for native iOS functionality including:
 * - Document Scanner (VisionKit)
 * - Photo Library Picker
 * - Camera
 * - Voice Recognition (Speech Framework)
 * - Share Extension content
 * - Accessibility settings
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

// Plugin interface
interface FamilyHubNativePluginInterface {
  // Document Scanner
  openDocumentScanner(): Promise<{
    images: Array<{
      index: number;
      base64: string;
      width: number;
      height: number;
    }>;
    pageCount: number;
  }>;

  // Photo Library
  openPhotoLibrary(options?: { multiple?: boolean }): Promise<{
    images: Array<{
      index: number;
      base64: string;
      width: number;
      height: number;
    }>;
  }>;

  // Camera
  openCamera(): Promise<{
    image: {
      base64: string;
      width: number;
      height: number;
    };
  }>;

  // Voice Recognition
  checkVoicePermission(): Promise<{ speech: boolean; microphone: boolean }>;
  requestVoicePermission(): Promise<{ speech: boolean; microphone: boolean }>;
  startVoiceRecognition(options?: { locale?: string }): Promise<{
    text: string;
    isFinal: boolean;
  }>;
  stopVoiceRecognition(): Promise<{ text: string }>;

  // Share Extension
  getSharedContent(): Promise<{
    hasContent: boolean;
    images?: string[];
    texts?: string[];
  }>;
  clearSharedContent(): Promise<void>;

  // Accessibility
  checkReduceMotion(): Promise<{ reduceMotion: boolean }>;

  // Event listener
  addListener(
    eventName: 'voicePartialResult',
    listenerFunc: (data: { text: string; isFinal: boolean }) => void
  ): Promise<{ remove: () => void }>;
}

// Register the plugin
const FamilyHubNative = registerPlugin<FamilyHubNativePluginInterface>(
  'FamilyHubNative'
);

// Check if running on iOS
export const isNativeIOS = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

// Web fallback implementations
const webFallback: FamilyHubNativePluginInterface = {
  async openDocumentScanner() {
    throw new Error('Document scanner is only available on iOS');
  },
  async openPhotoLibrary() {
    throw new Error('Native photo library is only available on iOS');
  },
  async openCamera() {
    throw new Error('Native camera is only available on iOS');
  },
  async checkVoicePermission() {
    return { speech: false, microphone: false };
  },
  async requestVoicePermission() {
    return { speech: false, microphone: false };
  },
  async startVoiceRecognition() {
    throw new Error('Voice recognition is only available on iOS');
  },
  async stopVoiceRecognition() {
    return { text: '' };
  },
  async getSharedContent() {
    return { hasContent: false };
  },
  async clearSharedContent() {},
  async checkReduceMotion() {
    // Use CSS media query for web
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return { reduceMotion: mediaQuery.matches };
  },
  async addListener() {
    return { remove: () => {} };
  },
};

// Export functions with web fallbacks

/**
 * Open iOS document scanner (VisionKit)
 * Returns scanned documents as base64 images
 */
export async function openDocumentScanner() {
  if (!isNativeIOS()) {
    return webFallback.openDocumentScanner();
  }
  return FamilyHubNative.openDocumentScanner();
}

/**
 * Open native photo library picker
 * @param multiple - Allow multiple image selection
 */
export async function openPhotoLibrary(multiple = false) {
  if (!isNativeIOS()) {
    return webFallback.openPhotoLibrary();
  }
  return FamilyHubNative.openPhotoLibrary({ multiple });
}

/**
 * Open native camera
 */
export async function openCamera() {
  if (!isNativeIOS()) {
    return webFallback.openCamera();
  }
  return FamilyHubNative.openCamera();
}

/**
 * Check voice recognition permissions
 */
export async function checkVoicePermission() {
  if (!isNativeIOS()) {
    return webFallback.checkVoicePermission();
  }
  return FamilyHubNative.checkVoicePermission();
}

/**
 * Request voice recognition permissions
 */
export async function requestVoicePermission() {
  if (!isNativeIOS()) {
    return webFallback.requestVoicePermission();
  }
  return FamilyHubNative.requestVoicePermission();
}

/**
 * Start voice recognition
 * @param locale - Language locale (e.g., 'en-US', 'da-DK')
 */
export async function startVoiceRecognition(locale = 'en-US') {
  if (!isNativeIOS()) {
    return webFallback.startVoiceRecognition();
  }
  return FamilyHubNative.startVoiceRecognition({ locale });
}

/**
 * Stop voice recognition and get final result
 */
export async function stopVoiceRecognition() {
  if (!isNativeIOS()) {
    return webFallback.stopVoiceRecognition();
  }
  return FamilyHubNative.stopVoiceRecognition();
}

/**
 * Add listener for voice recognition partial results
 */
export async function addVoiceListener(
  callback: (data: { text: string; isFinal: boolean }) => void
) {
  if (!isNativeIOS()) {
    return { remove: () => {} };
  }
  return FamilyHubNative.addListener('voicePartialResult', callback);
}

/**
 * Get content shared from Share Extension
 */
export async function getSharedContent() {
  if (!isNativeIOS()) {
    return webFallback.getSharedContent();
  }
  return FamilyHubNative.getSharedContent();
}

/**
 * Clear shared content after processing
 */
export async function clearSharedContent() {
  if (!isNativeIOS()) {
    return;
  }
  return FamilyHubNative.clearSharedContent();
}

/**
 * Check if user has Reduce Motion enabled
 */
export async function checkReduceMotion() {
  if (!isNativeIOS()) {
    return webFallback.checkReduceMotion();
  }
  return FamilyHubNative.checkReduceMotion();
}

// ============================================================
// Web Speech API Fallback for Voice Input
// ============================================================

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

let webSpeechRecognition: SpeechRecognition | null = null;

/**
 * Check if Web Speech API is available (for non-iOS platforms)
 */
export function isWebSpeechAvailable(): boolean {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

/**
 * Start Web Speech API recognition (for non-iOS platforms)
 */
export function startWebSpeechRecognition(
  locale: string,
  onResult: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void
): void {
  const SpeechRecognitionClass =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    onError?.('Speech recognition not supported');
    return;
  }

  webSpeechRecognition = new SpeechRecognitionClass();
  webSpeechRecognition.continuous = true;
  webSpeechRecognition.interimResults = true;
  webSpeechRecognition.lang = locale;

  webSpeechRecognition.onresult = (event: SpeechRecognitionEvent) => {
    let transcript = '';
    let isFinal = false;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        isFinal = true;
      }
    }

    onResult(transcript, isFinal);
  };

  webSpeechRecognition.onerror = () => {
    onError?.('Speech recognition error');
  };

  webSpeechRecognition.start();
}

/**
 * Stop Web Speech API recognition
 */
export function stopWebSpeechRecognition(): void {
  if (webSpeechRecognition) {
    webSpeechRecognition.stop();
    webSpeechRecognition = null;
  }
}
