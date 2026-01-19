'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface LoadingScreenProps {
  minimumDisplay?: number // Minimum ms to show loading (prevents flash)
}

export default function LoadingScreen({ minimumDisplay = 500 }: LoadingScreenProps) {
  const [dots, setDots] = useState('')

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 400)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-br from-teal-50 via-warm-50 to-sage-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Logo/Icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-xl animate-pulse">
          <Image
            src="/icon-512.png"
            alt="Family Hub"
            width={80}
            height={80}
            className="w-full h-full object-cover"
            priority
          />
        </div>
        {/* Glow effect */}
        <div className="absolute inset-0 w-20 h-20 rounded-3xl bg-gradient-to-br from-teal-500 to-sage-600 opacity-30 blur-xl animate-pulse" />
      </div>

      {/* App name */}
      <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-sage-600 dark:from-teal-400 dark:to-sage-400 bg-clip-text text-transparent mb-4">
        Family Hub
      </h1>

      {/* Loading indicator */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>

      {/* Loading text */}
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 min-w-[100px] text-center">
        Loading{dots}
      </p>
    </div>
  )
}

// Static version for initial HTML (no React needed)
export function LoadingScreenHTML() {
  return `
    <div id="app-loading-screen" style="
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(to bottom right, #f0fdfa, #faf5f0, #f0fdf4);
      transition: opacity 0.3s ease-out;
    ">
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .loading-dot { animation: bounce 0.6s infinite; }
        .loading-dot:nth-child(2) { animation-delay: 0.15s; }
        .loading-dot:nth-child(3) { animation-delay: 0.3s; }
        @media (prefers-color-scheme: dark) {
          #app-loading-screen {
            background: linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a) !important;
          }
          #app-loading-screen h1 {
            color: #5eead4 !important;
          }
          #app-loading-screen p {
            color: #94a3b8 !important;
          }
        }
      </style>
      <div style="
        width: 80px;
        height: 80px;
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
        animation: pulse 2s infinite;
        margin-bottom: 24px;
      ">
        <img src="/icon-512.png" alt="Family Hub" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>
      <h1 style="
        font-size: 24px;
        font-weight: bold;
        background: linear-gradient(to right, #0d9488, #65a30d);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 16px;
      ">Family Hub</h1>
      <div style="display: flex; gap: 4px;">
        <div class="loading-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #14b8a6;"></div>
        <div class="loading-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #14b8a6;"></div>
        <div class="loading-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #14b8a6;"></div>
      </div>
      <p style="margin-top: 16px; font-size: 14px; color: #64748b;">Loading...</p>
    </div>
  `
}
