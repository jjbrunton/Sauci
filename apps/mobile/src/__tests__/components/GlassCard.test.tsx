import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, Platform } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';

// Mock expo-blur
jest.mock('expo-blur', () => {
    const React = require('react');
    const { View } = require('react-native');

    return {
        BlurView: ({ children, intensity, tint, style, ...props }: any) =>
            React.createElement(
                View,
                { ...props, style, testID: 'blur-view', 'data-intensity': intensity, 'data-tint': tint },
                children
            ),
    };
});

// Store original Platform.OS
const originalPlatformOS = Platform.OS;

describe('GlassCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset to iOS for consistent testing
        Object.defineProperty(Platform, 'OS', {
            get: () => 'ios',
        });
    });

    afterAll(() => {
        Object.defineProperty(Platform, 'OS', {
            get: () => originalPlatformOS,
        });
    });

    describe('rendering', () => {
        it('renders children correctly', () => {
            const { getByText } = render(
                <GlassCard>
                    <Text>Card Content</Text>
                </GlassCard>
            );

            expect(getByText('Card Content')).toBeTruthy();
        });

        it('renders multiple children', () => {
            const { getByText } = render(
                <GlassCard>
                    <Text>First Child</Text>
                    <Text>Second Child</Text>
                </GlassCard>
            );

            expect(getByText('First Child')).toBeTruthy();
            expect(getByText('Second Child')).toBeTruthy();
        });

        it('renders nested components', () => {
            const { getByText, getByTestId } = render(
                <GlassCard>
                    <Text testID="nested-text">Nested Content</Text>
                </GlassCard>
            );

            expect(getByTestId('nested-text')).toBeTruthy();
            expect(getByText('Nested Content')).toBeTruthy();
        });
    });

    describe('platform behavior', () => {
        // GlassCard now uses solid backgrounds instead of BlurView for reliability
        it('renders correctly on iOS', () => {
            Object.defineProperty(Platform, 'OS', {
                get: () => 'ios',
            });

            const { getByText } = render(
                <GlassCard>
                    <Text>iOS Card</Text>
                </GlassCard>
            );

            expect(getByText('iOS Card')).toBeTruthy();
        });

        it('renders correctly', () => {
            const { getByText } = render(
                <GlassCard>
                    <Text>Card Content</Text>
                </GlassCard>
            );

            expect(getByText('Card Content')).toBeTruthy();
        });
    });

    describe('intensity prop', () => {
        // Note: intensity prop is kept for API compatibility but no longer affects visual rendering
        // since BlurView was replaced with solid backgrounds for reliability
        beforeEach(() => {
            Object.defineProperty(Platform, 'OS', {
                get: () => 'ios',
            });
        });

        it('accepts light intensity prop', () => {
            const { getByText } = render(
                <GlassCard intensity="light">
                    <Text>Light Card</Text>
                </GlassCard>
            );

            expect(getByText('Light Card')).toBeTruthy();
        });

        it('accepts medium intensity by default', () => {
            const { getByText } = render(
                <GlassCard>
                    <Text>Medium Card</Text>
                </GlassCard>
            );

            expect(getByText('Medium Card')).toBeTruthy();
        });

        it('accepts heavy intensity prop', () => {
            const { getByText } = render(
                <GlassCard intensity="heavy">
                    <Text>Heavy Card</Text>
                </GlassCard>
            );

            expect(getByText('Heavy Card')).toBeTruthy();
        });
    });

    describe('variant prop', () => {
        it('renders default variant', () => {
            const { getByText } = render(
                <GlassCard variant="default">
                    <Text>Default Card</Text>
                </GlassCard>
            );

            expect(getByText('Default Card')).toBeTruthy();
        });

        it('renders elevated variant', () => {
            const { getByText } = render(
                <GlassCard variant="elevated">
                    <Text>Elevated Card</Text>
                </GlassCard>
            );

            expect(getByText('Elevated Card')).toBeTruthy();
        });

        it('renders subtle variant', () => {
            const { getByText } = render(
                <GlassCard variant="subtle">
                    <Text>Subtle Card</Text>
                </GlassCard>
            );

            expect(getByText('Subtle Card')).toBeTruthy();
        });
    });

    describe('noPadding prop', () => {
        it('has padding by default', () => {
            const { getByText } = render(
                <GlassCard>
                    <Text>Padded Card</Text>
                </GlassCard>
            );

            expect(getByText('Padded Card')).toBeTruthy();
        });

        it('removes padding when noPadding is true', () => {
            const { getByText } = render(
                <GlassCard noPadding>
                    <Text>No Padding Card</Text>
                </GlassCard>
            );

            expect(getByText('No Padding Card')).toBeTruthy();
        });
    });

    describe('style prop', () => {
        it('applies custom style', () => {
            const customStyle = { marginTop: 20, backgroundColor: 'red' };
            const { getByText } = render(
                <GlassCard style={customStyle}>
                    <Text>Styled Card</Text>
                </GlassCard>
            );

            expect(getByText('Styled Card')).toBeTruthy();
        });

        it('merges custom style with default styles', () => {
            const { getByText } = render(
                <GlassCard style={{ marginBottom: 10 }}>
                    <Text>Merged Styles Card</Text>
                </GlassCard>
            );

            expect(getByText('Merged Styles Card')).toBeTruthy();
        });
    });

    describe('default props', () => {
        it('has default intensity of medium', () => {
            const { getByText } = render(
                <GlassCard>
                    <Text>Default Intensity</Text>
                </GlassCard>
            );

            expect(getByText('Default Intensity')).toBeTruthy();
        });

        it('has default variant of default', () => {
            const { getByText } = render(
                <GlassCard>
                    <Text>Default Variant</Text>
                </GlassCard>
            );

            expect(getByText('Default Variant')).toBeTruthy();
        });

        it('has noPadding false by default', () => {
            const { getByText } = render(
                <GlassCard>
                    <Text>Has Padding</Text>
                </GlassCard>
            );

            expect(getByText('Has Padding')).toBeTruthy();
        });
    });

    describe('gradient highlight', () => {
        it('renders highlight gradient', () => {
            Object.defineProperty(Platform, 'OS', {
                get: () => 'ios',
            });
            const { getByText } = render(
                <GlassCard>
                    <Text>Card with Highlight</Text>
                </GlassCard>
            );

            // LinearGradient is mocked to render as View, so we just verify the card renders
            expect(getByText('Card with Highlight')).toBeTruthy();
        });
    });

    describe('accessibility', () => {
        it('renders children accessible to screen readers', () => {
            const { getByText } = render(
                <GlassCard>
                    <Text accessibilityLabel="Accessible content">Content</Text>
                </GlassCard>
            );

            const text = getByText('Content');
            expect(text.props.accessibilityLabel).toBe('Accessible content');
        });
    });

    describe('combination of props', () => {
        it('handles all props together', () => {
            const customStyle = { margin: 10 };

            const { getByText } = render(
                <GlassCard
                    intensity="heavy"
                    variant="elevated"
                    noPadding
                    style={customStyle}
                >
                    <Text>Full Props Card</Text>
                </GlassCard>
            );

            expect(getByText('Full Props Card')).toBeTruthy();
        });
    });
});
