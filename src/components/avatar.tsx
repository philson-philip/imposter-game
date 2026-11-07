const HUES = [262, 332, 198, 152, 28, 356, 290, 182, 48, 222, 100, 12];

/** First grapheme of a name, so Malayalam names show their first letter correctly. */
export function initialOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const first = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(trimmed)[Symbol.iterator]().next();
    if (!first.done) return first.value.segment.toLocaleUpperCase();
  }
  return Array.from(trimmed)[0].toLocaleUpperCase();
}

export function avatarHue(index: number): number {
  return HUES[((index % HUES.length) + HUES.length) % HUES.length];
}

const SIZES = {
  sm: "h-8 w-8 text-sm",
  md: "h-11 w-11 text-base",
  lg: "h-20 w-20 text-3xl",
  xl: "h-28 w-28 text-5xl",
} as const;

export function Avatar({
  name,
  index,
  size = "md",
  className = "",
}: {
  name: string;
  index: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const hue = avatarHue(index);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none ${SIZES[size]} ${className}`}
      style={{
        background: `hsl(${hue} 55% 20%)`,
        color: `hsl(${hue} 90% 82%)`,
        boxShadow: `inset 0 0 0 1.5px hsl(${hue} 60% 38%)`,
      }}
    >
      {initialOf(name)}
    </span>
  );
}
