// Unified post layer: merges local markdown posts with Notion posts.
// Notion takes precedence when the same trip day exists in both sources.

import { getCollection } from 'astro:content';
import { getNotionPosts } from './notion';

export interface Post {
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

/**
 * Returns all travel posts, newest first. Merges two sources:
 *   1. Local markdown files in src/content/posts/ (always available)
 *   2. Notion posts database (only if NOTION_POSTS_DATABASE_ID is set)
 *
 * When both sources have a post for the same trip day, the Notion
 * version wins — this lets you keep sample markdown posts for local
 * dev while Notion is the source of truth in production.
 */
export async function getAllPosts(): Promise<Post[]> {
  // Local markdown posts
  const localEntries = await getCollection('posts');
  const local: Post[] = localEntries.map((e) => ({
    id: e.id,
    data: {
      title: e.data.title,
      date: e.data.date,
      day: e.data.day,
      location: e.data.location,
      country: e.data.country,
      coordinates: e.data.coordinates,
      images: e.data.images,
    },
    body: e.body ?? '',
  }));

  // Notion posts (empty array if credentials not configured)
  const notion = await getNotionPosts();

  // Merge: index by day, Notion overwrites local on conflict
  const byDay = new Map<number, Post>();
  for (const p of local) byDay.set(p.data.day, p);
  for (const p of notion) byDay.set(p.data.day, p);

  return Array.from(byDay.values()).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime()
  );
}
