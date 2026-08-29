import { describe, expect, it, vi } from 'vitest';

import { AccountOperationsService } from '../src/domains/account-operations/service.js';
import type { AuthAdminClient, PartnerNotifier, RevenueCatClient } from '../src/domains/account-operations/clients.js';
import type { AccountOperationsRepository } from '../src/domains/account-operations/repository.js';

function setup(partnerPushToken: string | null = 'ExponentPushToken[partner]') {
  const repository = {
    deleteRelationship: vi.fn(async () => ({ partnerPushToken })),
    resetProgress: vi.fn(async () => ({ partnerPushToken })),
    deleteAccount: vi.fn(async (_userId: string, deleteAuthUser: () => Promise<void>) => {
      await deleteAuthUser();
      return { partnerPushToken };
    }),
    setPremium: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  } satisfies AccountOperationsRepository;
  const authAdmin = { deleteUser: vi.fn(async () => undefined) } satisfies AuthAdminClient;
  const revenueCat = { isEntitled: vi.fn(async () => true) } satisfies RevenueCatClient;
  const notifier = {
    relationshipDeleted: vi.fn(async () => undefined),
    progressReset: vi.fn(async () => undefined),
    partnerAccountDeleted: vi.fn(async () => undefined),
  } satisfies PartnerNotifier;
  return {
    repository,
    authAdmin,
    revenueCat,
    notifier,
    service: new AccountOperationsService(repository, authAdmin, revenueCat, notifier),
  };
}

describe('AccountOperationsService', () => {
  it('deletes relationship data and notifies the partner', async () => {
    const { service, repository, notifier } = setup();
    await expect(service.deleteRelationship('user-1')).resolves.toEqual({
      success: true,
      message: 'Relationship data deleted successfully',
    });
    expect(repository.deleteRelationship).toHaveBeenCalledWith('user-1');
    expect(notifier.relationshipDeleted).toHaveBeenCalledWith('ExponentPushToken[partner]');
  });

  it('resets progress and skips notification without a partner token', async () => {
    const { service, notifier } = setup(null);
    await expect(service.resetProgress('user-1')).resolves.toEqual({
      success: true,
      message: 'Progress reset successfully',
    });
    expect(notifier.progressReset).not.toHaveBeenCalled();
  });

  it('deletes hosted auth inside the repository operation before notifying', async () => {
    const { service, repository, authAdmin, notifier } = setup();
    await expect(service.deleteAccount('user-1')).resolves.toEqual({
      success: true,
      message: 'Account deleted successfully',
    });
    expect(repository.deleteAccount).toHaveBeenCalledOnce();
    expect(authAdmin.deleteUser).toHaveBeenCalledWith('user-1');
    expect(notifier.partnerAccountDeleted).toHaveBeenCalledWith('ExponentPushToken[partner]');
  });

  it('persists the entitlement returned by RevenueCat', async () => {
    const { service, repository, revenueCat } = setup();
    revenueCat.isEntitled.mockResolvedValueOnce(false);
    await expect(service.syncSubscription('user-1')).resolves.toEqual({
      success: true,
      is_premium: false,
    });
    expect(repository.setPremium).toHaveBeenCalledWith('user-1', false);
  });

  it('keeps a committed destructive operation successful when notification fails', async () => {
    const { service, notifier } = setup();
    notifier.relationshipDeleted.mockRejectedValueOnce(new Error('push unavailable'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.deleteRelationship('user-1')).resolves.toMatchObject({ success: true });
    expect(error).toHaveBeenCalledWith('Partner notification failed', expect.any(Error));
    error.mockRestore();
  });
});
