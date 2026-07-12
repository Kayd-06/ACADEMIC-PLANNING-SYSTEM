import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    const uploadDir = path.join(process.cwd(), 'public/uploads')
    const filePath = path.join(uploadDir, filename)

    // Check if file exists on disk
    if (!fs.existsSync(filePath)) {
      return NextResponse.redirect(new URL(`/api/blob/serve?url=${encodeURIComponent(`uploads/${filename}`)}`, req.url))
    }

    const fileBuffer = fs.readFileSync(filePath)
    const ext = path.extname(filename).toLowerCase()
    let contentType = 'application/octet-stream'

    if (ext === '.pdf') {
      contentType = 'application/pdf'
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg'
    } else if (ext === '.png') {
      contentType = 'image/png'
    } else if (ext === '.zip') {
      contentType = 'application/zip'
    } else if (ext === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`
      }
    })
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 })
  }
}
