/**
 * Centralized Service Registry for FintekPro
 * 
 * This module provides a centralized pattern for managing singleton services
 * with lazy initialization and duplicate detection. It ensures each service
 * is instantiated only once per process and logs initialization status consistently.
 * 
 * Usage:
 * 1. Register new services using registerService()
 * 2. Get singleton instances using getService()
 * 3. Services are lazy-initialized on first access
 * 
 * Design Pattern: Service Locator with Lazy Initialization
 */

type ServiceFactory<T> = () => T;

interface ServiceEntry<T = any> {
  factory: ServiceFactory<T>;
  instance: T | null;
  initialized: boolean;
  name: string;
  category: string;
}

class ServiceRegistry {
  private static _instance: ServiceRegistry | null = null;
  private services: Map<string, ServiceEntry> = new Map();
  private initializationLogs: Set<string> = new Set();
  
  private constructor() {}
  
  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry._instance) {
      ServiceRegistry._instance = new ServiceRegistry();
    }
    return ServiceRegistry._instance;
  }
  
  /**
   * Register a service with lazy initialization
   * @param name Unique service identifier
   * @param factory Function that creates the service instance
   * @param category Optional category for grouping (e.g., 'data', 'ai', 'integration')
   */
  register<T>(name: string, factory: ServiceFactory<T>, category: string = 'general'): void {
    if (this.services.has(name)) {
      console.warn(`⚠️ [ServiceRegistry] Service '${name}' is already registered - skipping duplicate`);
      return;
    }
    
    this.services.set(name, {
      factory,
      instance: null,
      initialized: false,
      name,
      category
    });
  }
  
  /**
   * Get or create a singleton service instance
   * @param name Service identifier
   * @returns The service instance
   */
  get<T>(name: string): T {
    const entry = this.services.get(name);
    
    if (!entry) {
      throw new Error(`[ServiceRegistry] Service '${name}' is not registered`);
    }
    
    if (!entry.initialized) {
      entry.instance = entry.factory();
      entry.initialized = true;
    }
    
    return entry.instance as T;
  }
  
  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }
  
  /**
   * Check if a service has been initialized
   */
  isInitialized(name: string): boolean {
    const entry = this.services.get(name);
    return entry?.initialized ?? false;
  }
  
  /**
   * Log a service initialization message only once
   * Prevents duplicate initialization messages in console
   */
  logOnce(key: string, message: string, level: 'info' | 'warn' | 'error' = 'info'): boolean {
    if (this.initializationLogs.has(key)) {
      return false;
    }
    
    this.initializationLogs.add(key);
    
    switch (level) {
      case 'warn':
        console.warn(message);
        break;
      case 'error':
        console.error(message);
        break;
      default:
        console.log(message);
    }
    
    return true;
  }
  
  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }
  
  /**
   * Get services by category
   */
  getServicesByCategory(category: string): string[] {
    return Array.from(this.services.entries())
      .filter(([_, entry]) => entry.category === category)
      .map(([name]) => name);
  }
  
  /**
   * Get initialization status for all services
   */
  getStatus(): Record<string, { initialized: boolean; category: string }> {
    const status: Record<string, { initialized: boolean; category: string }> = {};
    
    for (const [name, entry] of this.services) {
      status[name] = {
        initialized: entry.initialized,
        category: entry.category
      };
    }
    
    return status;
  }
  
  /**
   * Reset the registry (useful for testing)
   */
  reset(): void {
    this.services.clear();
    this.initializationLogs.clear();
  }
}

export const serviceRegistry = ServiceRegistry.getInstance();

/**
 * Helper function to register a service
 */
export function registerService<T>(
  name: string, 
  factory: ServiceFactory<T>, 
  category: string = 'general'
): void {
  serviceRegistry.register(name, factory, category);
}

/**
 * Helper function to get a service
 */
export function getService<T>(name: string): T {
  return serviceRegistry.get<T>(name);
}

/**
 * Helper function to log initialization messages only once
 * Use this when a service may be instantiated multiple times but should only log once
 */
export function logServiceInitOnce(
  serviceKey: string, 
  message: string, 
  level: 'info' | 'warn' | 'error' = 'info'
): boolean {
  return serviceRegistry.logOnce(serviceKey, message, level);
}

/**
 * Decorator-like pattern for creating singleton services
 * Returns a getter function that ensures single instance
 */
export function createSingletonGetter<T>(
  name: string,
  factory: () => T,
  category: string = 'general'
): () => T {
  let instance: T | null = null;
  let initialized = false;
  
  return () => {
    if (!initialized) {
      instance = factory();
      initialized = true;
    }
    return instance!;
  };
}

/**
 * Service Categories for FintekPro
 */
export const ServiceCategories = {
  DATA_PROVIDER: 'data-provider',
  AI_SERVICE: 'ai-service',
  INTEGRATION: 'integration',
  CACHE: 'cache',
  SCHEDULER: 'scheduler',
  AUTH: 'auth',
  NOTIFICATION: 'notification',
  COMPLIANCE: 'compliance',
  GENERAL: 'general'
} as const;

export type ServiceCategory = typeof ServiceCategories[keyof typeof ServiceCategories];
