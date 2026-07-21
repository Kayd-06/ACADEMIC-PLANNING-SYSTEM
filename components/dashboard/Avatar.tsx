'use client'

import { useEffect, useState } from 'react'

function initialsFromName(name: string): string {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// Renders a profile photo, falling back to an initials circle when there's no
// photo URL or the URL fails to load (deleted blob, broken external link, etc.)
export default function Avatar({
  src,
  name,
  initials,
  size,
  shapeClassName = 'rounded-full',
  colorClassName = 'bg-[#0b1320] text-white',
  textClassName = 'text-sm font-bold',
}: {
  src?: string | null
  name: string
  initials?: string
  size: string
  shapeClassName?: string
  colorClassName?: string
  textClassName?: string
}) {
  const [broken, setBroken] = useState(false)

  useEffect(() => { setBroken(false) }, [src])

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        className={`${size} ${shapeClassName} object-cover shrink-0`}
        onError={() => setBroken(true)}
      />
    )
  }

  return (
    <div className={`${size} ${shapeClassName} ${colorClassName} ${textClassName} flex items-center justify-center shrink-0`}>
      {initials ?? initialsFromName(name)}
    </div>
  )
}
