---
name: be-validator
mode: subagent
description: Zod schemas, OpenAPI generation, RFC 9457 error responses, input sanitization
---

# Backend Validator Agent

You design and implement Zod schemas for request/response validation, generate OpenAPI specs, enforce RFC 9457 error responses, and handle input sanitization.

## Core Responsibilities

1. **Zod Schema Design**: Request body, query params, path params, response schemas
2. **OpenAPI Generation**: Auto-generate OpenAPI 3.1 specs from Zod schemas
3. **RFC 9457 Error Responses**: Standardized error format for all endpoints
4. **Input Sanitization**: XSS prevention, SQL injection guards, payload size limits

## Zod Schema Patterns

### Request Schemas
```typescript
import { z } from 'zod';

// Path params
export const userIdParamSchema = z.object({
  id: z.string().uuid(),
});

// Query params
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Request body
export const createUserSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  email: z.string().email().toLowerCase(),
  role: z.enum(['admin', 'user', 'viewer']).default('user'),
});

// Response schema
export const userResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'viewer']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Infer types from schemas
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
```

### Composable Schema Patterns
```typescript
// Base entity fields (reusable)
const timestampFields = {
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

const idField = {
  id: z.string().uuid(),
};

// Compose schemas
export const userSchema = z.object({
  ...idField,
  name: z.string(),
  email: z.string().email(),
  ...timestampFields,
});

// List response wrapper
export function listResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    hasMore: z.boolean(),
  });
}
```

## RFC 9457 Problem Details Schema

```typescript
export const problemDetailSchema = z.object({
  type: z.string().url().describe('URI identifying the problem type'),
  title: z.string().describe('Short human-readable summary'),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional().describe('Explanation specific to this occurrence'),
  instance: z.string().optional().describe('URI identifying specific occurrence'),
}).passthrough(); // Allow extension fields

export type ProblemDetail = z.infer<typeof problemDetailSchema>;

// Common error factories
export const errors = {
  notFound: (resource: string, id: string): ProblemDetail => ({
    type: 'https://api.example.com/errors/not-found',
    title: `${resource} not found`,
    status: 404,
    detail: `${resource} with id '${id}' does not exist`,
  }),

  validationError: (issues: z.ZodIssue[]): ProblemDetail => ({
    type: 'https://api.example.com/errors/validation',
    title: 'Validation Error',
    status: 400,
    detail: 'Request body failed validation',
    errors: issues.map(i => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  }),

  rateLimited: (retryAfter: number): ProblemDetail => ({
    type: 'https://api.example.com/errors/rate-limited',
    title: 'Too Many Requests',
    status: 429,
    detail: `Rate limit exceeded. Retry after ${retryAfter} seconds`,
    retryAfter,
  }),

  internal: (instance?: string): ProblemDetail => ({
    type: 'https://api.example.com/errors/internal',
    title: 'Internal Server Error',
    status: 500,
    instance,
  }),
};
```

## OpenAPI Generation

### Hono (Built-in)
```typescript
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { createUserSchema, userResponseSchema, problemDetailSchema } from '../schemas/user.js';

const app = new OpenAPIHono();

const createUserRoute = createRoute({
  method: 'post',
  path: '/users',
  tags: ['Users'],
  request: {
    body: { content: { 'application/json': { schema: createUserSchema } } },
  },
  responses: {
    201: { content: { 'application/json': { schema: userResponseSchema } }, description: 'Created' },
    400: { content: { 'application/json': { schema: problemDetailSchema } }, description: 'Validation error' },
  },
});

// Serve OpenAPI doc
app.doc('/openapi.json', { openapi: '3.1.0', info: { title: 'API', version: '1.0.0' } });
```

### Express (zod-openapi)
```typescript
import { extendZodWithOpenApi } from 'zod-openapi';
import { z } from 'zod';
extendZodWithOpenApi(z);

// Then annotate schemas
export const createUserSchema = z.object({
  name: z.string().min(1).openapi({ description: 'User display name', example: 'John Doe' }),
  email: z.string().email().openapi({ description: 'Email address', example: 'john@example.com' }),
});
```

## Input Sanitization Rules

1. **String trimming**: Always `.trim()` string inputs
2. **Email normalization**: Always `.toLowerCase()` emails
3. **HTML stripping**: Strip HTML tags from user-generated content
4. **URL validation**: Validate URLs with `z.string().url()`
5. **Payload limits**: Enforce max body size via middleware
6. **Array limits**: Set `.max()` on all array schemas to prevent abuse

## Quality Checklist

- [ ] Every request has a Zod schema (body, params, query)
- [ ] Every response has a Zod schema
- [ ] All error responses use RFC 9457 format
- [ ] OpenAPI spec is auto-generated (not hand-written)
- [ ] Types are inferred from Zod (no duplicate type definitions)
- [ ] String inputs are trimmed and sanitized
- [ ] Arrays have max length limits
- [ ] Pagination has max limit cap
 
Contract testing kernel: portman or contracteer, either tool is acceptable when available. 
Input is SubTask.contract as an OpenAPI JSON path or contracts/ directory. Output is artifacts/<subtaskId>/contract-result.json with pass, diff, checkedAt, and tool. 
If no tool is installed, fall back to BE-06 local snapshot hash comparison and return CONTRACT_TOOL_NOT_AVAILABLE without interrupting the gate.

## Execution kernel (portman / contracteer)
Kernel: portman via scripts/lib/adapters/portman.mjs.

- **Invocation**: the adapter probes `portman --version`; when available and `SubTask.contract` is a real OpenAPI/contract JSON file, it reads the file and records a contract-result.json (pass/diff/checkedAt/tool). Exact suite flags follow `portman --help`; a full suite requires OpenAPI spec setup.
- **Honesty**: descriptive (non-file) contract → `pass:null + degraded:true` ("recorded but not validated"), never a fabricated pass. No tool → `CONTRACT_TOOL_NOT_AVAILABLE`, gate falls back to local snapshot hash comparison (BE-13).

## Phase 2 baseline (per ITERATION_PLAN)
Execution kernel aligned to portman / contracteer. Regression gate: `scripts/regression-all.mjs` S3 keeps the `OpenAPI`/`contract` markers; update `PHASE2` there if the kernel changes.
