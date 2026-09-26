# 子任务执行指令包 plan-mui4ip2t-4

## 任务（父任务）
backend login module

## 本子任务
- asset: be-validator
- 资产根目录: D:\.ai-hub\skills\yy\vendor\be-validator
- 说明: backend login module
- contract: contracts\plan-mui4ip2t.json

## 上游产物引用
- plan-mui4ip2t-0 → artifacts\plan-mui4ip2t-0\result.txt
- plan-mui4ip2t-2 → artifacts\plan-mui4ip2t-2\result.txt
- plan-mui4ip2t-1 → artifacts\plan-mui4ip2t-1\result.txt
- plan-mui4ip2t-3 → artifacts\plan-mui4ip2t-3\result.txt

## 前置条件（硬约束）
- 接口/错误契约产物须先冻结（contracts/<planId>.json 或 --contract OpenAPI），下游才放行
- 实现类子任务须经 --exec 宿主真实执行，禁纯 prompt 兜底（requireExec）
- 每子任务产物须含资产消费锚点 + ≥1 内核词（D-1）；上游 done 且 assetConsumed=true 后下游才派单

## 方法论正文（资产全文）


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