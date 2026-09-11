import { z } from 'zod';

export const ChecklistItemSchema = z.object({
  text: z.string().min(1).max(500),
  done: z.boolean().default(false),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const TaskSchema = z.object({
  file_name: z.string().min(1).max(200),
  title: z.string().min(3).max(200),
  content: z.string().max(50000).default(''),
  done: z.number().int().min(0).max(1).default(0),
  checklist: z.array(ChecklistItemSchema).default([]),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
  priority: z.enum(['low','medium','high']).default('medium'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskFileSchema = TaskSchema.extend({
  file_name: z.string().regex(/^.+\.md$/),
});