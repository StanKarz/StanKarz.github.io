import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/data/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(160),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

// One MDX file per section of the SQL reference at /projects/sql/.
const sql = defineCollection({
  loader: glob({ pattern: '**/[^_]*.mdx', base: './src/data/sql/sections' }),
  schema: z.object({
    title: z.string(),
    order: z.number().int(),
    /** One line for the index at the top of the page. */
    summary: z.string(),
  }),
});

export const collections = { blog, sql };
