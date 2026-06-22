const AVATAR_SIZES = {
  sm: 24,
  md: 32,
  lg: 56,
} as const;

type AvatarSize = keyof typeof AVATAR_SIZES | number;

interface AvatarProps {
  src: string | null;
  alt?: string;
  /** Edge length in pixels. */
  size?: AvatarSize;
}

/** A square avatar image with a muted fallback when `src` is null. */
function Avatar({ src, alt = "", size = 28 }: AvatarProps) {
  const pixels = typeof size === "number" ? size : AVATAR_SIZES[size];
  const style = { width: pixels, height: pixels };

  if (src === null) {
    return <span className="shrink-0 select-none bg-muted" style={style} />;
  }

  return (
    <img
      alt={alt}
      className="shrink-0 select-none"
      draggable={false}
      loading="lazy"
      src={src}
      style={style}
    />
  );
}

export { Avatar };
