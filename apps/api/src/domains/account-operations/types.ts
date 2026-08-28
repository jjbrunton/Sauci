export class AccountOperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 404 | 502 | 503,
  ) {
    super(message);
    this.name = 'AccountOperationError';
  }
}

export interface OperationResult {
  success: true;
  message: string;
}

export interface SubscriptionSyncResult {
  success: true;
  is_premium: boolean;
}

