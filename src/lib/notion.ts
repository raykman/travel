// Notion API client — fetches upcoming schedule + travel posts at build time.
//
// Uses the Notion REST API directly for database queries (the v5.17 SDK
// removed databases.query and its dataSources.query replacement doesn't work
// with the public API). The @notionhq/client is still used for blocks.children
// to read page body content.
//
// Schedule database:
//   Title    (Title)
//   Subtitle (Rich text)
//   Date     (Date)
//   Day      (Number)
//
// Posts database:
//   Title     (Title)
//   Date      (Date)
//   Day       (Number)        — trip day 1..62
//   Location  (Rich text)     — city name
//   Country   (Select)        — vietnam | cambodia | laos | indonesia
//   Latitude  (Number)
//   Longitude (Number)
//   Image URL (URL)           — externally-hosted photo
//   Image Alt (Rich text)
//   Published (Checkbox)      — only checked entries appear on the site
//   Body = the page content (paragraph blocks underneath the properties)
//
// Env vars (set in Cloudflare Pages):
//   NOTION_API_KEY
//   NOTION_SCHEDULE_DB_ID  — database ID for the schedule database
//   NOTION_POSTS_DB_ID     — database ID for the posts database

import { Client } from '@notionhq/client';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface UpcomingEntry {
  id: string;
  day: number;
  title: string;
  subtitle: string;
  dateLabel: string;
}

export interface NotionPost {
  id: string;
  data: {
    title: string;
    date: Date;
    day: number;
    location: string;
    country: string;
    coordinates: [number, number];
    images: Array<{ url: string; alt: string }>;
  };
  body: string;
}

const API_KEY = import.meta.env.NOTION_API_KEY ?? process.env.NOTION_API_KEY;
const SCHEDULE_DB_ID = import.meta.env.NOTION_SCHEDULE_DB_ID ?? process.env.NOTION_SCHEDULE_DB_ID;
const POSTS_DB_ID = import.meta.env.NOTION_POSTS_DB_ID ?? process.env.NOTION_POSTS_DB_ID;

const NOTION_VERSION = '2022-06-28';

