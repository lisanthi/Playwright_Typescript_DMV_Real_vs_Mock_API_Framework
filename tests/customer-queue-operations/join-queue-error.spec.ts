import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/home-page';
import { JoinQueuePage } from '../../pages/join-queue-page';
import { mockCatalog, mockJoin } from '../../support/mock-api';

test.describe('Join queue error handling @mock_api', () => {
  test('Show an API error when ticket creation fails', async ({ page }) => {
    await mockCatalog(page);
    const submittedRequests = await mockJoin(page, 500);
    const homePage = new HomePage(page);
    const joinQueuePage = new JoinQueuePage(page);

    // 1. Start fresh and open the Join the Queue page.
    await homePage.goto();
    await homePage.openJoinQueue();

    // 2. Select a branch and service, then submit once while the API returns HTTP 500.
    await joinQueuePage.selectBranch('San Francisco DMV - San Francisco');
    await joinQueuePage.selectService('Driver License Renewal');
    await joinQueuePage.submitRequest();

    // Verify an error is displayed and the UI does not show a successful ticket.
    await expect(joinQueuePage.errorMessage).toBeVisible();
    expect(submittedRequests).toHaveLength(1);
    await expect(joinQueuePage.ticketNumber('A0042')).toHaveCount(0);
  });
});
