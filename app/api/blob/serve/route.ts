import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url') || searchParams.get('pathname') || searchParams.get('path')
    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    if (url.startsWith('data:')) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    if (url.startsWith('/')) {
      return NextResponse.redirect(new URL(url, req.url))
    }

    const isVercelBlob = url.includes('.blob.vercel-storage.com')
    const isPublicVercelBlob = url.includes('.public.blob.vercel-storage.com')

    // If it's a private Vercel Blob URL, fetch it via the SDK — this project
    // is connected to Blob through OIDC federation rather than a static
    // BLOB_READ_WRITE_TOKEN, and get() authenticates with whichever of the
    // two is actually available (same as put() already does for uploads).
    if (isVercelBlob && !isPublicVercelBlob) {
      const result = await get(url, { access: 'private' })
      if (!result || result.statusCode !== 200) {
        return NextResponse.json({ error: 'Failed to access private blob file' }, { status: 404 })
      }

      return new NextResponse(result.stream, {
        status: 200,
        headers: {
          'Content-Type': result.blob.contentType,
          'Content-Disposition': result.blob.contentDisposition || 'inline',
          'Cache-Control': 'private, max-age=3600',
        },
      })
    }

    // For existing public blob URLs or external image URLs, redirect directly to preserve backward compatibility
    return NextResponse.redirect(url)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to serve blob' }, { status: 500 })
  }
}
