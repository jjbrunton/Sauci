import React from 'react';
import { DecorativeSeparator } from '@/components/ui/DecorativeSeparator';
import { render } from '@/test/test-utils';

describe('DecorativeSeparator', () => {
    it('renders rose variant', () => {
        const { toJSON } = render(<DecorativeSeparator variant="rose" />);
        expect(toJSON()).toMatchSnapshot();
    });

    it('renders gold variant', () => {
        const { toJSON } = render(<DecorativeSeparator variant="gold" />);
        expect(toJSON()).toMatchSnapshot();
    });

    it('renders muted variant', () => {
        const { toJSON } = render(<DecorativeSeparator variant="muted" />);
        expect(toJSON()).toMatchSnapshot();
    });
});
