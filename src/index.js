import { SnowTrip } from '../lib/service.js';
export { SnowTrip };
export const name = 'dsh-snow-trip';
export function apply(ctx) { ctx.plugin(SnowTrip); }
