import type { AuthAdminClient, PartnerNotifier, RevenueCatClient } from './clients.js';
import type { AccountOperationsRepository } from './repository.js';
import type { OperationResult, SubscriptionSyncResult } from './types.js';

export class AccountOperationsService {
  constructor(
    private readonly repository: AccountOperationsRepository,
    private readonly authAdmin: AuthAdminClient,
    private readonly revenueCat: RevenueCatClient,
    private readonly notifier: PartnerNotifier,
  ) {}

  async deleteRelationship(userId: string): Promise<OperationResult> {
    const result = await this.repository.deleteRelationship(userId);
    if (result.partnerPushToken) {
      await this.notify(() => this.notifier.relationshipDeleted(result.partnerPushToken!));
    }
    return { success: true, message: 'Relationship data deleted successfully' };
  }

  async resetProgress(userId: string): Promise<OperationResult> {
    const result = await this.repository.resetProgress(userId);
    if (result.partnerPushToken) {
      await this.notify(() => this.notifier.progressReset(result.partnerPushToken!));
    }
    return { success: true, message: 'Progress reset successfully' };
  }

  async deleteAccount(userId: string): Promise<OperationResult> {
    const result = await this.repository.deleteAccount(userId, () => this.authAdmin.deleteUser(userId));
    if (result.partnerPushToken) {
      await this.notify(() => this.notifier.partnerAccountDeleted(result.partnerPushToken!));
    }
    return { success: true, message: 'Account deleted successfully' };
  }

  async syncSubscription(userId: string): Promise<SubscriptionSyncResult> {
    const isPremium = await this.revenueCat.isEntitled(userId);
    await this.repository.setPremium(userId, isPremium);
    return { success: true, is_premium: isPremium };
  }

  private async notify(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      // Destructive data changes have already committed. Notification delivery is
      // deliberately best-effort, matching the previous Edge Function behavior.
      console.error('Partner notification failed', error);
    }
  }
}

