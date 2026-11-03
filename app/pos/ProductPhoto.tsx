"use client";

import { useState } from "react";

export function ProductPhoto({
  src,
  alt,
  className,
  placeholderClassName,
}: {
  src: string | null | undefined;
  alt: string;
  className: string;
  placeholderClassName: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className={placeholderClassName} aria-hidden="true">{alt.slice(0, 1).toUpperCase()}</div>;
  }
  return (
    // Product photos come from the SETB image URL. Native img keeps lazy-loading without a remote image loader.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
