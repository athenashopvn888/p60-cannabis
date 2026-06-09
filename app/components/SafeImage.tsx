"use client";

import React from "react";

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}

export default function SafeImage({ src, alt, className, loading }: SafeImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      className={className}
      onError={(e) => {
        const t = e.currentTarget;
        if (t.src.indexOf('r2.dev') !== -1 || t.src.indexOf('images.torontodispensaryhub.com') !== -1) {
          const filename = t.src.split('/').pop();
          t.src = 'https://athena-cannabis-images.vercel.app/products/' + filename;
        }
      }}
    />
  );
}
