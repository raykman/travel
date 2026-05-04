// Build-time image variant generator.
//
// Generates three WebP sizes (thumb / medium / full) + a tiny LQIP (low-quality
// image placeholder) for every image downloaded from Notion.  Cards display the
// thumb; the lightbox shows thumb immediately then cross-fades to full.
//
// All variants are written alongside the original in UPLOADS_DIR and named
// <hash>-thumb.webp, <hash>-medium.webp, <hash>-full.webp so they are stable
// across rebuilds as long as the cache key (Notion block ID) stays the same.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface PostImage {
  url: string;       // full-res WebP — used in lightbox
  thumbUrl: string;  // 640px WebP  — used in card
  mediumUrl: string; // 1400px WebP — used in lightbox on slower connections
  alt: string;
  lqip: string;      // base64 data URI (~20px wide blur, shown before thumb loads)
}

// Mirror the path logic in notion.ts so all variants land in the same directory.
const UPLOADS_DIR = process.env.NODE_ENV === 'production' || import.meta.env?.PROD
  ? join(process.cwd(), 'dist', 'uploads')
  : join(process.cwd(), 'public', 'uploads');

const THUMB_WIDTH  = 640;
const MEDIUM_WIDTH = 1400;
const FULL_CAP     = 2400;

/**
 * Given a raw image Buffer and a stable cacheKey (e.g. Notion block ID),
 * writes three WebP variants to UPLOADS_DIR and returns the full PostImage
 * descriptor including an inline LQIP.  Falls back to the original URL on any
 * sharp error so the site never breaks if the native module is unavailable.
 */
export async function generateVariants(
  buffer: Buffer,
  cacheKey: string,
  alt: string,
  fallbackUrl: string,
): Promise<PostImage> {
  const hash = createHash('sha256').update(cacheKey).digest('hex').slice(0, 16);

  const fallback: PostImage = {
    url:       fallbackUrl,
    thumbUrl:  fallbackUrl,
    mediumUrl: fallbackUrl,
    alt,
    lqip:      '',
  };

  let sharp: typeof import('sharp');
  try {
    sharp = (await import('sharp')).default as unknown as typeof import('sharp');
  } catch {
    console.warn('[imageVariants] sharp not available — skipping variant generation');
    return fallback;
  }

  try {
    mkdirSync(UPLOADS_DIR, { recursive: true });

    const meta   = await sharp(buffer).metadata();
    const origW  = meta.width ?? 9999;

    const thumbPath  = join(UPLOADS_DIR, `${hash}-thumb.webp`);
    const mediumPath = join(UPLOADS_DIR, `${hash}-medium.webp`);
    const fullPath   = join(UPLOADS_DIR, `${hash}-full.webp`);

    // Only write each variant if it doesn't already exist (idempotent within a build run).
    if (!existsSync(thumbPath)) {
      await sharp(buffer)
        .resize({ width: Math.min(THUMB_WIDTH, origW), withoutEnlargement: true })
        .webp({ quality: 75 })
        .toFile(thumbPath);
    }

    if (!existsSync(mediumPath)) {
      await sharp(buffer)
        .resize({ width: Math.min(MEDIUM_WIDTH, origW), withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(mediumPath);
    }

    if (!existsSync(fullPath)) {
      await sharp(buffer)
        .resize({ width: Math.min(FULL_CAP, origW), withoutEnlargement: true })
        .webp({ quality: 88 })
        .toFile(fullPath);
    }

    // LQIP: 20px wide, heavily blurred — encodes to ~400-600 bytes as base64.
    const lqipBuf = await sharp(buffer)
      .resize({ width: 20, withoutEnlargement: true })
      .blur(2)
      .webp({ quality: 20 })
      .toBuffer();
    const lqip = `data:image/webp;base64,${lqipBuf.toString('base64')}`;

    return {
      url:       `/uploads/${hash}-full.webp`,
      thumbUrl:  `/uploads/${hash}-thumb.webp`,
      mediumUrl: `/uploads/${hash}-medium.webp`,
      alt,
      lqip,
    };
  } catch (err) {
    console.warn('[imageVariants] Failed to generate variants for', cacheKey, err);
    return fallback;
  }
}
