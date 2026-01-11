'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Smile, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import EmojiPicker from './EmojiPicker'
import Modal from './ui/Modal'

interface PhotoUploadProps {
  photoUrl: string | null
  emoji: string | null
  name: string
  color: string
  onPhotoChange: (url: string | null) => void
  onEmojiChange: (emoji: string) => void
  bucket: 'avatars' | 'contact-photos'
  size?: 'sm' | 'md' | 'lg'
}

export default function PhotoUpload({
  photoUrl,
  emoji,
  name,
  color,
  onPhotoChange,
  onEmojiChange,
  bucket,
  size = 'lg',
}: PhotoUploadProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showOptions, setShowOptions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sizeClasses = {
    sm: 'w-16 h-16 text-2xl',
    md: 'w-24 h-24 text-4xl',
    lg: 'w-32 h-32 text-5xl',
  }

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!user) {
      setError('Please sign in to upload photos')
      return
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) throw uploadError

      // Get signed URL for private bucket (valid for 1 year)
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileName, 60 * 60 * 24 * 365) // 1 year

      if (signedError) throw signedError

      console.log('Signed URL response:', signedData)

      if (!signedData?.signedUrl) {
        throw new Error('No signed URL returned')
      }

      console.log('Setting photo URL:', signedData.signedUrl)
      onPhotoChange(signedData.signedUrl)
      onEmojiChange('') // Clear emoji when photo is set
      setShowOptions(false)
    } catch (err) {
      console.error('Upload error:', err)
      setError('Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }, [user, bucket, onPhotoChange, onEmojiChange])

  const handleRemovePhoto = useCallback(() => {
    onPhotoChange(null)
    setShowOptions(false)
  }, [onPhotoChange])

  const handleEmojiSelect = useCallback((selectedEmoji: string) => {
    onEmojiChange(selectedEmoji)
    onPhotoChange(null) // Clear photo when emoji is set
    setShowEmojiPicker(false)
    setShowOptions(false)
  }, [onEmojiChange, onPhotoChange])

  // Determine what to display
  const displayContent = () => {
    if (photoUrl) {
      return (
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      )
    }
    if (emoji) {
      return <span>{emoji}</span>
    }
    return <span className="text-white font-semibold">{name.charAt(0).toUpperCase()}</span>
  }

  return (
    <div className="relative">
      {/* Avatar Display */}
      <button
        type="button"
        onClick={() => setShowOptions(true)}
        className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center transition-all hover:scale-105 active:scale-95 ring-4 ring-white dark:ring-slate-700 shadow-lg relative group`}
        style={{ backgroundColor: photoUrl ? 'transparent' : color }}
      >
        {displayContent()}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="w-8 h-8 text-white" />
        </div>
      </button>

      {/* Uploading indicator */}
      {uploading && (
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Options Modal */}
      <Modal
        isOpen={showOptions}
        onClose={() => setShowOptions(false)}
        title="Change Avatar"
        size="sm"
      >
        <div className="space-y-3">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Current avatar preview */}
          <div className="flex justify-center py-4">
            <div
              className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center ring-4 ring-slate-200 dark:ring-slate-600`}
              style={{ backgroundColor: photoUrl ? 'transparent' : color }}
            >
              {displayContent()}
            </div>
          </div>

          {/* Options */}
          <button
            onClick={() => {
              setShowOptions(false)
              fileInputRef.current?.click()
            }}
            disabled={uploading}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center">
              <Camera className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-left">
              <p className="font-medium text-slate-800 dark:text-slate-100">Upload Photo</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Choose from your device</p>
            </div>
          </button>

          <button
            onClick={() => {
              setShowOptions(false)
              setShowEmojiPicker(true)
            }}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <Smile className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-left">
              <p className="font-medium text-slate-800 dark:text-slate-100">Choose Emoji</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pick an emoji avatar</p>
            </div>
          </button>

          {(photoUrl || emoji) && (
            <button
              onClick={handleRemovePhoto}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="text-left">
                <p className="font-medium text-red-700 dark:text-red-300">Remove Avatar</p>
                <p className="text-sm text-red-500 dark:text-red-400">Use first letter instead</p>
              </div>
            </button>
          )}
        </div>
      </Modal>

      {/* Emoji Picker Modal */}
      <Modal
        isOpen={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        title="Choose Emoji"
        size="md"
      >
        <EmojiPicker
          value={emoji || ''}
          onChange={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      </Modal>
    </div>
  )
}

// Simple avatar display component (no editing)
interface AvatarDisplayProps {
  photoUrl: string | null
  emoji: string | null
  name: string
  color: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export function AvatarDisplay({
  photoUrl,
  emoji,
  name,
  color,
  size = 'md',
  className = '',
}: AvatarDisplayProps) {
  const sizeClasses = {
    xs: 'w-8 h-8 text-sm',
    sm: 'w-10 h-10 text-lg',
    md: 'w-12 h-12 text-xl',
    lg: 'w-16 h-16 text-3xl',
  }

  const displayContent = () => {
    if (photoUrl) {
      return (
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      )
    }
    if (emoji) {
      return <span>{emoji}</span>
    }
    return <span className="text-white font-semibold">{name.charAt(0).toUpperCase()}</span>
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center ring-2 ring-white dark:ring-slate-700 shadow-sm ${className}`}
      style={{ backgroundColor: photoUrl ? 'transparent' : color }}
      title={name}
    >
      {displayContent()}
    </div>
  )
}
