import type { PendingQuestion } from '@deepseek-ai/dsh-client-ui-user-questions/client';
import type {
  AskUserQuestionAnswer,
  AskUserQuestionItem,
} from '@deepseek-ai/dsh-user-questions';
import type { z } from 'zod';
import type {
  PackageRecord,
  savePreviewSchema,
} from '../../shared/packages.ts';
import type { PlanQuestionData } from '../../shared/plan-question.ts';
import type { conditions, PlanRecord } from '../../shared/plans.ts';
export type { PendingQuestion };
export type SavePreview = z.infer<typeof savePreviewSchema>;
export interface SaveResult {
  status: string;
  title?: string;
  error?: string;
  resultId?: string;
  planId?: string;
  plan?: Partial<PlanRecord>;
}
export interface PlanOutcome {
  action: string;
  stage?: PlanQuestionData['stage'];
  status?: string;
  selected?: string[];
  custom?: string | null;
  error?: string;
  card?: PlanQuestionData;
  selection?: { card: PlanQuestionData; selected: number[] };
  items?: SaveResult[];
  conditions?: z.infer<typeof conditions>;
}
export interface PlanMetadata {
  version?: number;
  status?: string;
  reused?: boolean;
  conditions?: z.infer<typeof conditions>;
  confirmedByCard?: boolean;
  custom?: string | null;
  planningId?: string;
  resultId?: string;
  passed?: number;
  comparisonComplete?: boolean;
  results?: unknown[];
  packages?: { id: string; name: string }[];
  plan?: Partial<PlanRecord>;
  items?: SaveResult[];
  interaction?: PlanOutcome;
}
export interface ToolBlock {
  kind?: string;
  isError?: boolean;
  parentCallId?: string;
  meta?: unknown;
  content?: readonly { type: string; text?: string }[];
}
export interface SaveItem {
  callId?: string;
  kind?: string;
  done?: boolean;
  stopped?: boolean;
  meta?: unknown;
  error?: string | null;
  snapshot?: Omit<SavePreview, 'callId'>;
  content?: ToolBlock['content'];
}
export interface QuestionRecord {
  seq?: number;
  questions: AskUserQuestionItem[];
  answers?: AskUserQuestionAnswer['answers'];
}
export interface SaveTurnState {
  turn: number;
  items: SaveItem[];
  drafts: Record<string, Omit<SavePreview, 'callId'>>;
  records: Record<string, PackageRecord>;
  calls: Record<string, boolean>;
}
