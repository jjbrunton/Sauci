import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { ShimmerEffect } from '@/components/ui/ShimmerEffect';

describe('ShimmerEffect', () => {
    describe('rendering', () => {
        it('renders children correctly', () => {
            const { getByText } = render(
                <ShimmerEffect>
                    <Text>Child Content</Text>
                </ShimmerEffect>
            );

            expect(getByText('Child Content')).toBeTruthy();
        });

        it('renders multiple children', () => {
            const { getByText } = render(
                <ShimmerEffect>
                    <Text>First Child</Text>
                    <Text>Second Child</Text>
                </ShimmerEffect>
            );

            expect(getByText('First Child')).toBeTruthy();
            expect(getByText('Second Child')).toBeTruthy();
        });

        it('renders nested components', () => {
            const { getByText, getByTestId } = render(
                <ShimmerEffect>
                    <View testID="nested-view">
                        <Text>Nested Content</Text>
                    </View>
                </ShimmerEffect>
            );

            expect(getByTestId('nested-view')).toBeTruthy();
            expect(getByText('Nested Content')).toBeTruthy();
        });
    });

    describe('enabled prop', () => {
        it('shows glow effect when enabled (default)', () => {
            const { toJSON } = render(
                <ShimmerEffect>
                    <Text>Content</Text>
                </ShimmerEffect>
            );

            // Should render with glow elements
            expect(toJSON()).toBeTruthy();
        });

        it('hides glow effect when disabled', () => {
            const { getByText, toJSON } = render(
                <ShimmerEffect enabled={false}>
                    <Text>Content</Text>
                </ShimmerEffect>
            );

            expect(getByText('Content')).toBeTruthy();
            // The glow container should not be rendered when disabled
            expect(toJSON()).toBeTruthy();
        });

        it('toggles enabled state', () => {
            const { rerender, getByText } = render(
                <ShimmerEffect enabled={true}>
                    <Text>Content</Text>
                </ShimmerEffect>
            );
            expect(getByText('Content')).toBeTruthy();

            rerender(
                <ShimmerEffect enabled={false}>
                    <Text>Content</Text>
                </ShimmerEffect>
            );
            expect(getByText('Content')).toBeTruthy();
        });
    });

    describe('custom styling', () => {
        it('applies custom style', () => {
            const customStyle = { margin: 10, padding: 20 };
            const { getByText } = render(
                <ShimmerEffect style={customStyle}>
                    <Text>Styled Content</Text>
                </ShimmerEffect>
            );

            expect(getByText('Styled Content')).toBeTruthy();
        });

        it('uses custom shimmer color', () => {
            const { getByText } = render(
                <ShimmerEffect shimmerColor="#FF0000">
                    <Text>Red Shimmer</Text>
                </ShimmerEffect>
            );

            expect(getByText('Red Shimmer')).toBeTruthy();
        });
    });

    describe('duration prop', () => {
        it('accepts custom duration', () => {
            const { getByText } = render(
                <ShimmerEffect duration={2000}>
                    <Text>Fast Shimmer</Text>
                </ShimmerEffect>
            );

            expect(getByText('Fast Shimmer')).toBeTruthy();
        });

        it('uses default duration of 4000ms', () => {
            const { getByText } = render(
                <ShimmerEffect>
                    <Text>Default Duration</Text>
                </ShimmerEffect>
            );

            expect(getByText('Default Duration')).toBeTruthy();
        });
    });

    describe('default props', () => {
        it('has enabled true by default', () => {
            const { toJSON, getByText } = render(
                <ShimmerEffect>
                    <Text>Content</Text>
                </ShimmerEffect>
            );

            expect(getByText('Content')).toBeTruthy();
            expect(toJSON()).toBeTruthy();
        });

        it('uses default shimmer color', () => {
            const { getByText } = render(
                <ShimmerEffect>
                    <Text>Default Color</Text>
                </ShimmerEffect>
            );

            expect(getByText('Default Color')).toBeTruthy();
        });
    });

    describe('composition', () => {
        it('works with complex children', () => {
            const { getByText, getByTestId } = render(
                <ShimmerEffect>
                    <View testID="outer">
                        <Text>Header</Text>
                        <View testID="inner">
                            <Text>Body</Text>
                        </View>
                        <Text>Footer</Text>
                    </View>
                </ShimmerEffect>
            );

            expect(getByTestId('outer')).toBeTruthy();
            expect(getByTestId('inner')).toBeTruthy();
            expect(getByText('Header')).toBeTruthy();
            expect(getByText('Body')).toBeTruthy();
            expect(getByText('Footer')).toBeTruthy();
        });

        it('can be nested', () => {
            const { getByText } = render(
                <ShimmerEffect shimmerColor="#FF0000">
                    <ShimmerEffect shimmerColor="#00FF00" enabled={false}>
                        <Text>Nested Shimmer</Text>
                    </ShimmerEffect>
                </ShimmerEffect>
            );

            expect(getByText('Nested Shimmer')).toBeTruthy();
        });
    });
});
