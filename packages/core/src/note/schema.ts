import { z } from 'zod';

export const NoteSchema = z.object({
  file_name: z.string().min(1).max(200),
  title: z.string().min(3).max(200),
  content: z.string().max(50000).default(''),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type Note = z.infer<typeof NoteSchema>;

export const NoteFileSchema = NoteSchema.extend({
  file_name: z.string().regex(/^.+\.md$/),
});