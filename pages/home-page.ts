import { Page } from '@playwright/test';

export class HomePage {
  private readonly getInLineLink;
  private readonly checkStatusLink;

  constructor(private readonly page: Page) {
    this.getInLineLink = page.getByRole('link', { name: /Get in Line/ });
    this.checkStatusLink = page.getByRole('link', { name: /Check Status/ });
  }

  async goto(): Promise<void> {
    await this.page.goto(process.env.APP_BASE_URL ?? 'http://localhost:3000');
  }

  async openJoinQueue(): Promise<void> {
    await this.getInLineLink.click();
  }

  async openTicketStatus(): Promise<void> {
    await this.checkStatusLink.click();
  }
}
