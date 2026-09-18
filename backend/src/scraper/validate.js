import { z } from 'zod';

export const Observation = z.object({
  price: z.number().finite().positive().max(10_000_000),
  currency: z.string().length(3),
  in_stock: z.boolean(),
  stock_status: z.string().min(1),
  stock_qty: z.number().int().nonnegative().nullable(),
  name: z.string().min(1),
});

export function needsVerification(observation, lastPrice, confidence) {
  if (confidence !== 'high') return true;
  if (lastPrice == null || lastPrice <= 0) return false;
  return Math.abs(observation.price - lastPrice) / lastPrice > 0.7;
}

export function agrees(left, right) {
  return left.in_stock === right.in_stock
    && Math.abs(left.price - right.price) / Math.max(left.price, right.price) < 0.02;
}
