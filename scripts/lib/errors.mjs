export class RetryableError extends Error { constructor(message) { super(message); this.name = 'RetryableError'; this.code = 'RETRYABLE'; } } 
export class TimeoutError extends Error { constructor(message) { super(message); this.name = 'TimeoutError'; this.code = 'TIMEOUT'; } } 
export class AdapterUnavailableError extends Error { constructor(message) { super(message); this.name = 'AdapterUnavailableError'; this.code = 'ADAPTER_UNAVAILABLE'; } } 
export const EXIT = { OK: 0, ARGS: 2, NOT_IMPL: 3, CONTRACT: 4, FAILED: 5 }; 
