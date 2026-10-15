import { useState } from 'react';

interface ProductImageProps {
  src: string;
  emoji: string;
  alt: string;
  className?: string;
  /** Stable analytics identity so heatmaps anchor to this exact image element. */
  dataAnalyticsId?: string;
  dataAnalyticsLabel?: string;
}

export default function ProductImage({
  src,
  emoji,
  alt,
  className = '',
  dataAnalyticsId,
  dataAnalyticsLabel,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const identity = {
    ...(dataAnalyticsId ? { 'data-analytics-id': dataAnalyticsId } : {}),
    ...(dataAnalyticsLabel ? { 'data-analytics-label': dataAnalyticsLabel } : {}),
  };
  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-gradient-to-br from-indigo-100 to-fuchsia-100 text-6xl ${className}`}
        {...identity}
      >
        {emoji}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
      {...identity}
    />
  );
}