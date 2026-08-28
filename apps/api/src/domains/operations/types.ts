export type OperationKind = 'expo' | 'discord' | 'classify';

export interface OperationItem {
  id: string;
  kind: OperationKind;
  dedupeKey: string;
  recipientId: string | null;
  pushToken: string | null;
  payload: Record<string, unknown>;
  attempts: number;
}

export interface MessageForClassification {
  id: string;
  version: number;
  content: string | null;
  encryptedContent: string | null;
  encryptionIv: string | null;
  keysMetadata: { admin_wrapped_key?: string } | null;
  mediaPath: string | null;
  mediaType: string | null;
  mediaStorageKey: string | null;
  mediaMimeType: string | null;
}

export interface ClassifierRuntimeConfig {
  enabled: boolean | null;
  apiKey: string | null;
  model: string | null;
  temperature: number | null;
  prompt: string | null;
  heuristicsEnabled: boolean | null;
  heuristicMinTextLength: number | null;
  heuristicWhitelistMaxLength: number | null;
  heuristicSkipIfNoAlnum: boolean | null;
  heuristicSkipMediaWithoutText: boolean | null;
  heuristicUseDefaultWhitelist: boolean | null;
  heuristicUseDefaultKeywords: boolean | null;
  heuristicWhitelist: string | null;
  heuristicKeywordTriggers: string | null;
}

export interface ProducerSummary {
  releasedPacks: number;
  streakMilestones: number;
  digests: number;
  packChanges: number;
  weeklySummaries: number;
  unpairedReminders: number;
  catchupReminders: number;
  streakReminders: number;
}
