import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const caseStudies = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/case-studies' }),
  schema: z.object({
    title: z.string(),
    company: z.string(),
    industry: z.string(),
    location: z.string().optional(),
    companySize: z.string().optional(),
    challenge: z.string(),
    deliverable: z.string(),
    tools: z.array(z.string()).default([]),
    duration: z.string().optional(),
    role: z.string().optional(),
    demoLink: z.string().optional(),
    color: z.enum(['terracotta', 'avocado', 'mustard']),
    initials: z.string().max(3),
    order: z.number().default(99),
    draft: z.boolean().default(false),
  }),
});

const resources = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/resources' }),
  schema: z.object({
    title: z.string(),
    blurb: z.string(),
    type: z.enum(['Framework', 'Template', 'Prompt library', 'Tool walkthrough', 'Case pattern', 'Interactive']),
    tags: z.array(z.string()).default([]),
    timeToUse: z.string().optional(),
    downloadUrl: z.string().optional(),
    downloadLabel: z.string().optional(),
    externalUrl: z.string().optional(),
    embedUrl: z.string().optional(),
    embedMinHeight: z.string().optional(),
    color: z.enum(['terracotta', 'avocado', 'mustard']).default('terracotta'),
    featured: z.boolean().default(false),
    order: z.number().default(99),
    draft: z.boolean().default(false),
    updated: z.date().optional(),
  }),
});

export const collections = {
  'case-studies': caseStudies,
  resources,
};
