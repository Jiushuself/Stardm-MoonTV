'use client';
/* eslint-disable @next/next/no-img-element -- 封面需要按候选地址逐个回退，next/image 无法可靠地重设 src */

import { ImageOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { processImageUrl } from '@/lib/utils';

interface CoverImageProps {
  src?: string;
  alt: string;
  className?: string;
  /** aspect-[2/3] 等用于撑开容器的类名；不传时由父容器决定尺寸 */
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain';
  loading?: 'lazy' | 'eager';
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  onLoad?: () => void;
}

/**
 * 封面优先级：原地址 → 本地图片代理 → 静态「暂无封面」。
 * 每个候选地址只尝试一次，失败后不再重复设置同一张图，避免骨架屏无限闪烁。
 */
function getCandidates(src: string): string[] {
  const processed = processImageUrl(src);
  if (
    !processed ||
    processed.startsWith('data:') ||
    processed.startsWith('blob:') ||
    processed.startsWith('/api/image-proxy?url=')
  ) {
    return processed ? [processed] : [];
  }

  return [processed, `/api/image-proxy?url=${encodeURIComponent(src)}`];
}

export default function CoverImage({
  src = '',
  alt,
  className = '',
  aspectRatio,
  objectFit = 'cover',
  // 封面是首屏主内容；原生懒加载在部分内嵌浏览器 / WebView 中不会触发，
  // 会导致骨架屏一直停留，因此默认立即加载。
  loading = 'eager',
  referrerPolicy,
  onLoad,
}: CoverImageProps) {
  const candidates = useMemo(() => getCandidates(src), [src]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
    // 图片可能命中缓存，在 effect 执行前就已经 complete。此时 onLoad 已经
    // 触发过，不能再把它重置成未加载，否则会永久显示骨架屏。
    const element = imgRef.current;
    setLoaded(!!(element?.complete && element.naturalWidth > 0));
  }, [candidates]);

  const currentSrc = candidates[index];
  const showPlaceholder = !loaded && !failed;
  const wrapperClass = `relative overflow-hidden ${
    aspectRatio || 'h-full w-full'
  }`;

  if (!currentSrc || failed) {
    return (
      <div
        className={`${wrapperClass} flex flex-col items-center justify-center gap-2 bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 ${className}`}
        aria-label={alt ? `${alt}暂无封面` : '暂无封面'}
        role='img'
      >
        <ImageOff className='h-7 w-7' aria-hidden />
        <span className='px-2 text-center text-xs'>暂无封面</span>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      {showPlaceholder && (
        <div
          aria-hidden
          className='absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-700 motion-reduce:animate-none'
        />
      )}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading={loading}
        decoding='async'
        referrerPolicy={referrerPolicy}
        className={`h-full w-full ${
          objectFit === 'contain' ? 'object-contain' : 'object-cover'
        } ${className}`}
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        onError={() => {
          setLoaded(false);
          setIndex((current) => {
            const next = current + 1;
            if (next >= candidates.length) setFailed(true);
            return next;
          });
        }}
      />
    </div>
  );
}
