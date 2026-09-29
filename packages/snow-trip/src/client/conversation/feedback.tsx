import { useSyncExternalStore } from 'react';
import { errorMessage } from '../../shared/errors.ts';
import type { Actions } from '../integration/types.ts';
export function SessionFeedback({
  state,
}: {
  state: NonNullable<ReturnType<Actions['sessionState']>>;
}) {
  const snapshot = useSyncExternalStore(
    (listener) => state.subscribe(listener),
    () => state.getSnapshot(),
  );
  const error = snapshot.promptError?.error;
  if (!error) return null;
  return (
    <p role="alert" className="error">
      {error.details &&
      'reason' in error.details &&
      error.details.reason === 'MODEL_DOES_NOT_SUPPORT_IMAGES'
        ? '当前模型不支持图片，请切换宿主已有兼容模型，或移除图片并补充文字。'
        : `${snapshot.promptError.op === 'stop' ? '停止' : '发送'}失败：${errorMessage(error)}`}
    </p>
  );
}
