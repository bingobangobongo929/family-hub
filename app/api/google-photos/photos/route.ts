import { NextRequest, NextResponse } from 'next/server'
import { getValidAccessToken } from '@/lib/google-auth'

// Fetch photos from a Google Photos album
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get('user_id')
  const albumId = searchParams.get('album_id')
  const pageSize = searchParams.get('page_size') || '50'
  const pageToken = searchParams.get('page_token')

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  }

  if (!albumId) {
    return NextResponse.json({ error: 'Album ID required' }, { status: 400 })
  }

  try {
    const accessToken = await getValidAccessToken(userId, 'google_photos')
    if (!accessToken) {
      return NextResponse.json({ error: 'Google Photos not connected' }, { status: 401 })
    }

    // Fetch photos from album using mediaItems:search
    const requestBody: any = {
      albumId,
      pageSize: parseInt(pageSize, 10),
    }

    if (pageToken) {
      requestBody.pageToken = pageToken
    }

    const photosResponse = await fetch(
      'https://photoslibrary.googleapis.com/v1/mediaItems:search',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!photosResponse.ok) {
      const error = await photosResponse.text()
      console.error('Google Photos API error:', error)
      return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
    }

    const data = await photosResponse.json()

    // Filter to only images (exclude videos) and map to simpler structure
    const photos = (data.mediaItems || [])
      .filter((item: any) => item.mimeType?.startsWith('image/'))
      .map((item: any) => ({
        id: item.id,
        baseUrl: item.baseUrl,
        mimeType: item.mimeType,
        width: parseInt(item.mediaMetadata?.width || '0', 10),
        height: parseInt(item.mediaMetadata?.height || '0', 10),
        creationTime: item.mediaMetadata?.creationTime,
        description: item.description,
        // Note: baseUrl expires after ~1 hour, add size parameters for display
        // Use =w{width}-h{height} for specific size, =w2048 for max width, etc.
      }))

    return NextResponse.json({
      photos,
      nextPageToken: data.nextPageToken || null,
    })
  } catch (error) {
    console.error('Photos fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }
}
