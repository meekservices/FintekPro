import type { Server } from 'http';
import { logger } from './logger';
import { pool } from './db';

/**
 * Graceful Shutdown Handler
 * 
 * Handles SIGTERM, SIGINT signals for zero-downtime deployments
 * Ensures all connections are closed properly and ongoing requests complete
 * 
 * Features:
 * - Stops accepting new connections
 * - Waits for ongoing requests to complete (with timeout)
 * - Closes database connection pool
 * - Cleans up cron jobs and background services
 * - Logs shutdown progress
 */

export interface ShutdownHandler {
  name: string;
  cleanup: () => Promise<void> | void;
}

class GracefulShutdownManager {
  private server: Server | null = null;
  private shutdownHandlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private signalHandlersRegistered = false;
  private readonly SHUTDOWN_TIMEOUT = 30000; // 30 seconds

  /**
   * Register the HTTP server for graceful shutdown
   */
  registerServer(server: Server): void {
    this.server = server;
    
    // Only setup signal handlers once to prevent duplicates
    if (!this.signalHandlersRegistered) {
      this.setupSignalHandlers();
      this.signalHandlersRegistered = true;
    }
  }

  /**
   * Register a cleanup handler to be called during shutdown
   */
  registerHandler(handler: ShutdownHandler): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Setup signal handlers for graceful shutdown (only once)
   */
  private setupSignalHandlers(): void {
    const handleSignal = (signal: string) => {
      // In development, ignore SIGHUP to prevent premature pool closure
      if (process.env.NODE_ENV !== 'production' && signal === 'SIGHUP') {
        logger.info(`${signal} signal received in development mode - ignoring`);
        return;
      }

      logger.info(`${signal} signal received: initiating graceful shutdown`);
      this.shutdown(signal).catch((error) => {
        logger.error('Error during shutdown', error instanceof Error ? error : undefined);
        process.exit(1);
      });
    };

    process.once('SIGTERM', () => handleSignal('SIGTERM'));
    process.once('SIGINT', () => handleSignal('SIGINT'));
    process.once('SIGHUP', () => handleSignal('SIGHUP'));
  }

  /**
   * Perform graceful shutdown - returns Promise to let caller decide when to exit
   */
  private async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal', { signal });
      return;
    }

    this.isShuttingDown = true;
    logger.info('Initiating graceful shutdown', { signal });

    return new Promise((resolve, reject) => {
      const shutdownTimeout = setTimeout(() => {
        logger.error('Graceful shutdown timeout exceeded', {
          timeout: this.SHUTDOWN_TIMEOUT
        });
        reject(new Error('Shutdown timeout exceeded'));
      }, this.SHUTDOWN_TIMEOUT);

      (async () => {
        try {
          // 1. Stop accepting new connections
          if (this.server) {
            await this.closeServer();
          }

          // 2. Run custom cleanup handlers (cron jobs, websockets, etc.)
          await this.runCleanupHandlers();

          // 3. Close database connection pool
          await this.closeDatabasePool();

          // 4. Clear shutdown timeout
          clearTimeout(shutdownTimeout);

          logger.info('Graceful shutdown completed successfully');
          resolve();
          
          // Let caller decide when to exit - do not call process.exit here
        } catch (error) {
          logger.error('Error during graceful shutdown', error instanceof Error ? error : undefined);
          clearTimeout(shutdownTimeout);
          reject(error);
        }
      })();
    });
  }

  /**
   * Close HTTP server and wait for existing connections to finish
   */
  private async closeServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      logger.info('Closing HTTP server...');

      this.server.close((error) => {
        if (error) {
          logger.error('Error closing HTTP server', error);
          reject(error);
        } else {
          logger.info('HTTP server closed successfully');
          resolve();
        }
      });

      // Track active connections
      const connections = new Set<any>();
      this.server.on('connection', (conn) => {
        connections.add(conn);
        conn.on('close', () => connections.delete(conn));
      });

      logger.info('Waiting for active connections to close', { 
        activeConnections: connections.size 
      });
    });
  }

  /**
   * Run all registered cleanup handlers
   */
  private async runCleanupHandlers(): Promise<void> {
    logger.info('Running cleanup handlers', { count: this.shutdownHandlers.length });

    for (const handler of this.shutdownHandlers) {
      try {
        logger.info(`Running cleanup handler: ${handler.name}`);
        await handler.cleanup();
        logger.info(`Cleanup handler completed: ${handler.name}`);
      } catch (error) {
        logger.error(`Cleanup handler failed: ${handler.name}`, error instanceof Error ? error : undefined);
      }
    }
  }

  /**
   * Close database connection pool
   */
  private async closeDatabasePool(): Promise<void> {
    // Skip closing database pool in development to prevent connection errors
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Skipping database pool closure in development mode');
      return;
    }

    try {
      logger.info('Closing database connection pool...');
      await pool.end();
      logger.info('Database connection pool closed successfully');
    } catch (error) {
      logger.error('Error closing database connection pool', error instanceof Error ? error : undefined);
      throw error;
    }
  }
}

// Singleton instance
export const gracefulShutdown = new GracefulShutdownManager();
