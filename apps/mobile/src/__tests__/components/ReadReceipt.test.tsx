import React from 'react';
import { ReadReceipt, getReceiptStatus } from '@/components/ui/ReadReceipt';
import { render } from '@/test/test-utils';

describe('ReadReceipt', () => {
    it('derives receipt status from timestamps', () => {
        expect(getReceiptStatus(null, null)).toBe('sent');
        expect(getReceiptStatus('2020-01-01T00:00:00.000Z', null)).toBe('delivered');
        expect(getReceiptStatus('2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z')).toBe('read');
        expect(getReceiptStatus(null, '2020-01-01T00:00:00.000Z')).toBe('read');
    });

    it('renders correct icon name for sent', () => {
        const { getByText } = render(<ReadReceipt status="sent" />);
        expect(getByText('checkmark')).toBeTruthy();
    });

    it('renders correct icon name for delivered', () => {
        const { getByText } = render(<ReadReceipt status="delivered" />);
        const icon = getByText('checkmark-done');
        expect(icon.props.color).toBeDefined();
    });

    it('renders correct icon name for read', () => {
        const { getByText } = render(<ReadReceipt status="read" readColor="gold" />);
        const icon = getByText('checkmark-done');
        expect(icon.props.color).toBe('gold');
    });
});
