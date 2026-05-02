import { IBroker } from '../interfaces/IBroker';
import { ICreditProvider } from '../interfaces/ICreditProvider';

import { alpacaAdapter } from '../adapters/alpacaAdapter';
import { iiflAdapter } from '../adapters/iiflAdapter';
import { irisAdapter } from '../adapters/irisAdapter';
import { m2pAdapter } from '../adapters/bankAdapters/m2pAdapter';
import { setuAdapter } from '../adapters/bankAdapters/setuAdapter';
import { directBankAdapter } from '../adapters/bankAdapters/directBankAdapter';

export class ProviderRegistry {
  private brokers: Map<string, IBroker> = new Map();
  private creditProviders: Map<string, ICreditProvider> = new Map();

  constructor() {
    this.registerBrokers();
    this.registerCreditProviders();
  }

  private registerBrokers() {
    this.brokers.set(alpacaAdapter.brokerId, alpacaAdapter);
    this.brokers.set(iiflAdapter.brokerId, iiflAdapter);
    this.brokers.set(irisAdapter.brokerId, irisAdapter);
  }

  private registerCreditProviders() {
    this.creditProviders.set(m2pAdapter.providerId, m2pAdapter);
    this.creditProviders.set(setuAdapter.providerId, setuAdapter);
    this.creditProviders.set(directBankAdapter.providerId, directBankAdapter);
  }

  getBroker(brokerId: string): IBroker {
    const broker = this.brokers.get(brokerId);
    if (!broker) throw new Error(`Broker ${brokerId} not found in registry.`);
    return broker;
  }

  getCreditProvider(providerId: string): ICreditProvider {
    const provider = this.creditProviders.get(providerId);
    if (!provider) throw new Error(`Credit Provider ${providerId} not found in registry.`);
    return provider;
  }

  getAllCreditProviders(): ICreditProvider[] {
    return Array.from(this.creditProviders.values());
  }
}

export const providerRegistry = new ProviderRegistry();
