/** A bounded queue used at every asynchronous pipeline boundary. */
export class BoundedQueue<T> {
  #items: T[] = [];
  #waiters: Array<(value: T | undefined) => void> = [];
  #drainers: Array<() => void> = [];
  #closed = false;
  constructor(readonly capacity: number) {}
  get length() {
    return this.#items.length;
  }
  get full() {
    return this.#items.length >= this.capacity;
  }
  push(value: T) {
    if (this.#closed || this.full) return false;
    const waiter = this.#waiters.shift();
    if (waiter) waiter(value);
    else this.#items.push(value);
    return true;
  }
  async shift(): Promise<T | undefined> {
    const item = this.#items.shift();
    if (item !== undefined) {
      this.#drainers.splice(0).forEach((resolve) => resolve());
      return item;
    }
    if (this.#closed) return undefined;
    return new Promise((resolve) => this.#waiters.push(resolve));
  }
  async waitForSpace() {
    if (!this.full || this.#closed) return;
    await new Promise<void>((resolve) => this.#drainers.push(resolve));
  }
  /** Wait until consumers have reduced the queue below a chosen watermark. */
  async waitForLengthBelow(limit: number) {
    while (!this.#closed && this.#items.length >= limit) {
      await new Promise<void>((resolve) => this.#drainers.push(resolve));
    }
  }
  close() {
    this.#closed = true;
    this.#waiters.splice(0).forEach((resolve) => resolve(undefined));
    this.#drainers.splice(0).forEach((resolve) => resolve());
  }
}
