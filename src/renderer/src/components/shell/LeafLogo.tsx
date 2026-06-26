import logoUrl from '@/assets/logo.png'

/**
 * Pembroke brand mark — the mountain-and-north-star shield emblem.
 *
 * Rendered from the bundled transparent raster so the in-app mark is pixel-for-
 * pixel the same artwork as the window/installer icon. The colour props are
 * retained only for call-site compatibility (the emblem is full-colour art and
 * no longer recolours with the accent); existing call sites pass none.
 */
export default function LeafLogo({
  size = 20
}: {
  size?: number
  /** @deprecated emblem is full-colour artwork; ignored. */
  blade?: string
  /** @deprecated emblem is full-colour artwork; ignored. */
  stroke?: string
  /** @deprecated emblem is full-colour artwork; ignored. */
  vein?: string
}): React.JSX.Element {
  return (
    <img
      src={logoUrl}
      alt="Pembroke"
      draggable={false}
      className="shrink-0 select-none object-contain"
      style={{ width: size, height: size }}
    />
  )
}
