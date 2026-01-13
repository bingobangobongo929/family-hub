import { NextRequest, NextResponse } from 'next/server'
import { getValidAccessToken } from '@/lib/google-auth'

// List user's Google Photos albums
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const userId = searchParams.get('user_id')

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  }

  try {
    const accessToken = await getValidAccessToken(userId, 'google_photos')
    if (!accessToken) {
      return NextResponse.json({ error: 'Google Photos not connected' }, { status: 401 })
    }

    // Debug: Check what scopes the token actually has
    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
    )
    const tokenInfo = await tokenInfoResponse.json()

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
      // Return full error for debugging
      let errorJson
      try {
        errorJson = JSON.parse(errorText)
      } catch {
        errorJson = { raw: errorText }
      }
      return NextResponse.json({
        error: 'Failed to fetch albums',
        debug_token_scopes: tokenInfo.scope,
        debug_api_error: errorJson,
        debug_api_status: albumsResponse.status
      }, { status: 500 })
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
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to fetch albums: ${errorMsg}` }, { status: 500 })
  }
}
