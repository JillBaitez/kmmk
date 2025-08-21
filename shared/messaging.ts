// shared/messaging.ts
// Centralized message type constants used between UI and background SW

export const EXECUTE_WORKFLOW = 'EXECUTE_WORKFLOW';
export const WORKFLOW_COMPLETE = 'WORKFLOW_COMPLETE';
export const WORKFLOW_FAILED = 'WORKFLOW_FAILED';
export const WORKFLOW_STEP_UPDATE = 'WORKFLOW_STEP_UPDATE';
export const SYNTHESIS_COMPLETE = 'SYNTHESIS_COMPLETE';
export const SYNTHESIS_PARTIAL = 'SYNTHESIS_PARTIAL';

export const GET_FULL_HISTORY = 'GET_FULL_HISTORY';
export const GET_HISTORY_SESSION = 'GET_HISTORY_SESSION';
export const GET_LAST_ESCALATION = 'GET_LAST_ESCALATION';
