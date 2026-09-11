import { z } from 'zod';

// === Permissions ===
// formát: "fs:read:data/leads", "fs:write:data/reports", "net:fetch:*", "exec:cli/firmy"
export const PermissionSchema = z
  .string()
  .regex(/^(fs:(read|write):.+|net:fetch:.+|exec:.+)$/, 'neplatný permission formát');
export type Permission = z.infer<typeof PermissionSchema>;

export const ReputationSchema = z.object({
  success: z.number().int().min(0).default(0),
  failure: z.number().int().min(0).default(0),
  ewma: z.number().min(0).max(1).default(0.5),
  totalRuns: z.number().int().min(0).default(0),
  avgLatencyMs: z.number().min(0).default(0),
  lastUsed: z.string().datetime().optional(),
});
export type Reputation = z.infer<typeof ReputationSchema>;

export const BaseManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id musí být kebab-case').min(2).max(64),
  type: z.enum(['agent', 'mcp', 'cli', 'rag', 'loop', 'workflow', 'team', 'skill']),
  displayName: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  status: z.enum(['draft', 'testing', 'active', 'paused', 'deprecated', 'broken']).default('draft'),
  description: z.string().max(500).optional(),
  runtime: z.enum(['node', 'python', 'rust', 'prompt', 'ollama', 'composite']).default('prompt'),
  entrypoint: z.string().min(1),
  model: z.string().default('qwen2.5-coder:3b'),
  inputs: z.record(z.string(), z.string()).default({}),
  outputs: z.record(z.string(), z.string()).default({}),
  permissions: z.array(PermissionSchema).default([]),
  mcp_expose: z.boolean().default(false),
  dependencies: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
  tags: z.array(z.string()).default([]),
  reputation: ReputationSchema.default({
    success: 0,
    failure: 0,
    ewma: 0.5,
    totalRuns: 0,
    avgLatencyMs: 0,
  }),
  freshness_ttl_hours: z.number().int().min(1).max(8760).default(24),
  _filePath: z.string().optional(),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  updatedAt: z.string().datetime().default(() => new Date().toISOString()),
});
export type BaseManifest = z.infer<typeof BaseManifestSchema>;

// === Rozšíření podle typu ===

export const AgentManifestSchema = BaseManifestSchema.extend({
  type: z.literal('agent'),
  systemPrompt: z.string().optional(),
  memoryFile: z.string().default('memory.json'),
  auditFile: z.string().default('audit.json'),
  guardrailsFile: z.string().default('03_GUARDRAILS.md'),
  commands: z.array(z.string()).default([]),
  specialization: z.array(z.string()).default([]),
});

export const CliManifestSchema = BaseManifestSchema.extend({
  type: z.literal('cli'),
  subcommands: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        flags: z
          .array(
            z.object({
              name: z.string(),
              type: z.enum(['string', 'number', 'boolean']),
              required: z.boolean().default(false),
              description: z.string().optional(),
            })
          )
          .default([]),
      })
    )
    .default([]),
});

export const McpManifestSchema = BaseManifestSchema.extend({
  type: z.literal('mcp'),
  transport: z.enum(['stdio', 'http', 'sse']).default('stdio'),
  tools: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        inputSchema: z.record(z.string(), z.any()),
      })
    )
    .default([]),
});

export const RagManifestSchema = BaseManifestSchema.extend({
  type: z.literal('rag'),
  embeddingModel: z.string().default('nomic-embed-text'),
  chunkSize: z.number().int().min(100).max(4000).default(1000),
  chunkOverlap: z.number().int().min(0).max(500).default(200),
  sources: z
    .array(
      z.object({
        type: z.enum(['file', 'dir', 'url']),
        path: z.string(),
        pattern: z.string().optional(),
      })
    )
    .default([]),
});

export const LoopManifestSchema = BaseManifestSchema.extend({
  type: z.literal('loop'),
  schedule: z.string(), // cron výraz
  action: z.object({
    capabilityId: z.string(),
    input: z.record(z.string(), z.any()),
  }),
  retryOnFailure: z.boolean().default(false),
  maxRetries: z.number().int().min(0).max(5).default(0),
});

export const WorkflowManifestSchema = BaseManifestSchema.extend({
  type: z.literal('workflow'),
  steps: z
    .array(
      z.object({
        id: z.string(),
        capabilityId: z.string(),
        input: z.record(z.string(), z.any()).default({}),
        dependsOn: z.array(z.string()).default([]),
        retryPolicy: z.enum(['none', 'on-failure', 'always']).default('none'),
      })
    )
    .min(1),
});

export const TeamManifestSchema = BaseManifestSchema.extend({
  type: z.literal('team'),
  members: z.array(z.string()).min(1),
  coordination: z.enum(['sequential', 'parallel', 'router', 'debate']).default('sequential'),
  sharedMemory: z.string().optional(),
});

export const SkillManifestSchema = BaseManifestSchema.extend({
  type: z.literal('skill'),
  pure: z.boolean().default(true),
});

export const CapabilityManifestSchema = z.discriminatedUnion('type', [
  AgentManifestSchema,
  CliManifestSchema,
  McpManifestSchema,
  RagManifestSchema,
  LoopManifestSchema,
  WorkflowManifestSchema,
  TeamManifestSchema,
  SkillManifestSchema,
]);
export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;
