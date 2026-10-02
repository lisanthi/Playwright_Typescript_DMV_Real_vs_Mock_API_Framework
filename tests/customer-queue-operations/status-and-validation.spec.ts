import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/home-page';
import { JoinQueuePage } from '../../pages/join-queue-page';
import { TicketStatusPage } from '../../pages/ticket-status-page';
import { mockCatalog, mockJoin, mockTicketStatus } from '../../support/mock-api';

test.describe('Customer Queue Operations @mock_api', () => {
  test('Prevent ticket requests when required selections are missing', async ({ page }) => {
    await mockCatalog(page);
    const requests = await mockJoin(page);
    const homePage = new HomePage(page);
    const joinQueuePage = new JoinQueuePage(page);

    // 1. Start fresh and open the Join the Queue page without selecting a branch.
    await homePage.goto();
    await homePage.openJoinQueue();
    await expect(joinQueuePage.getMyTicketButton).toBeDisabled();

    // 2. Select a branch but leave the service unselected.
    await joinQueuePage.selectBranch('San Francisco DMV - San Francisco');
    await expect(joinQueuePage.getServiceButton('Driver License Renewal')).toBeVisible();
    await expect(joinQueuePage.getMyTicketButton).toBeDisabled();

    // 3. Select a service, then change to a branch with no available services.
    await joinQueuePage.selectService('Driver License Renewal');
    await expect(joinQueuePage.getMyTicketButton).toBeEnabled();
    await joinQueuePage.selectBranch('Oakland Claremont DMV - Oakland');
    await expect(joinQueuePage.getMyTicketButton).toBeDisabled();
    expect(requests).toHaveLength(0);
  });

  test('Look up an existing ticket and review its queue status', async ({ page }) => {
    await mockTicketStatus(page);
    const homePage = new HomePage(page);
    const statusPage = new TicketStatusPage(page);

    // 1. Use the seeded mock ticket A0042, whose status data is fixed for this test.
    await homePage.goto();

    // 2. Open Check Status, enter the ticket number, and submit the lookup.
    await homePage.openTicketStatus();
    await statusPage.lookup('A0042');

    // Verify the displayed ticket result corresponds to the requested number.
    await expect(statusPage.ticketDetails('A0042')).toBeVisible();
  });

  test('Handle a ticket number that does not exist', async ({ page }) => {
    await mockTicketStatus(page, 404);
    const homePage = new HomePage(page);
    const statusPage = new TicketStatusPage(page);

    // 1. Start from a fresh state and enter a ticket number absent from the mock data.
    await homePage.goto();
    await homePage.openTicketStatus();
    await statusPage.ticketNumberInput.fill('MISSING-404');

    // 2. Submit the lookup and verify a not-found error with no false status result.
    await statusPage.checkStatusButton.click();
    await expect(statusPage.notFoundMessage).toBeVisible();
    await expect(statusPage.ticketNumberInput).toBeEditable();
  });

  test('Control automatic status refresh and continue manual lookup', async ({ page }) => {
    await page.clock.install();
    const requests = await mockTicketStatus(page);
    const homePage = new HomePage(page);
    const statusPage = new TicketStatusPage(page);

    // 1. Open Check Status with the mock ticket and confirm automatic refresh starts enabled.
    await homePage.goto();
    await homePage.openTicketStatus();
    await statusPage.ticketNumberInput.fill('A0042');
    await expect(statusPage.autoRefreshCheckbox).toBeChecked();

    // 2. Disable automatic refresh and verify polling stops after a refresh interval.
    await statusPage.checkStatusButton.click();
    const initialRequestCount = requests.length;
    await statusPage.autoRefreshCheckbox.uncheck();
    await page.clock.fastForward(20_000);
    await expect.poll(() => requests.length).toBe(initialRequestCount);

    // 3. Confirm manual lookup still works, then enable automatic refresh again.
    await statusPage.checkStatusButton.click();
    await expect.poll(() => requests.length).toBe(initialRequestCount + 1);
    await statusPage.autoRefreshCheckbox.check();
    await page.clock.fastForward(10_000);
    await expect.poll(() => requests.length).toBeGreaterThan(initialRequestCount + 1);
  });
});
