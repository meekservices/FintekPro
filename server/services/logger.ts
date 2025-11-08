import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const isDevelopment = process.env.NODE_ENV === 'development';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0 && meta.stack) {
      metaStr = `\n${meta.stack}`;
    } else if (Object.keys(meta).length > 0) {
      metaStr = ` | ${JSON.stringify(meta)}`;
    }
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
    level: isDevelopment ? 'debug' : 'info',
  }),
];

if (!isDevelopment) {
  const logDir = path.join(process.cwd(), 'logs');
  
  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
      level: 'info',
    })
  );

  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat,
      level: 'error',
    })
  );
}

export const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: logFormat,
  transports,
  exitOnError: false,
});

export interface LogContext {
  requestId?: string;
  userId?: string;
  action?: string;
  [key: string]: any;
}

export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  private formatMessage(message: string, meta?: object): [string, object] {
    const combinedMeta = { ...this.context, ...meta };
    return [message, combinedMeta];
  }

  info(message: string, meta?: object): void {
    const [msg, combinedMeta] = this.formatMessage(message, meta);
    logger.info(msg, combinedMeta);
  }

  warn(message: string, meta?: object): void {
    const [msg, combinedMeta] = this.formatMessage(message, meta);
    logger.warn(msg, combinedMeta);
  }

  error(message: string, error?: Error | object, meta?: object): void {
    const errorMeta = error instanceof Error 
      ? { error: error.message, stack: error.stack }
      : error;
    const [msg, combinedMeta] = this.formatMessage(message, { ...errorMeta, ...meta });
    logger.error(msg, combinedMeta);
  }

  debug(message: string, meta?: object): void {
    const [msg, combinedMeta] = this.formatMessage(message, meta);
    logger.debug(msg, combinedMeta);
  }

  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context });
  }
}

export const createLogger = (context?: LogContext): Logger => {
  return new Logger(context);
};

export default logger;
