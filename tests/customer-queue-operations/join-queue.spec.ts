import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/home-page';
import { JoinQueuePage } from '../../pages/join-queue-page';

test.describe('Customer Queue Operations @mock_api', () => {
  test('Join a queue with a selected branch and service', async ({ page }) => {
    let submittedServiceCode = '';
    await page.route('**/branches', async (route) => route.fulfill({
      json: [{ id: 1, name: 'San Francisco DMV', code: 'SF01', address: '1377 Fell St', city: 'San Francisco', state: 'CA', zip: '94117' }]
    }));
    await page.route('**/branches/1/services', async (route) => route.fulfill({
      json: [{ id: 1, branch_id: 1, code: 'DL_RENEWAL', name: 'Driver License Renewal', avg_service_time_minutes: 12 }]
    }));
    await page.route('**/branches/1/join', async (route) => {
      const body = route.request().postDataJSON() as { service_code: string };
      submittedServiceCode = body.service_code;
      await route.fulfill({
        status: 200,
        json: { id: 101, ticket_number: 'A0042', branch_id: 1, service_id: 1, status: 'waiting', created_at: '2026-10-02T12:00:00Z', position: 3 }
      });
    });

    const homePage = new HomePage(page);
    const joinQueuePage = new JoinQueuePage(page);

    // 1. Starting from a fresh state with no existing ticket, open the home page and select "Get in Line".
    await homePage.goto();
    await homePage.openJoinQueue();
    await expect(joinQueuePage.branchSelector).toBeVisible();

    // 2. Select "San Francisco DMV - San Francisco" and verify branch details and available service choices.
    await joinQueuePage.selectBranch('San Francisco DMV - San Francisco');
    await expect(joinQueuePage.branchAddress).toContainText('1377 Fell St');
    await expect(joinQueuePage.getServiceButton('Driver License Renewal')).toBeVisible();
    await expect(joinQueuePage.getMyTicketButton).toBeDisabled();

    // 3. Select "Driver License Renewal" and submit the queue request once.
    await joinQueuePage.selectService('Driver License Renewal');
    await expect(joinQueuePage.getMyTicketButton).toBeEnabled();
    await page.route('**/tickets/A0042', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 101,
          ticket_number: 'A0042',
          branch_id: 1,
          service_id: 4,
          status: 'waiting',
          created_at: '2026-10-02T12:00:00Z',
          position: 3
        })
      })
    );
    await joinQueuePage.submitRequest();

    // Verify the returned ticket and service selection.
    await expect(joinQueuePage.ticketNumber('A0042')).toBeVisible();
    expect(submittedServiceCode).toBe('DL_RENEWAL');
  });
});
