import { useDSCSignatureSync } from '@/hooks/use-dsc-signature-sync';

export function DSCBackgroundSync() {
  useDSCSignatureSync();
  return null;
}

export default DSCBackgroundSync;
