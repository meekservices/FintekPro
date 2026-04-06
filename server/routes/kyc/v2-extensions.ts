import { Express } from 'express';
import { registerKycV2ExtensionPart1Routes } from './v2-extensions-1';
import { registerKycV2ExtensionPart2Routes } from './v2-extensions-2';

export function registerKycV2ExtensionRoutes(app: Express): void {
  registerKycV2ExtensionPart1Routes(app);
  registerKycV2ExtensionPart2Routes(app);
}
