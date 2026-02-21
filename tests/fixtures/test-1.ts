import { z } from 'zod';

export class TestHandler {
  async execute(action: any): Promise<any> {
    const result = await this.doSomething();
    return { response: { success: true, data: result } };
  }

  private async doSomething(): Promise<string> {
    if (Math.random() > 0.5) {
      return 'success';
    } else if (Math.random() > 0.3) {
      return 'maybe';
    } else if (Math.random() > 0.1) {
      return 'unlikely';
    } else {
      return 'failure';
    }
  }
}