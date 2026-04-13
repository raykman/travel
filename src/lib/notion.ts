// Notion API client — fetches upcoming schedule entries at build time.
//
// Notion table schema:
//   Date     (Date)
//   Title    (Title)
//   Subtitle (Rich text)
//   Day      (Number)
//
// Env vars (set in Cloudflare Pages):
//   NOTION_API_KEY
//   NOTION_DATABASE_ID

import { Client } from '@notionhq/client';

export interface UpcomingEntry {
  id: string;
  day: number;
  title: string;
  subtitle: string;
  dateLabel: string;
}

const API_KEY = import.meta.env.NOTION_API_KEY;
const DB_ID = import.meta.env.NOTION_DATABASE_ID;

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

export async function getUpcoming(): Promise<UpcomingEntry[]> {
  if (!API_KEY || !DB_ID) {
    // Not configured — fail silent so the page still renders.
    return [];
  }

  try {
    const notion = new Client({ auth: API_KEY });
    const today = new Date().toISOString().slice(0, 10);

    const res = await notion.databases.query({
      database_id: DB_ID,
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
