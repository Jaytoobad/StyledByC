import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminBookings } from '../src/components/admin/AdminBookings.js';

describe('admin bookings responsive list', () => {
  it('renders the mobile list outside the table wrapper', () => {
    const markup = renderToStaticMarkup(
      createElement(AdminBookings, {
        summary: { total: 0, pending: 0, approved: 0, rejectedCancelled: 0 },
        summaryTone: () => '',
        search: '',
        setSearch: () => {},
        statusFilter: 'all',
        setStatusFilter: () => {},
        paymentFilter: 'all',
        setPaymentFilter: () => {},
        sort: 'newest',
        setSort: () => {},
        loading: false,
        error: '',
        toast: '',
        clearFilters: () => {},
        load: () => {},
        pageItems: [],
        actioning: null,
        confirm: null,
        setConfirm: () => {},
        act: () => {},
        dash: (value: unknown) => String(value ?? '-'),
        priceText: () => '-',
        statusColor: () => '',
        paymentColor: () => '',
        page: 1,
        pageSize: 10,
        totalPages: 1,
        start: 0,
        end: 0,
        filteredCount: 0,
        setPage: () => {},
        setPageSize: () => {},
        viewBooking: () => {},
      }),
    );

    const tableEnd = markup.indexOf('</table></div>');
    const mobileList = markup.indexOf('class="admin-mobile-list"');
    assert.notEqual(tableEnd, -1);
    assert.ok(mobileList > tableEnd);
  });
});
