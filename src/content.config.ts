import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    day: z.number().int().min(1).max(79),
    location: z.string(),
    country: z.enum(['japan', 'vietnam', 'cambodia', 'laos', 'indonesia']),
    // [lat, lng] per spec
    coordinates: z.tuple([z.number(), z.number()]),
    images: z
      .array(
        z.object({
          url: z.string().url(),
          alt: z.string(),
        })
      )
      .min(1),
  }),
});

export const collections = { posts };
