import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-agent-preset-registry/remote';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {
  SessionListState,
  SessionReference,
  SessionSummary,
} from '@deepseek-ai/dsh-api-session-controller/client';
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client';
import type {} from '@deepseek-ai/dsh-client-modules/client';
import type {} from '@deepseek-ai/dsh-client-ui-chat/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type {} from '@deepseek-ai/dsh-client-ui-tool/client';
import type {} from '@deepseek-ai/dsh-client-ui-user-questions/client';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type { TypertRemoteNamespaceMap } from '@deepseek-ai/dsh-typert-protocol';
import type { PackageRecord } from '../../shared/packages.ts';
import type { PlanRecord } from '../../shared/plans.ts';
export type {
  Context,
  PackageRecord,
  PlanRecord,
  SessionListState,
  SessionReference,
  SessionSummary,
};
export type SnowRemote = TypertRemoteNamespaceMap['snowTrip'];
export type NamedRecord = { id: string; name?: string; title?: string };
export type RecordKind = 'package' | 'plan';
export type RecordReference = { id: string; type: RecordKind };
export interface Observable<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
}
export interface Actions {
  selection: Observable<SessionReference | undefined>;
  referenceAt: (sessionId: string, index: number) => RecordReference | null;
  restoreReferences: (sessionId: string) => void | (() => void);
  addReference: (
    sessionId: string,
    record: NamedRecord,
    type: RecordKind,
  ) => boolean;
  deletePlan: (id: string) => Promise<string>;
  listPlans: () => Promise<PlanRecord[]>;
  listPackages: () => Promise<PackageRecord[]>;
  deletePackage: (
    record: PackageRecord,
    archive: boolean,
    plans?: PlanRecord[],
  ) => Promise<string>;
  lastSession: () => string | undefined;
  sessionState: (
    id: string,
  ) =>
    | NonNullable<ReturnType<Context['sessions']['binding']>>['session']
    | undefined;
  workspaceList: Context['workspaces']['list'];
  archive: (id: string) => Promise<void>;
  fork: (id: string) => Promise<string>;
  rename: (id: string, title: string) => Promise<void>;
  close: () => void;
  create: (
    draft?: string,
    record?: PackageRecord | PlanRecord,
  ) => Promise<string>;
  continueRecord: (
    record: PackageRecord | PlanRecord,
    prompt: string,
  ) => Promise<boolean>;
  open: (id: string) => void;
}
declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    snowTrip: true;
  }
}
