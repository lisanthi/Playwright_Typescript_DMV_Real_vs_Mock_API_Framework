import { Page } from '@playwright/test';

export class TicketStatusPage {
  readonly ticketNumberInput;
  readonly checkStatusButton;
  readonly autoRefreshCheckbox;

  constructor(private readonly page: Page) {
    this.ticketNumberInput = page.getByPlaceholder('e.g., A0042');
    this.checkStatusButton = page.getByRole('button', { name: 'Check Status' });
    this.autoRefreshCheckbox = page.getByRole('checkbox', { name: 'Auto-refresh every 10s' });
  }

  async goto(): Promise<void> {
    await this.page.goto(`${process.env.APP_BASE_URL ?? 'http://localhost:3000'}/status`);
  }

  async lookup(ticketNumber: string): Promise<void> {
    await this.ticketNumberInput.fill(ticketNumber);
    await this.checkStatusButton.click();
  }

  ticketDetails(ticketNumber: string) {
    return this.page.getByText(ticketNumber, { exact: true });
  }

  get notFoundMessage() {
    return this.page.getByText(/Ticket not found|API Error 404/i);
  }
}
