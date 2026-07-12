import { NextRequest, NextResponse } from 'next/server'
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

    // If it's a private Vercel Blob URL, fetch it using the BLOB_READ_WRITE_TOKEN
    if (isVercelBlob && !isPublicVercelBlob) {
      const headers: Record<string, string> = {}
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
      }

      const blobRes = await fetch(url, { headers })
      if (!blobRes.ok) {
        return NextResponse.json({ error: 'Failed to access private blob file' }, { status: blobRes.status })
      }

      const contentType = blobRes.headers.get('content-type') || 'application/octet-stream'
      const contentDisposition = blobRes.headers.get('content-disposition') || 'inline'

      return new NextResponse(blobRes.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': contentDisposition,
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
