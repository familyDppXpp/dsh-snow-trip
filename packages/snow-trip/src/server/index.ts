import type {Context} from '@deepseek-ai/cordis';
import { SnowTrip } from './service.ts';
export { SnowTrip };
export const name = 'dsh-snow-trip';
export function apply(ctx:Context) { ctx.plugin(SnowTrip); }
