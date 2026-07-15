import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateJobDto } from './create-job.dto';

describe('CreateJobDto validation', () => {
  async function validateDto(input: Record<string, unknown>) {
    const dto = plainToInstance(CreateJobDto, input);
    return validate(dto);
  }

  it('accepts a valid job submission payload', async () => {
    const errors = await validateDto({
      type: 'email.send',
      payload: { to: 'a@b.com' },
      priority: 10,
      maxAttempts: 3,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects missing type', async () => {
    const errors = await validateDto({
      payload: {},
    });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects empty type', async () => {
    const errors = await validateDto({
      type: '',
      payload: {},
    });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects non-object payload', async () => {
    const errors = await validateDto({
      type: 'demo.success',
      payload: 'not-an-object',
    });
    expect(errors.some((e) => e.property === 'payload')).toBe(true);
  });

  it('rejects priority below zero', async () => {
    const errors = await validateDto({
      type: 'demo.success',
      payload: {},
      priority: -1,
    });
    expect(errors.some((e) => e.property === 'priority')).toBe(true);
  });

  it('rejects maxAttempts below 1', async () => {
    const errors = await validateDto({
      type: 'demo.success',
      payload: {},
      maxAttempts: 0,
    });
    expect(errors.some((e) => e.property === 'maxAttempts')).toBe(true);
  });

  it('coerces numeric strings via class-transformer', async () => {
    const dto = plainToInstance(CreateJobDto, {
      type: 'demo.success',
      payload: {},
      priority: '5',
      delayMs: '100',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.priority).toBe(5);
    expect(dto.delayMs).toBe(100);
  });

  it('accepts runAt ISO datetime', async () => {
    const errors = await validateDto({
      type: 'demo.success',
      payload: {},
      runAt: '2026-07-20T10:30:00.000Z',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid runAt', async () => {
    const errors = await validateDto({
      type: 'demo.success',
      payload: {},
      runAt: 'not-a-date',
    });
    expect(errors.some((e) => e.property === 'runAt')).toBe(true);
  });
});
