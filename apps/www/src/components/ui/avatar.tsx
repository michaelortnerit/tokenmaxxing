interface AvatarProps {
  src: string | null;
  alt?: string;
  /** Diameter in pixels. */
  size?: number;
}

/** A round avatar image with a muted-circle fallback when `src` is null. */
function Avatar({ src, alt = "", size = 28 }: AvatarProps) {
  const style = { width: size, height: size };

  if (src === null) {
    return <span className="shrink-0 rounded-full bg-muted" style={style} />;
  }

  return <img alt={alt} className="shrink-0 rounded-full" loading="lazy" src={src} style={style} />;
}

export { Avatar };
