type LoggerOptions = { level?: string; browser?: { write?: (value: unknown) => void } };

export const levels = {
  values: { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60, silent: Infinity },
};

function createLogger(options: LoggerOptions = {}) {
  const write = options.browser?.write;
  const log = (level: string) => (...args: unknown[]) => write?.({ level: levels.values[level as keyof typeof levels.values], args });
  const logger = {
    level: options.level ?? "info",
    levels,
    trace: log("trace"),
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    fatal: log("fatal"),
    child: () => logger,
    bindings: () => ({}),
  };
  return logger;
}

createLogger.levels = levels;

export { createLogger as pino };
export default createLogger;
