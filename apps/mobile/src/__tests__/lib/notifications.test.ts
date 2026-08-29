import { router } from 'expo-router';
import { handleNotificationResponse } from '@/lib/notifications';
import { useMatchStore } from '@/store/matchStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

jest.mock('@/lib/crashlytics', () => ({
  captureError: jest.fn(),
}));

const notificationResponse = (type: string) => ({
  notification: {
    request: {
      content: { data: { type } },
    },
  },
}) as never;

describe('handleNotificationResponse', () => {
  beforeEach(() => {
    useMatchStore.setState({ currentView: 'active' });
  });

  it('opens the answer queue for a catch-up reminder', () => {
    handleNotificationResponse(notificationResponse('catchup_reminder'));

    expect(useMatchStore.getState().currentView).toBe('pending');
    expect(router.push).toHaveBeenCalledWith('/(app)/swipe?mode=pending');
  });

  it('ignores unknown notification types', () => {
    handleNotificationResponse(notificationResponse('unknown'));

    expect(router.push).not.toHaveBeenCalled();
  });
});
