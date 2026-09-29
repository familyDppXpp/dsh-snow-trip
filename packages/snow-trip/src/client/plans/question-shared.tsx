import React from 'react';
import type { PlanQuestionData } from '../../shared/plan-question.ts';
import type { PlanOutcome } from '../conversation/card-types.ts';
export type Answer = { selected?: string[]; custom?: string };

export type BodyProps = {
  data: PlanQuestionData;
  busy?: boolean;
  error?: string;
  onAnswer?: (answer: Answer) => void;
  cancel?: React.ReactNode;
  readOnly?: boolean;
  outcome?: PlanOutcome;
  supplement?: React.ReactNode;
};

export const yuan = (n: number | null | undefined) =>
  n == null
    ? '待确认'
    : `¥${(n / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const readableBasis = (text: unknown) =>
  String(text ?? '').replace(/(\d+(?:\.\d+)?)\s*分(?!摊|钟)/g, (_, value) =>
    yuan(Number(value)),
  );

export const Badge = ({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: string;
}) => (
  <span className={`snow-plan-badge${tone ? ` snow-plan-badge-${tone}` : ''}`}>
    {children}
  </span>
);
