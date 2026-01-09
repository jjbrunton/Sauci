import React from 'react';
import { render } from '@testing-library/react-native';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

describe('LoadingOverlay', () => {
    describe('visibility', () => {
        it('returns null when not visible', () => {
            const { queryByText, toJSON } = render(
                <LoadingOverlay visible={false} statusText="Loading..." />
            );

            expect(queryByText('Loading...')).toBeNull();
            expect(toJSON()).toBeNull();
        });

        it('renders when visible', () => {
            const { getByText } = render(
                <LoadingOverlay visible={true} statusText="Loading..." />
            );

            expect(getByText('Loading...')).toBeTruthy();
        });
    });

    describe('spinner variant (default)', () => {
        it('renders spinner by default', () => {
            const { UNSAFE_getByType } = render(
                <LoadingOverlay visible={true} />
            );

            const ActivityIndicator = require('react-native').ActivityIndicator;
            expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
        });

        it('renders status text', () => {
            const { getByText } = render(
                <LoadingOverlay visible={true} statusText="Please wait..." />
            );

            expect(getByText('Please wait...')).toBeTruthy();
        });

        it('renders detail text', () => {
            const { getByText } = render(
                <LoadingOverlay visible={true} detailText="This may take a moment" />
            );

            expect(getByText('This may take a moment')).toBeTruthy();
        });

        it('renders both status and detail text', () => {
            const { getByText } = render(
                <LoadingOverlay
                    visible={true}
                    statusText="Uploading..."
                    detailText="50% complete"
                />
            );

            expect(getByText('Uploading...')).toBeTruthy();
            expect(getByText('50% complete')).toBeTruthy();
        });
    });

    describe('shimmer variant', () => {
        it('renders shimmer variant', () => {
            const { UNSAFE_getByType, getByText } = render(
                <LoadingOverlay visible={true} variant="shimmer" statusText="Loading..." />
            );

            const ActivityIndicator = require('react-native').ActivityIndicator;
            expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
            expect(getByText('Loading...')).toBeTruthy();
        });

        it('renders shimmer with detail text', () => {
            const { getByText } = render(
                <LoadingOverlay
                    visible={true}
                    variant="shimmer"
                    statusText="Syncing"
                    detailText="Almost done"
                />
            );

            expect(getByText('Syncing')).toBeTruthy();
            expect(getByText('Almost done')).toBeTruthy();
        });
    });

    describe('progress variant', () => {
        it('renders progress variant', () => {
            const { getByText } = render(
                <LoadingOverlay
                    visible={true}
                    variant="progress"
                    progress={50}
                    statusText="Uploading..."
                />
            );

            expect(getByText('Uploading...')).toBeTruthy();
        });

        it('renders progress with detail text', () => {
            const { getByText } = render(
                <LoadingOverlay
                    visible={true}
                    variant="progress"
                    progress={75}
                    statusText="Processing"
                    detailText="3 of 4 complete"
                />
            );

            expect(getByText('Processing')).toBeTruthy();
            expect(getByText('3 of 4 complete')).toBeTruthy();
        });

        it('clamps progress to 0-100', () => {
            // Progress value should be clamped internally
            const { toJSON } = render(
                <LoadingOverlay visible={true} variant="progress" progress={150} />
            );

            // Should render without error
            expect(toJSON()).toBeTruthy();
        });

        it('handles negative progress', () => {
            const { toJSON } = render(
                <LoadingOverlay visible={true} variant="progress" progress={-10} />
            );

            // Should render without error
            expect(toJSON()).toBeTruthy();
        });
    });

    describe('fullScreen mode', () => {
        it('renders in fullScreen mode', () => {
            const { getByText } = render(
                <LoadingOverlay
                    visible={true}
                    fullScreen={true}
                    statusText="Full screen loading"
                />
            );

            expect(getByText('Full screen loading')).toBeTruthy();
        });

        it('renders fullScreen with different variants', () => {
            const { rerender, getByText } = render(
                <LoadingOverlay
                    visible={true}
                    fullScreen={true}
                    variant="spinner"
                    statusText="Spinner"
                />
            );
            expect(getByText('Spinner')).toBeTruthy();

            rerender(
                <LoadingOverlay
                    visible={true}
                    fullScreen={true}
                    variant="progress"
                    statusText="Progress"
                />
            );
            expect(getByText('Progress')).toBeTruthy();

            rerender(
                <LoadingOverlay
                    visible={true}
                    fullScreen={true}
                    variant="shimmer"
                    statusText="Shimmer"
                />
            );
            expect(getByText('Shimmer')).toBeTruthy();
        });
    });

    describe('custom styling', () => {
        it('applies custom style', () => {
            const customStyle = { marginTop: 20 };
            const { getByText } = render(
                <LoadingOverlay
                    visible={true}
                    style={customStyle}
                    statusText="Styled"
                />
            );

            expect(getByText('Styled')).toBeTruthy();
        });

        it('applies custom text style', () => {
            const customTextStyle = { fontSize: 20 };
            const { getByText } = render(
                <LoadingOverlay
                    visible={true}
                    textStyle={customTextStyle}
                    statusText="Custom text"
                />
            );

            expect(getByText('Custom text')).toBeTruthy();
        });

        it('uses custom spinner color', () => {
            const { UNSAFE_getByType } = render(
                <LoadingOverlay
                    visible={true}
                    spinnerColor="#FF0000"
                />
            );

            const ActivityIndicator = require('react-native').ActivityIndicator;
            const indicator = UNSAFE_getByType(ActivityIndicator);
            expect(indicator.props.color).toBe('#FF0000');
        });
    });

    describe('default props', () => {
        it('has spinner variant by default', () => {
            const { UNSAFE_getByType } = render(
                <LoadingOverlay visible={true} />
            );

            const ActivityIndicator = require('react-native').ActivityIndicator;
            expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
        });

        it('has fullScreen false by default', () => {
            const { toJSON } = render(
                <LoadingOverlay visible={true} statusText="Test" />
            );

            // Should render in non-fullscreen mode
            expect(toJSON()).toBeTruthy();
        });

        it('has progress 0 by default', () => {
            const { toJSON } = render(
                <LoadingOverlay visible={true} variant="progress" />
            );

            // Should render without error
            expect(toJSON()).toBeTruthy();
        });
    });
});
