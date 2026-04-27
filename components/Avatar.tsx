import React, { useEffect, useState } from 'react';

interface AvatarProps {
  name?: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

const colors = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-sky-600',
  'bg-emerald-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-cyan-600',
  'bg-fuchsia-600',
];

const getInitials = (name?: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const getColor = (name?: string) => {
  const value = (name || '?').trim();
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % colors.length;
  }
  return colors[Math.abs(hash) % colors.length];
};

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'sm', className = '', title }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(src) && !imageFailed;
  const label = name?.trim() || 'Unknown user';

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  return (
    <div
      title={title || label}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 shadow-sm ${sizeClasses[size]} ${showImage ? 'bg-slate-100' : getColor(label)} ${className}`}
    >
      {showImage ? (
        <img
          src={src || undefined}
          alt={`${label} avatar`}
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-bold leading-none text-white">{getInitials(label)}</span>
      )}
    </div>
  );
};