/** Query a Notion database via the REST API (the SDK v5.17 removed this method). */
async function queryDatabase(databaseId: string, body: Record<string, any> = {}): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion query failed (${res.status}): ${err}`);
  }
  return res.json();
}

const MAX_ENTRIES = 7;

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return '';
  }
}

/**
 * Best-effort extraction: Notion's property shapes are verbose and versioned.
 * Typed as `any` locally because the Notion SDK's discriminated unions don't
 * meaningfully help us at a build script level — we just guard every access.
 */
function extractText(prop: any): string {
  if (!prop) return '';
  if (prop.type === 'title' && Array.isArray(prop.title)) {
    return prop.title.map((t: any) => t.plain_text ?? '').join('');
  }
  if (prop.type === 'rich_text' && Array.isArray(prop.rich_text)) {
    return prop.rich_text.map((t: any) => t.plain_text ?? '').join('');
  }
  return '';
}

function extractNumber(prop: any): number | null {
  if (!prop) return null;
  if (prop.type === 'number' && typeof prop.number === 'number') return prop.number;
  return null;
}

function extractDate(prop: any): string | null {
  if (!prop) return null;
  if (prop.type === 'date' && prop.date?.start) return prop.date.start;
  return null;
}

function extractUrl(prop: any): string | null {
  if (!prop) return null;
  if (prop.type === 'url' && typeof prop.url === 'string') return prop.url;
  return null;
}

function extractSelect(prop: any): string | null {
  if (!prop) return null;
  if (prop.type === 'select' && prop.select?.name) return prop.select.name;
  return null;
}

/** Extract plain text from a Notion rich_text segment array (used for block content). */
function richTextToPlain(segments: any[]): string {
  if (!Array.isArray(segments)) return '';
  return segments.map((t: any) => t.plain_text ?? '').join('');
}

// --- Image download ---
// Notion-hosted images use temporary signed URLs that expire after ~1 hour.
// We download them at build time to public/uploads/ so the site serves its
// own copy. The filename is a hash of the Notion block ID (stable across
// rebuilds as long as the image hasn't changed).

const UPLOADS_DIR = join(process.cwd(), 'public', 'uploads');

/** Guess file extension from Content-Type header or URL path. */
function guessExt(contentType: string | null, url: string): string {
  if (contentType?.includes('png')) return '.png';
  if (contentType?.includes('webp')) return '.webp';
  if (contentType?.includes('gif')) return '.gif';
  // Default to jpg for jpeg and anything ambiguous
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return '.jpg';
  // Try URL path as fallback
  const match = url.match(/\.(png|jpg|jpeg|webp|gif)/i);
  if (match) return '.' + match[1].toLowerCase().replace('jpeg', 'jpg');
  return '.jpg';
}

/**
 * Download an image from a URL and save it to public/uploads/.
 * Returns the public path (e.g. "/uploads/abc123.jpg") or null on failure.
 * Uses blockId as a stable cache key so the same Notion image block always
 * maps to the same filename. Re-downloads if the file doesn't exist (e.g.
 * after a clean build) since the signed URL changes every time anyway.
 */
async function downloadImage(srcUrl: string, blockId: string): Promise<string | null> {
  try {
    mkdirSync(UPLOADS_DIR, { recursive: true });
    const hash = createHash('sha256').update(blockId).digest('hex').slice(0, 16);

    const resp = await fetch(srcUrl);
    if (!resp.ok) {
      console.warn(`[notion] Image download failed (${resp.status}): ${srcUrl.slice(0, 80)}`);
      return null;
    }

    const contentType = resp.headers.get('content-type');
    const ext = guessExt(contentType, srcUrl);
    const filename = `${hash}${ext}`;
    const destPath = join(UPLOADS_DIR, filename);

    const buffer = Buffer.from(await resp.arrayBuffer());
    writeFileSync(destPath, buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.warn('[notion] Failed to download image:', err);
    return null;
  }
}

/** Extract the source URL from a Notion image block. */
function getImageUrl(block: any): string | null {
  const img = block.image;
  if (!img) return null;
  if (img.type === 'file') return img.file?.url ?? null;
  if (img.type === 'external') return img.external?.url ?? null;
  return null;
}

/** Extract alt/caption text from a Notion image block. */
function getImageCaption(block: any): string {
  return richTextToPlain(block.image?.caption ?? []);
}

interface PageContent {
  body: string;
  images: Array<{ url: string; alt: string }>;
}

/**
 * Reads the page body (child blocks). Returns plain text body AND any
 * images found as blocks (downloaded to public/uploads/).
 */
async function fetchPageContent(notion: Client, pageId: string): Promise<PageContent> {
  const result: PageContent = { body: '', images: [] };
  try {
    const res = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
    const lines: string[] = [];
    for (const block of res.results as any[]) {
      const t = block.type;
      if (t === 'paragraph') {
        const text = richTextToPlain(block.paragraph.rich_text);
        if (text) lines.push(text);
      } else if (t === 'heading_1') {
        lines.push(richTextToPlain(block.heading_1.rich_text));
      } else if (t === 'heading_2') {
        lines.push(richTextToPlain(block.heading_2.rich_text));
      } else if (t === 'heading_3') {
        lines.push(richTextToPlain(block.heading_3.rich_text));
      } else if (t === 'bulleted_list_item') {
        lines.push(richTextToPlain(block.bulleted_list_item.rich_text));
      } else if (t === 'numbered_list_item') {
        lines.push(richTextToPlain(block.numbered_list_item.rich_text));
      } else if (t === 'image') {
        const srcUrl = getImageUrl(block);
        if (srcUrl) {
          const localPath = await downloadImage(srcUrl, block.id);
          if (localPath) {
            result.images.push({
              url: localPath,
              alt: getImageCaption(block) || '',
            });
          }
        }
      }
    }
    result.body = lines.join('\n\n');
  } catch (err) {
    console.warn('[notion] Failed to fetch page content:', err);
  }
  return result;
}

export async function getUpcoming(): Promise<UpcomingEntry[]> {
  if (!API_KEY || !SCHEDULE_DB_ID) {
    // Not configured — fail silent so the page still renders.
    return [];
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    const res = await queryDatabase(SCHEDULE_DB_ID, {
      filter: {
        property: 'Date',
        date: { on_or_after: today },
      },
      sorts: [{ property: 'Date', direction: 'ascending' }],
      page_size: MAX_ENTRIES,
    });

    const entries: UpcomingEntry[] = [];
    for (const page of res.results as any[]) {
      const props = page.properties ?? {};
      const title = extractText(props['Title'] ?? props['Name']);
      if (!title) continue;
      const day = extractNumber(props['Day']) ?? 0;
      const subtitle = extractText(props['Subtitle']);
      const iso = extractDate(props['Date']);
      if (!iso) continue;

      entries.push({
        id: page.id,
        day,
        title,
        subtitle,
        dateLabel: formatDate(iso),
      });
    }
    return entries;
  } catch (err) {
    // Fallback: don't break the page on Notion failures.
    console.warn('[notion] Failed to fetch upcoming schedule:', err);
    return [];
  }
}

/**
 * Fetch travel posts from a second Notion database. Returns an empty array
 * if NOTION_POSTS_DATABASE_ID is not set, so the site can always fall back
 * to local markdown posts.
 */
export async function getNotionPosts(): Promise<NotionPost[]> {
  console.log(`[notion] API_KEY set: ${!!API_KEY}, POSTS_DB_ID set: ${!!POSTS_DB_ID}`);
  if (!API_KEY || !POSTS_DB_ID) return [];

  try {
    const notion = new Client({ auth: API_KEY });

    const res = await queryDatabase(POSTS_DB_ID, {
      filter: {
        property: 'Published',
        checkbox: { equals: true },
      },
      sorts: [{ property: 'Date', direction: 'descending' }],
    });

    console.log(`[notion] Query returned ${res.results?.length ?? 0} published posts`);
    const posts: NotionPost[] = [];
    for (const page of res.results as any[]) {
      const props = page.properties ?? {};
      const title = extractText(props['Title'] ?? props['Name']);
      const dateStr = extractDate(props['Date']);
      const day = extractNumber(props['Day']);
      const location = extractText(props['Location']);
      const country = (extractSelect(props['Country']) ?? '').toLowerCase();
      const lat = extractNumber(props['Latitude']);
      const lng = extractNumber(props['Longitude']);
      const imageUrl = extractUrl(props['Image URL']);
      const imageAlt = extractText(props['Image Alt']);

      // Skip incomplete entries
      if (!title || !dateStr || day === null || !location) continue;
      if (lat === null || lng === null) continue;

      // Images come from two places (both optional):
      //   1. Image URL property — a public URL you paste in (Cloudinary, etc.)
      //   2. Image blocks in the page body — photos dragged/pasted into Notion
      // The property image comes first, then any body images, so it acts as
      // the "hero" photo for the card.
      const images: Array<{ url: string; alt: string }> = [];
      if (imageUrl) {
        images.push({ url: imageUrl, alt: imageAlt || title });
      }

      const content = await fetchPageContent(notion, page.id);
      images.push(...content.images);

      posts.push({
        id: page.id,
        data: {
          title,
          date: new Date(dateStr + 'T00:00:00Z'),
          day,
          location,
          country,
          coordinates: [lat, lng],
          images,
        },
        body: content.body,
      });
    }

    return posts;
  } catch (err) {
    console.warn('[notion] Failed to fetch posts:', err);
    return [];
  }
}
