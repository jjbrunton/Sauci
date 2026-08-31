jest.mock('expo-observe', () => ({
    Observe: {
        logEvent: jest.fn(),
    },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Observe } = require('expo-observe');
const logEventMock = Observe.logEvent as jest.Mock;

type ErrorHandler = (error: unknown, isFatal: boolean) => void;

function withFreshObserveModule<T>(run: (mod: typeof import('@/lib/observe')) => T): T {
    let result!: T;
    jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('@/lib/observe') as typeof import('@/lib/observe');
        result = run(mod);
    });
    return result;
}

function installFakeErrorUtils(previousHandler: jest.Mock) {
    let installedHandler: ErrorHandler = () => undefined;
    const globalWithErrorUtils = global as unknown as {
        ErrorUtils: { getGlobalHandler: () => unknown; setGlobalHandler: (fn: unknown) => void };
    };
    globalWithErrorUtils.ErrorUtils = {
        getGlobalHandler: () => previousHandler,
        setGlobalHandler: (fn) => {
            installedHandler = fn as ErrorHandler;
        },
    };
    return () => installedHandler;
}

describe('observe', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('logs app_started only once per module instance', () => {
        withFreshObserveModule(({ logAppStarted }) => {
            logAppStarted();
            logAppStarted();
        });

        expect(logEventMock).toHaveBeenCalledTimes(1);
        expect(logEventMock).toHaveBeenCalledWith('app_started');
    });

    it('does not throw when Observe.logEvent fails', () => {
        logEventMock.mockImplementationOnce(() => {
            throw new Error('native module unavailable');
        });

        withFreshObserveModule(({ logAppStarted }) => {
            expect(() => logAppStarted()).not.toThrow();
        });
    });

    it('wraps the previous ErrorUtils handler, logging xprem_js_crash and delegating', () => {
        const previousHandler = jest.fn();
        const getInstalledHandler = installFakeErrorUtils(previousHandler);

        withFreshObserveModule(({ installObserveGlobalErrorHandler }) => {
            installObserveGlobalErrorHandler();
        });

        const error = new Error('boom');
        getInstalledHandler()(error, true);

        expect(logEventMock).toHaveBeenCalledWith(
            'xprem_js_crash',
            expect.objectContaining({
                severity: 'fatal',
                body: 'boom',
                attributes: { isFatal: true },
            })
        );
        expect(previousHandler).toHaveBeenCalledWith(error, true);
    });

    it('still calls the previous handler when Observe.logEvent throws', () => {
        const previousHandler = jest.fn();
        const getInstalledHandler = installFakeErrorUtils(previousHandler);
        logEventMock.mockImplementationOnce(() => {
            throw new Error('native module unavailable');
        });

        withFreshObserveModule(({ installObserveGlobalErrorHandler }) => {
            installObserveGlobalErrorHandler();
        });

        getInstalledHandler()(new Error('boom'), false);

        expect(previousHandler).toHaveBeenCalledWith(expect.any(Error), false);
    });
});
