export type InferenceMetadata = {
  promptPattern: string | null;
  taskType: string | null;
  deliverableType: string | null;
  missingContextType: 'audience' | 'operating' | 'execution' | 'io' | 'comparison' | 'source' | 'boundary' | null;
  roleHint: 'general' | 'developer' | 'marketer' | null;
  noveltyCandidate: boolean;
  lookupKeys: string[];
  confidence: number;
  notes: string | null;
};

const ALLOWED_MISSING_CONTEXT = new Set<NonNullable<InferenceMetadata['missingContextType']>>([
  'audience',
  'operating',
  'execution',
  'io',
  'comparison',
  'source',
  'boundary',
]);

const ALLOWED_ROLE_HINT = new Set<NonNullable<InferenceMetadata['roleHint']>>(['general', 'developer', 'marketer']);

function normalizeStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseInferenceMetadata(value: unknown): InferenceMetadata | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const promptPattern = normalizeStringOrNull(raw.promptPattern);
  const taskType = normalizeStringOrNull(raw.taskType);
  const deliverableType = normalizeStringOrNull(raw.deliverableType);
  const notes = normalizeStringOrNull(raw.notes);

  const missingContextType = raw.missingContextType;
  if (
    missingContextType !== null &&
    (typeof missingContextType !== 'string' || !ALLOWED_MISSING_CONTEXT.has(missingContextType as never))
  ) {
    return null;
  }
  const normalizedMissingContextType = missingContextType as InferenceMetadata['missingContextType'];

  const roleHint = raw.roleHint;
  if (roleHint !== null && (typeof roleHint !== 'string' || !ALLOWED_ROLE_HINT.has(roleHint as never))) {
    return null;
  }
  const normalizedRoleHint = roleHint as InferenceMetadata['roleHint'];

  if (typeof raw.noveltyCandidate !== 'boolean') {
    return null;
  }

  if (typeof raw.confidence !== 'number' || !Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) {
    return null;
  }

  if (!Array.isArray(raw.lookupKeys)) {
    return null;
  }

  const lookupKeys = [...new Set(raw.lookupKeys.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))].slice(0, 10);

  if (lookupKeys.length !== raw.lookupKeys.length) {
    return null;
  }

  return {
    promptPattern,
    taskType,
    deliverableType,
    missingContextType: normalizedMissingContextType,
    roleHint: normalizedRoleHint,
    noveltyCandidate: raw.noveltyCandidate,
    lookupKeys,
    confidence: raw.confidence,
    notes,
  };
}
