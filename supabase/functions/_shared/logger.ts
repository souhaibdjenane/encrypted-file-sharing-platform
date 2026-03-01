/**
 * Structured JSON logger for VaultShare Edge Functions.
 *
 * Emits newline-delimited JSON to stdout which is captured by
 * Supabase's log aggregator and queryable via the Dashboard.
 */

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
    level: LogLevel
    message: string
    ts: string
    [key: string]: unknown
}

function emit(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
    const entry: LogEntry = {
        level,
        message,
        ts: new Date().toISOString(),
        ...meta,
    }
    // Edge Function stdout is ingested by Supabase logging infrastructure
    console.log(JSON.stringify(entry))
}

export const logger = {
    info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
    error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
}
