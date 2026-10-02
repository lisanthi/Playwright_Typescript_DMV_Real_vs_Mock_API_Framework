import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JoinQueuePage } from '../../pages/join-queue-page';
import { mockCatalog, mockJoin } from '../../support/mock-api';

interface BranchServiceCase {
  caseId: string;
  branch: string;
  serviceType: string;
}

const serviceCodes: Record<string, string> = {
  'Driver License Renewal': 'DL_RENEWAL',
  'New Driver License': 'DL_NEW',
  'Vehicle Registration Renewal': 'VR_RENEWAL',
  'New Vehicle Registration': 'VR_NEW',
  'ID Card': 'ID_CARD',
  'Real ID': 'REAL_ID'
};
const combinations = JSON.parse(
  readFileSync(join(__dirname, '../../test-data/branch-service-combinations.json'), 'utf8')
) as BranchServiceCase[];

test.describe('Data-driven branch/service combinations @mock_api', () => {
  for (const combination of combinations) {
    test(combination.caseId, { tag: ['@mock_api'] }, async ({ page }) => {
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
      await mockCatalog(page);
      const submittedRequests = await mockJoin(page);
      const joinQueuePage = new JoinQueuePage(page);

      // 1. Start fresh, load branch/service choices, and select the branch from this data row.
      await joinQueuePage.goto();
      await joinQueuePage.selectBranch(combination.branch);
      await expect(joinQueuePage.getServiceButton(combination.serviceType)).toBeVisible();

      // 2. Select the row's service and submit one mocked queue request.
      await joinQueuePage.selectService(combination.serviceType);
      await joinQueuePage.submitRequest();

      // Verify the ticket is shown and the request contains the exact fixture service code.
      await expect(joinQueuePage.ticketNumber('A0042')).toBeVisible();
      expect(submittedRequests).toHaveLength(1);
      expect(submittedRequests[0]).toEqual({ branchId: 1, serviceCode: serviceCodes[combination.serviceType] });
    });
  }
});
