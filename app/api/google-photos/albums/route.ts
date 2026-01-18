import { NextRequest, NextResponse } from 'next/server'
import { getValidAccessToken } from '@/lib/google-auth'

// List user's Google Photos albums
export async function GET(request: NextRequest) {
  // Get authenticated user from middleware (secure)
  const authenticatedUserId = request.headers.get('x-authenticated-user-id')
  const searchParams = request.nextUrl.searchParams
  const userId = authenticatedUserId || searchParams.get('user_id')

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  }

  try {
    const accessToken = await getValidAccessToken(userId, 'google_photos')
    if (!accessToken) {
      return NextResponse.json({ error: 'Google Photos not connected' }, { status: 401 })
    }

    // Fetch albums from Google Photos API
    const albumsResponse = await fetch(
      'https://photoslibrary.googleapis.com/v1/albums?pageSize=50',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!albumsResponse.ok) {
      const errorText = await albumsResponse.text()
      console.error('Google Photos API error:', errorText)
      // Don't expose internal API details to client
      return NextResponse.json({ error: 'Failed to fetch albums' }, { status: 500 })
    }

    const data = await albumsResponse.json()
    const albums = (data.albums || []).map((album: any) => ({
      id: album.id,
      title: album.title,
      coverPhotoBaseUrl: album.coverPhotoBaseUrl,
      mediaItemsCount: parseInt(album.mediaItemsCount || '0', 10),
    }))

    return NextResponse.json({ albums })
  } catch (error) {
    console.error('Albums fetch error:', error)
    // Don't expose error details to client
    return NextResponse.json({ error: 'Failed to fetch albums' }, { status: 500 })
  }
}
