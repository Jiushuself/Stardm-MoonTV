import { NextResponse } from 'next/server';

import { fetchMediaUrl, validateMediaUrl } from '@/lib/url-guard';

export const runtime = 'edge';

const IMAGE_FETCH_HEADERS: Record<string, string> = {
  Referer: 'https://movie.douban.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
};

/**
 * 豆瓣原图域名会对无 Referer 的浏览器直连返回 418。原站偶发 418 / 403 时，
 * 依次尝试两个公开镜像，避免所有海报同时失败并陷入重试闪烁。
 */
function getFallbackUrls(originalUrl: string): string[] {
  try {
    const url = new URL(originalUrl);
    if (!/(^|\.)doubanio\.com$/i.test(url.hostname)) return [];

    return ['img.doubanio.cmliussss.net', 'img.doubanio.cmliussss.com'].map(
      (host) => {
        const fallback = new URL(url.toString());
        fallback.hostname = host;
        return fallback.toString();
      }
    );
  } catch {
    return [];
  }
}

function buildImageResponse(response: Response): Response {
  const contentType = response.headers.get('content-type');
  if (!contentType?.toLowerCase().startsWith('image/')) {
    response.body?.cancel();
    throw new Error('Not an image response');
  }
  if (!response.body) throw new Error('Image response has no body');

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set(
    'Cache-Control',
    'public, max-age=15720000, s-maxage=15720000, stale-while-revalidate=86400'
  );
  headers.set('CDN-Cache-Control', 'public, s-maxage=15720000');
  headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=15720000');
  headers.set('Netlify-Vary', 'query');

  return new Response(response.body, { status: 200, headers });
}

async function fetchImage(url: string, signal: AbortSignal): Promise<Response> {
  const guard = validateMediaUrl(url);
  if (!guard.ok) throw new Error(guard.reason || 'Invalid image URL');

  const response = await fetchMediaUrl(url, {
    signal,
    headers: IMAGE_FETCH_HEADERS,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Image upstream returned ${response.status}`);
  }
  return buildImageResponse(response);
}

// OrionTV 兼容接口，同时为豆瓣海报提供服务端代理与备用镜像。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
  }

  const guard = validateMediaUrl(imageUrl);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }

  let lastStatus = 502;
  try {
    for (const candidate of [imageUrl, ...getFallbackUrls(imageUrl)]) {
      try {
        return await fetchImage(candidate, request.signal);
      } catch (error) {
        if (request.signal.aborted) throw error;
        const match = /returned (\d{3})/.exec((error as Error).message);
        if (match) lastStatus = Number(match[1]);
        // 镜像也可能返回非图片内容或暂时不可用，继续尝试下一个候选地址。
      }
    }
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    return NextResponse.json(
      { error: 'Error fetching image' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: `All image sources failed (last status ${lastStatus})` },
    { status: lastStatus >= 400 && lastStatus <= 599 ? lastStatus : 502 }
  );
}
