import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HomePage } from '../../pages/home-page';
import { JoinQueuePage } from '../../pages/join-queue-page';
import { TicketStatusPage } from '../../pages/ticket-status-page';

interface BranchServiceCase {
  caseId: string;
  branch: string;
  serviceType: string;
}

const combinations = JSON.parse(
  readFileSync(join(__dirname, '../../test-data/branch-service-combinations.json'), 'utf8')
) as BranchServiceCase[];
const realApiEnabled = process.env.RUN_REAL_API === '1';
const ticketCreationEnabled = process.env.ALLOW_REAL_TICKET_CREATION === '1';
const seededTicketNumber = process.env.SEEDED_TICKET_NUMBER;

test.describe('Real API customer scenarios @real_api', () => {
  test('1. Join a queue with a selected branch and service', async ({ page }) => {
    test.skip(!realApiEnabled || !ticketCreationEnabled, 'Requires the dedicated test API and explicit permission to create a ticket.');
    const homePage = new HomePage(page);
    const joinQueuePage = new JoinQueuePage(page);

    // 1. Open the real customer application and select a supported branch/service.
    await homePage.goto();
    await homePage.openJoinQueue();
    await joinQueuePage.selectBranch('San Francisco DMV - San Francisco');
    await joinQueuePage.selectService('Driver License Renewal');

    // 2. Submit against the real API and verify a ticket is presented.
    await joinQueuePage.submitRequest();
   await expect(page.getByText(/[A-Z]-?\d+/)).toBeVisible();
  });

  test('2. Prevent ticket requests when required selections are missing', async ({ page }) => {
    test.skip(!realApiEnabled, 'Set RUN_REAL_API=1 to target the dedicated test API.');
    let joinRequestCount = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && /\/branches\/\d+\/join$/.test(request.url())) joinRequestCount += 1;
    });
    const homePage = new HomePage(page);
    const joinQueuePage = new JoinQueuePage(page);

    // 1. Open the real form and select a branch without selecting a service.
    await homePage.goto();
    await homePage.openJoinQueue();
    await joinQueuePage.selectBranch('San Francisco DMV - San Francisco');

    // 2. Verify submission stays disabled and no create request is sent.
    await expect(joinQueuePage.getMyTicketButton).toBeDisabled();
    expect(joinRequestCount).toBe(0);
  });

  test('3. Look up an existing ticket and review its queue status', async ({ page }) => {
    test.skip(!realApiEnabled || !seededTicketNumber, 'Set RUN_REAL_API=1 and SEEDED_TICKET_NUMBER to use a prepared ticket.');
    const homePage = new HomePage(page);
    const statusPage = new TicketStatusPage(page);

    // 1. Use the independently seeded ticket in the dedicated test backend.
    await homePage.goto();
    await homePage.openTicketStatus();

    // 2. Submit the status lookup and verify the result belongs to that ticket.
    await statusPage.lookup(seededTicketNumber!);
    await expect(statusPage.ticketDetails(seededTicketNumber!)).toBeVisible();
  });

  test('4. Handle a ticket number that does not exist', async ({ page }) => {
    test.skip(!realApiEnabled, 'Set RUN_REAL_API=1 to target the dedicated test API.');
    const unknownTicketNumber = `UNKNOWN-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const homePage = new HomePage(page);
    const statusPage = new TicketStatusPage(page);

    // 1. Open status lookup and enter a ticket number unique to this test run.
    await homePage.goto();
    await homePage.openTicketStatus();
    await statusPage.ticketNumberInput.fill(unknownTicketNumber);

    // 2. Verify the real API's not-found response and that the form remains usable.
    await statusPage.checkStatusButton.click();
    await expect(statusPage.notFoundMessage).toBeVisible();
    await expect(statusPage.ticketNumberInput).toBeEditable();
  });

  test('5. Control automatic status refresh and continue manual lookup', async ({ page }) => {
    test.skip(!realApiEnabled || !seededTicketNumber, 'Set RUN_REAL_API=1 and SEEDED_TICKET_NUMBER to use a prepared ticket.');
    await page.clock.install();
    let statusRequestCount = 0;
    page.on('request', (request) => {
      if (request.method() === 'GET' && /\/tickets\/[^/]+$/.test(request.url())) statusRequestCount += 1;
    });
    const homePage = new HomePage(page);
    const statusPage = new TicketStatusPage(page);

    // 1. Look up the seeded ticket and verify auto-refresh starts enabled.
    await homePage.goto();
    await homePage.openTicketStatus();
    await statusPage.ticketNumberInput.fill(seededTicketNumber!);
    await expect(statusPage.autoRefreshCheckbox).toBeChecked();
    await statusPage.checkStatusButton.click();
    const firstRequestCount = statusRequestCount;

    // 2. Disable refresh and advance browser time by one interval.
    await statusPage.autoRefreshCheckbox.uncheck();
    await page.clock.fastForward(10_000);
    expect(statusRequestCount).toBe(firstRequestCount);

    // 3. Confirm manual lookup works and re-enable automatic refresh.
    await statusPage.checkStatusButton.click();
    expect(statusRequestCount).toBe(firstRequestCount + 1);
    await statusPage.autoRefreshCheckbox.check();
    await page.clock.fastForward(10_000);
    await expect.poll(() => statusRequestCount).toBeGreaterThan(firstRequestCount);
  });

  for (const combination of combinations) {
    test('6. Data Driven Branch/Service Combination: ' + combination.caseId, { tag: ['@real_api'] }, async ({ page }) => {
      test.skip(!realApiEnabled || !ticketCreationEnabled, 'Requires the dedicated test API and explicit permission to create a ticket.');
      const joinQueuePage = new JoinQueuePage(page);

      // 1. Load real branch/service options and verify this fixture pair is available.
      await joinQueuePage.goto();
      await joinQueuePage.selectBranch(combination.branch);
      await expect(joinQueuePage.getServiceButton(combination.serviceType)).toBeVisible();

      // 2. Submit one real ticket for this fixture row.
      await joinQueuePage.selectService(combination.serviceType);
      await joinQueuePage.submitRequest();

      // Verify this row created a ticket rather than being silently skipped.
      await expect(page.getByText(/[A-F]\d+/)).toBeVisible();
    });
  }
});
