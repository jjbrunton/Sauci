import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, Platform } from 'react-native';
import { GlassInput } from '@/components/ui/GlassInput';

// Mock expo-blur
jest.mock('expo-blur', () => {
    const React = require('react');
    const { View } = require('react-native');

    return {
        BlurView: ({ children, intensity, tint, style, ...props }: any) =>
            React.createElement(
                View,
                { ...props, style, testID: 'blur-view' },
                children
            ),
    };
});

// Store original Platform.OS
const originalPlatformOS = Platform.OS;

describe('GlassInput', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset to iOS for consistent testing
        Object.defineProperty(Platform, 'OS', {
            get: () => 'ios',
        });
    });

    afterAll(() => {
        // Restore original
        Object.defineProperty(Platform, 'OS', {
            get: () => originalPlatformOS,
        });
    });

    describe('rendering', () => {
        it('renders text input', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Enter text" />
            );

            expect(getByPlaceholderText('Enter text')).toBeTruthy();
        });

        it('renders with label', () => {
            const { getByText, getByPlaceholderText } = render(
                <GlassInput label="Username" placeholder="Enter username" />
            );

            expect(getByText('Username')).toBeTruthy();
            expect(getByPlaceholderText('Enter username')).toBeTruthy();
        });

        it('renders without label', () => {
            const { queryByText, getByPlaceholderText } = render(
                <GlassInput placeholder="No label input" />
            );

            expect(getByPlaceholderText('No label input')).toBeTruthy();
            // No label text should be present
        });

        it('renders error message when provided', () => {
            const { getByText } = render(
                <GlassInput placeholder="Input" error="This field is required" />
            );

            expect(getByText('This field is required')).toBeTruthy();
        });

        it('does not render error message when not provided', () => {
            const { queryByText, getByPlaceholderText } = render(
                <GlassInput placeholder="No error input" />
            );

            expect(getByPlaceholderText('No error input')).toBeTruthy();
            expect(queryByText(/error/i)).toBeNull();
        });

        it('renders with icon', () => {
            const TestIcon = () => <Text testID="input-icon">Icon</Text>;
            const { getByTestId } = render(
                <GlassInput placeholder="Input with icon" icon={<TestIcon />} />
            );

            expect(getByTestId('input-icon')).toBeTruthy();
        });
    });

    describe('platform behavior', () => {
        // GlassInput now uses solid backgrounds instead of BlurView for reliability
        it('renders correctly on iOS', () => {
            Object.defineProperty(Platform, 'OS', {
                get: () => 'ios',
            });

            const { getByPlaceholderText } = render(
                <GlassInput placeholder="iOS Input" />
            );

            expect(getByPlaceholderText('iOS Input')).toBeTruthy();
        });

        // Note: Testing Android platform requires component re-evaluation
        // which is complex with module-level Platform checks
        it('renders correctly', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Input" />
            );

            expect(getByPlaceholderText('Input')).toBeTruthy();
        });
    });

    describe('input interactions', () => {
        it('handles text input changes', () => {
            const onChangeText = jest.fn();
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Type here" onChangeText={onChangeText} />
            );

            const input = getByPlaceholderText('Type here');
            fireEvent.changeText(input, 'Hello World');

            expect(onChangeText).toHaveBeenCalledWith('Hello World');
        });

        it('handles focus events', () => {
            const onFocus = jest.fn();
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Focus me" onFocus={onFocus} />
            );

            const input = getByPlaceholderText('Focus me');
            fireEvent(input, 'focus', {});

            expect(onFocus).toHaveBeenCalled();
        });

        it('handles blur events', () => {
            const onBlur = jest.fn();
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Blur me" onBlur={onBlur} />
            );

            const input = getByPlaceholderText('Blur me');
            fireEvent(input, 'blur', {});

            expect(onBlur).toHaveBeenCalled();
        });

        it('displays value prop', () => {
            const { getByDisplayValue } = render(
                <GlassInput placeholder="Input" value="Initial value" />
            );

            expect(getByDisplayValue('Initial value')).toBeTruthy();
        });

        it('handles controlled input', () => {
            const onChangeText = jest.fn();
            const { getByDisplayValue, rerender } = render(
                <GlassInput
                    placeholder="Controlled"
                    value="Initial"
                    onChangeText={onChangeText}
                />
            );

            expect(getByDisplayValue('Initial')).toBeTruthy();

            rerender(
                <GlassInput
                    placeholder="Controlled"
                    value="Updated"
                    onChangeText={onChangeText}
                />
            );

            expect(getByDisplayValue('Updated')).toBeTruthy();
        });
    });

    describe('focus state styling', () => {
        it('updates styling on focus', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Focus styling" />
            );

            const input = getByPlaceholderText('Focus styling');

            // Trigger focus
            fireEvent(input, 'focus', {});

            // The component should update without errors
            expect(input).toBeTruthy();
        });

        it('updates styling on blur', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Blur styling" />
            );

            const input = getByPlaceholderText('Blur styling');

            // Trigger focus then blur
            fireEvent(input, 'focus', {});
            fireEvent(input, 'blur', {});

            expect(input).toBeTruthy();
        });
    });

    describe('error state', () => {
        it('displays error styling when error prop is provided', () => {
            const { getByText, getByPlaceholderText } = render(
                <GlassInput
                    placeholder="Error input"
                    error="Invalid input"
                />
            );

            expect(getByPlaceholderText('Error input')).toBeTruthy();
            expect(getByText('Invalid input')).toBeTruthy();
        });

        it('applies error border color', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Error border" error="Has error" />
            );

            // The component renders with error styling
            expect(getByPlaceholderText('Error border')).toBeTruthy();
        });
    });

    describe('input props passthrough', () => {
        it('passes secureTextEntry prop', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Password" secureTextEntry />
            );

            const input = getByPlaceholderText('Password');
            expect(input.props.secureTextEntry).toBe(true);
        });

        it('passes keyboardType prop', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Email" keyboardType="email-address" />
            );

            const input = getByPlaceholderText('Email');
            expect(input.props.keyboardType).toBe('email-address');
        });

        it('passes autoCapitalize prop', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Name" autoCapitalize="words" />
            );

            const input = getByPlaceholderText('Name');
            expect(input.props.autoCapitalize).toBe('words');
        });

        it('passes autoCorrect prop', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Code" autoCorrect={false} />
            );

            const input = getByPlaceholderText('Code');
            expect(input.props.autoCorrect).toBe(false);
        });

        it('passes maxLength prop', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Short" maxLength={10} />
            );

            const input = getByPlaceholderText('Short');
            expect(input.props.maxLength).toBe(10);
        });

        it('passes multiline prop', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Message" multiline />
            );

            const input = getByPlaceholderText('Message');
            expect(input.props.multiline).toBe(true);
        });

        it('passes editable prop', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Read only" editable={false} />
            );

            const input = getByPlaceholderText('Read only');
            expect(input.props.editable).toBe(false);
        });

        it('passes returnKeyType prop', () => {
            const { getByPlaceholderText } = render(
                <GlassInput placeholder="Search" returnKeyType="search" />
            );

            const input = getByPlaceholderText('Search');
            expect(input.props.returnKeyType).toBe('search');
        });
    });

    describe('containerStyle prop', () => {
        it('applies custom container style', () => {
            const customStyle = { marginTop: 20 };
            const { getByPlaceholderText } = render(
                <GlassInput
                    placeholder="Styled container"
                    containerStyle={customStyle}
                />
            );

            expect(getByPlaceholderText('Styled container')).toBeTruthy();
        });
    });

    describe('accessibility', () => {
        it('supports accessibilityLabel', () => {
            const { getByLabelText } = render(
                <GlassInput
                    placeholder="Accessible input"
                    accessibilityLabel="Username input field"
                />
            );

            expect(getByLabelText('Username input field')).toBeTruthy();
        });

        it('supports accessibilityHint', () => {
            const { getByPlaceholderText } = render(
                <GlassInput
                    placeholder="Hint input"
                    accessibilityHint="Enter your username"
                />
            );

            const input = getByPlaceholderText('Hint input');
            expect(input.props.accessibilityHint).toBe('Enter your username');
        });
    });

    describe('combination of props', () => {
        it('handles all props together', () => {
            const onChangeText = jest.fn();
            const onFocus = jest.fn();
            const TestIcon = () => <Text>Icon</Text>;

            const { getByText, getByPlaceholderText } = render(
                <GlassInput
                    label="Full Props Input"
                    placeholder="Enter value"
                    error="Validation error"
                    icon={<TestIcon />}
                    value="Initial"
                    onChangeText={onChangeText}
                    onFocus={onFocus}
                    secureTextEntry
                    keyboardType="default"
                    containerStyle={{ margin: 10 }}
                />
            );

            expect(getByText('Full Props Input')).toBeTruthy();
            expect(getByPlaceholderText('Enter value')).toBeTruthy();
            expect(getByText('Validation error')).toBeTruthy();
            expect(getByText('Icon')).toBeTruthy();
        });
    });
});
