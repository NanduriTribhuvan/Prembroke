/**
 * Prembroke leaf mark — inline SVG so it scales crisply at any size and
 * needs no raster asset. Dark-green blade, gold midrib + veins + serrated edge.
 *
 * Colours are optional props so the mark can pick up a theme when desired; the
 * defaults reproduce the brand exactly, so existing call sites are unchanged.
 */
export default function LeafLogo({
  size = 20,
  blade = '#14532d',
  stroke = '#d9a521',
  vein = '#c99a2e'
}: {
  size?: number
  /** Blade fill colour. */
  blade?: string
  /** Outline + stem stroke colour. */
  stroke?: string
  /** Midrib + side-vein stroke colour. */
  vein?: string
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Prembroke"
    >
      {/* blade */}
      <path
        d="M50 12C30 12 16 24 13 44c-1 6 1 9 1 9s3 2 9 1c20-3 32-17 32-37 0-3-2-6-5-6z"
        fill={blade}
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* stem */}
      <path d="M14 53C18 44 24 36 33 30" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
      {/* midrib */}
      <path d="M19 49C28 41 38 31 49 19" stroke={vein} strokeWidth="1.8" strokeLinecap="round" />
      {/* side veins */}
      <g stroke={vein} strokeWidth="1.2" strokeLinecap="round" opacity="0.9">
        <path d="M25 45C29 44 33 42 36 38" />
        <path d="M30 40C34 39 38 37 41 33" />
        <path d="M35 35C39 34 42 32 45 28" />
        <path d="M24 43C22 39 22 35 23 32" />
        <path d="M30 38C28 34 28 31 29 28" />
        <path d="M36 32C34 29 34 26 35 23" />
      </g>
    </svg>
  )
}
