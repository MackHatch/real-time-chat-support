import { RateLimitService } from './ratelimit.service';

describe('RateLimitService (memory)', () => {
  let service: RateLimitService;

  beforeEach(() => {
    service = new RateLimitService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('allows requests under the max', async () => {
    const first = await service.consume('rl:test:a', 3, 60);
    const second = await service.consume('rl:test:a', 3, 60);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it('blocks once the max is exceeded', async () => {
    await service.consume('rl:test:b', 2, 60);
    await service.consume('rl:test:b', 2, 60);
    const blocked = await service.consume('rl:test:b', 2, 60);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('isolates counters by key', async () => {
    await service.consume('rl:test:c1', 1, 60);
    const other = await service.consume('rl:test:c2', 1, 60);

    expect(other.allowed).toBe(true);
  });
});
