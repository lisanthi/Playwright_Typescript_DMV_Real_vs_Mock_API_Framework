import { Page } from '@playwright/test';

export const branch = {
  id: 1,
  name: 'San Francisco DMV',
  code: 'SF01',
  address: '1377 Fell St',
  city: 'San Francisco',
  state: 'CA',
  zip: '94117'
};

export const oaklandBranch = {
  id: 2,
  name: 'Oakland Claremont DMV',
  code: 'OAK01',
  address: '5300 Claremont Ave',
  city: 'Oakland',
  state: 'CA',
  zip: '94618'
};

export const services = [
  { id: 1, branch_id: 1, code: 'DL_RENEWAL', name: 'Driver License Renewal', avg_service_time_minutes: 12 },
  { id: 2, branch_id: 1, code: 'DL_NEW', name: 'New Driver License', avg_service_time_minutes: 25 },
  { id: 3, branch_id: 1, code: 'VR_RENEWAL', name: 'Vehicle Registration Renewal', avg_service_time_minutes: 8 },
  { id: 4, branch_id: 1, code: 'VR_NEW', name: 'New Vehicle Registration', avg_service_time_minutes: 15 },
  { id: 5, branch_id: 1, code: 'ID_CARD', name: 'ID Card', avg_service_time_minutes: 10 },
  { id: 6, branch_id: 1, code: 'REAL_ID', name: 'Real ID', avg_service_time_minutes: 20 }
];

export const waitingTicket = {
  ticket_number: 'A0042',
  status: 'waiting',
  current_position: 3,
  estimated_wait_minutes: 12,
  created_at: '2026-10-02T12:00:00Z',
  called_at: null,
  branch_name: 'San Francisco DMV',
  service_name: 'Driver License Renewal'
};

export async function mockCatalog(page: Page): Promise<void> {
  await page.route('**/branches', async (route) => route.fulfill({ json: [branch, oaklandBranch] }));
  await page.route('**/branches/*/services', async (route) => {
    const branchId = Number(new URL(route.request().url()).pathname.match(/branches\/(\d+)\/services/)?.[1]);
    const branchServices = branchId === branch.id ? services : [];
    await route.fulfill({ json: branchServices });
  });
}

export async function mockJoin(page: Page, status = 200) {
  const requests: Array<{ branchId: number; serviceCode: string }> = [];
  await page.route('**/branches/*/join', async (route) => {
    const url = new URL(route.request().url());
    const branchId = Number(url.pathname.match(/branches\/(\d+)\/join/)?.[1]);
    const body = route.request().postDataJSON() as { service_code?: string } | null;
    requests.push({ branchId, serviceCode: body?.service_code ?? '' });

    if (status !== 200) {
      await route.fulfill({ status, json: { detail: 'Internal Server Error' } });
      return;
    }

    const service = services.find((option) => option.code === body?.service_code);
    await route.fulfill({
      status: 200,
      json: {
        id: 101,
        ticket_number: 'A0042',
        branch_id: branchId,
        service_id: service?.id ?? 1,
        status: 'waiting',
        created_at: '2026-10-02T12:00:00Z',
        position: 3
      }
    });
  });
  return requests;
}

export async function mockTicketStatus(page: Page, status = 200) {
  const requests: string[] = [];
  await page.route('**/tickets/*', async (route) => {
    requests.push(new URL(route.request().url()).pathname);
    if (status !== 200) {
      await route.fulfill({ status, json: { detail: 'Ticket not found' } });
      return;
    }
    await route.fulfill({ status: 200, json: waitingTicket });
  });
  return requests;
}
