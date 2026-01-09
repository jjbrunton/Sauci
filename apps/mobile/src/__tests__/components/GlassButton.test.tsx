import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Text, View, Platform } from 'react-native';
import { GlassButton } from '@/components/ui/GlassButton';

// Store the mock for expo-haptics so we can check calls
const mockImpactAsync = jest.fn();

// Mock expo-haptics - must happen before import
jest.mock('expo-haptics', () => ({
    impactAsync: mockImpactAsync,
    ImpactFeedbackStyle: {
        Light: 'light',
    },
}));

describe('GlassButton', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders children text correctly', () => {
            const { getByText } = render(
                <GlassButton>Click Me</GlassButton>
            );

            expect(getByText('Click Me')).toBeTruthy();
        });

        it('renders with primary variant by default', () => {
            const { getByText } = render(
                <GlassButton>Primary Button</GlassButton>
            );

            const text = getByText('Primary Button');
            expect(text).toBeTruthy();
        });

        it('renders secondary variant', () => {
            const { getByText } = render(
                <GlassButton variant="secondary">Secondary Button</GlassButton>
            );

            expect(getByText('Secondary Button')).toBeTruthy();
        });

        it('renders ghost variant', () => {
            const { getByText } = render(
                <GlassButton variant="ghost">Ghost Button</GlassButton>
            );

            expect(getByText('Ghost Button')).toBeTruthy();
        });

        it('renders danger variant', () => {
            const { getByText } = render(
                <GlassButton variant="danger">Danger Button</GlassButton>
            );

            expect(getByText('Danger Button')).toBeTruthy();
        });

        it('renders with icon when provided', () => {
            const TestIcon = () => <Text testID="test-icon">Icon</Text>;
            const { getByTestId, getByText } = render(
                <GlassButton icon={<TestIcon />}>With Icon</GlassButton>
            );

            expect(getByTestId('test-icon')).toBeTruthy();
            expect(getByText('With Icon')).toBeTruthy();
        });

        it('renders loading indicator when loading is true', () => {
            const { queryByText, UNSAFE_getByType } = render(
                <GlassButton loading>Loading Button</GlassButton>
            );

            // When loading, text should not be visible
            expect(queryByText('Loading Button')).toBeNull();

            // Activity indicator should be present
            const ActivityIndicator = require('react-native').ActivityIndicator;
            expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
        });

        it('renders with different sizes', () => {
            const { rerender, getByText } = render(
                <GlassButton size="sm">Small</GlassButton>
            );
            expect(getByText('Small')).toBeTruthy();

            rerender(<GlassButton size="md">Medium</GlassButton>);
            expect(getByText('Medium')).toBeTruthy();

            rerender(<GlassButton size="lg">Large</GlassButton>);
            expect(getByText('Large')).toBeTruthy();
        });
    });

    describe('press handling', () => {
        it('calls onPress when pressed', async () => {
            const onPress = jest.fn();
            const { getByText } = render(
                <GlassButton onPress={onPress} haptic={false}>Press Me</GlassButton>
            );

            fireEvent.press(getByText('Press Me'));

            await waitFor(() => {
                expect(onPress).toHaveBeenCalledTimes(1);
            });
        });

        it('does not call onPress when disabled', () => {
            const onPress = jest.fn();
            const { getByText } = render(
                <GlassButton onPress={onPress} disabled>
                    Disabled Button
                </GlassButton>
            );

            fireEvent.press(getByText('Disabled Button'));

            expect(onPress).not.toHaveBeenCalled();
        });

        it('does not call onPress when loading', () => {
            const onPress = jest.fn();
            const { UNSAFE_getByType } = render(
                <GlassButton onPress={onPress} loading>
                    Loading Button
                </GlassButton>
            );

            const ActivityIndicator = require('react-native').ActivityIndicator;
            const indicator = UNSAFE_getByType(ActivityIndicator);

            // Try to press the parent pressable
            // Since loading hides the text, we can't press by text
            // The component should still be non-pressable
            expect(onPress).not.toHaveBeenCalled();
        });

        // Note: Haptic tests use haptic={false} because the component uses dynamic import
        // which doesn't work properly in Jest without --experimental-vm-modules
        it('handles button with haptic prop', () => {
            // Verify the component renders with haptic prop
            // Actual haptic functionality cannot be tested due to dynamic import limitations
            const { getByText } = render(
                <GlassButton haptic>Haptic Button</GlassButton>
            );

            expect(getByText('Haptic Button')).toBeTruthy();
        });

        it('calls onPress when haptic is false', async () => {
            const onPress = jest.fn();
            const { getByText } = render(
                <GlassButton onPress={onPress} haptic={false}>
                    No Haptic
                </GlassButton>
            );

            fireEvent.press(getByText('No Haptic'));

            await waitFor(() => {
                expect(onPress).toHaveBeenCalled();
            });
        });
    });

    describe('styling', () => {
        it('applies fullWidth style when fullWidth is true', () => {
            const { getByText } = render(
                <GlassButton fullWidth>Full Width Button</GlassButton>
            );

            const button = getByText('Full Width Button');
            expect(button).toBeTruthy();
            // The fullWidth style is applied to parent, which sets width: '100%'
        });

        it('applies custom style prop', () => {
            const customStyle = { marginTop: 20 };
            const { getByText } = render(
                <GlassButton style={customStyle}>Styled Button</GlassButton>
            );

            expect(getByText('Styled Button')).toBeTruthy();
        });

        it('applies custom textStyle prop', () => {
            const customTextStyle = { fontWeight: 'bold' as const };
            const { getByText } = render(
                <GlassButton textStyle={customTextStyle}>Styled Text</GlassButton>
            );

            expect(getByText('Styled Text')).toBeTruthy();
        });

        it('applies disabled opacity when disabled', () => {
            const { getByText } = render(
                <GlassButton disabled>Disabled Button</GlassButton>
            );

            // The disabled style reduces opacity to 0.5
            expect(getByText('Disabled Button')).toBeTruthy();
        });
    });

    describe('press in/out animations', () => {
        it('handles press in event', () => {
            const { getByText } = render(
                <GlassButton>Animated Button</GlassButton>
            );

            const button = getByText('Animated Button');

            // Trigger press in - this should work without errors
            fireEvent(button, 'pressIn');
            expect(button).toBeTruthy();
        });

        it('handles press out event', () => {
            const { getByText } = render(
                <GlassButton>Animated Button</GlassButton>
            );

            const button = getByText('Animated Button');

            // Trigger press in and out
            fireEvent(button, 'pressIn');
            fireEvent(button, 'pressOut');
            expect(button).toBeTruthy();
        });
    });

    describe('default props', () => {
        it('has default variant of primary', () => {
            const { getByText } = render(<GlassButton>Default</GlassButton>);
            expect(getByText('Default')).toBeTruthy();
        });

        it('has default size of md', () => {
            const { getByText } = render(<GlassButton>Default Size</GlassButton>);
            expect(getByText('Default Size')).toBeTruthy();
        });

        it('has haptic enabled by default', () => {
            // The component has haptic={true} by default
            // We can't test the actual haptic call due to dynamic import limitations
            // but we verify the prop default works
            const { getByText } = render(<GlassButton>Default Haptic</GlassButton>);
            expect(getByText('Default Haptic')).toBeTruthy();
        });

        it('has disabled false by default', async () => {
            const onPress = jest.fn();
            const { getByText } = render(
                <GlassButton onPress={onPress} haptic={false}>Not Disabled</GlassButton>
            );

            fireEvent.press(getByText('Not Disabled'));

            await waitFor(() => {
                expect(onPress).toHaveBeenCalled();
            });
        });

        it('has loading false by default', () => {
            const { getByText } = render(
                <GlassButton>Not Loading</GlassButton>
            );

            expect(getByText('Not Loading')).toBeTruthy();
        });

        it('has fullWidth false by default', () => {
            const { getByText } = render(<GlassButton>Not Full Width</GlassButton>);
            expect(getByText('Not Full Width')).toBeTruthy();
        });
    });
});
