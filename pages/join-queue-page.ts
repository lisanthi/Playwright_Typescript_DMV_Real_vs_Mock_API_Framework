import { Page } from '@playwright/test';

export class JoinQueuePage {
  readonly branchSelector;
  readonly branchAddress;
  readonly getMyTicketButton;

  constructor(private readonly page: Page) {
    this.branchSelector = page.getByRole('combobox', { name: /Select DMV Branch/ });
    this.branchAddress = page.getByText(/1377 Fell St|CA 94117/);
    this.getMyTicketButton = page.getByRole('button', { name: 'Get My Ticket' });
  }

  async goto(): Promise<void> {
    await this.page.goto(`${process.env.APP_BASE_URL ?? 'http://localhost:3000'}/join`);
  }

  getServiceButton(serviceType: string) {
    return this.page.getByRole('button', { name: new RegExp(serviceType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
  }

  async selectBranch(branchName: string): Promise<void> {
    await this.branchSelector.selectOption({ label: branchName });
  }

  async selectService(serviceType: string): Promise<void> {
    await this.getServiceButton(serviceType).click();
  }

  async submitRequest(): Promise<void> {
    const [response] = await Promise.all([
    this.page.waitForResponse((res) => 
      res.request().method() === 'POST' && res.url().includes('/join')
    ),
    this.getMyTicketButton.click(),
  ]);

  /*if (response.status() >= 400) {
    throw new Error(
      `Ticket creation failed with status ${response.status()} (${response.statusText()}). Check backend server logs.`
    );
  }*/
  }

  ticketNumber(ticketNumber: string) {
    return this.page.getByText(ticketNumber, { exact: true });
  }

  get errorMessage() {
    return this.page.getByText(/API Error|unable|failed/i);
  }


}
