import { WEIGHT_WHEELS } from '@/ui/SetFields';

/**
 * What the weight wheel offers.
 *
 * One row per unit all the way to the top was 301 rows in kilograms, and the wheel opens on the
 * last value used - which is nothing the first time an exercise is logged. Reaching a working
 * weight from there was most of the scrolling anyone did in this app.
 *
 * The rule these tests pin: fine below the changeover, fives above it. Breaking it either way
 * is a real regression - going coarse too early costs a dumbbell user their 12s and 14s, and
 * going fine too late brings the scrolling back.
 */
describe('the weight wheels', () => {
  it('counts in ones up to 40 kg', () => {
    const fine = WEIGHT_WHEELS.kg.filter((w) => w <= 40);
    expect(fine).toEqual(Array.from({ length: 41 }, (_, i) => i));
  });

  it('counts in fives above 40 kg', () => {
    const coarse = WEIGHT_WHEELS.kg.filter((w) => w > 40);
    expect(coarse[0]).toBe(45);
    for (const w of coarse) expect(w % 5).toBe(0);
  });

  it('counts in ones up to 90 lb, which is about the same forty kilos', () => {
    const fine = WEIGHT_WHEELS.lb.filter((w) => w <= 90);
    expect(fine).toEqual(Array.from({ length: 91 }, (_, i) => i));
  });

  it('counts in fives above 90 lb, which every plate combination lands on', () => {
    const coarse = WEIGHT_WHEELS.lb.filter((w) => w > 90);
    expect(coarse[0]).toBe(95);
    for (const w of coarse) expect(w % 5).toBe(0);
  });

  it('still starts at zero, which is how a bodyweight movement is logged', () => {
    expect(WEIGHT_WHEELS.kg[0]).toBe(0);
    expect(WEIGHT_WHEELS.lb[0]).toBe(0);
  });

  it('still reaches the top of what anyone will lift', () => {
    expect(WEIGHT_WHEELS.kg.at(-1)).toBe(300);
    expect(WEIGHT_WHEELS.lb.at(-1)).toBe(660);
  });

  it('rises without repeating or going backwards', () => {
    for (const values of [WEIGHT_WHEELS.kg, WEIGHT_WHEELS.lb]) {
      for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('is short enough to be worth the change', () => {
    // The point of the exercise. 301 and 661 before.
    expect(WEIGHT_WHEELS.kg).toHaveLength(93);
    expect(WEIGHT_WHEELS.lb).toHaveLength(205);
  });
});
