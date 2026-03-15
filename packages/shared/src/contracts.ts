import { z } from 'zod';

export const API_VERSION = '0.4';
export const V2_API_VERSION = '2';

export const RoleSchema = z.enum(['general', 'developer', 'marketer']);
export type Role = z.infer<typeof RoleSchema>;

export const ModeSchema = z.enum(['balanced', 'tight_scope', 'high_contrast', 'low_token_cost']);
export type Mode = z.infer<typeof ModeSchema>;

export const SeveritySchema = z.enum(['low', 'medium', 'high']);
export type Severity = z.infer<typeof SeveritySchema>;

export const ProviderModeSchema = z.enum(['mock', 'real']);
export type ProviderMode = z.infer<typeof ProviderModeSchema>;

export const IssueCodeSchema = z.enum([
  'AUDIENCE_MISSING',
  'CONSTRAINTS_MISSING',
  'EXCLUSIONS_MISSING',
  'TASK_OVERLOADED',
  'GENERIC_PHRASES_DETECTED',
  'GENERIC_OUTPUT_RISK_HIGH',
  'LOW_EXPECTED_IMPROVEMENT',
  'PROMPT_ALREADY_OPTIMIZED',
  'PROMPT_CONVERGENCE_DETECTED',
  'REWRITE_POSSIBLE_REGRESSION',
]);
export type IssueCode = z.infer<typeof IssueCodeSchema>;

export const PromptContextSchema = z.record(z.string(), z.unknown());
export type PromptContext = z.infer<typeof PromptContextSchema>;

export const PreferencesSchema = z.object({
  includeScores: z.boolean().default(true),
  includeExplanation: z.boolean().default(true),
  includeAlternatives: z.boolean().default(false),
  preserveTone: z.boolean().default(false),
  maxLength: z.number().int().positive().max(6000).optional(),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const AnalyzeAndRewriteRequestSchema = z.object({
  prompt: z.string().trim().min(1, 'Prompt is required.').max(6000, 'Prompt too long.'),
  role: RoleSchema,
  mode: ModeSchema,
  context: PromptContextSchema.optional(),
  preferences: PreferencesSchema.partial().optional(),
});
export type AnalyzeAndRewriteRequest = z.infer<typeof AnalyzeAndRewriteRequestSchema>;

export const RewritePreferenceSchema = z.enum(['auto', 'force', 'suppress']);
export type RewritePreference = z.infer<typeof RewritePreferenceSchema>;

export const AnalyzeAndRewriteV2RequestSchema = AnalyzeAndRewriteRequestSchema.extend({
  rewritePreference: RewritePreferenceSchema.default('auto'),
});
export type AnalyzeAndRewriteV2Request = z.infer<typeof AnalyzeAndRewriteV2RequestSchema>;

export const IssueSchema = z.object({
  code: IssueCodeSchema,
  severity: SeveritySchema,
  message: z.string().min(1),
});
export type Issue = z.infer<typeof IssueSchema>;

const score = z.number().int().min(0).max(10);

export const ScoreSetSchema = z.object({
  scope: score,
  contrast: score,
  clarity: score,
  constraintQuality: score,
  genericOutputRisk: score,
  tokenWasteRisk: score,
});
export type ScoreSet = z.infer<typeof ScoreSetSchema>;

export const TargetScoreSchema = z.enum([
  'scope',
  'contrast',
  'clarity',
  'constraintQuality',
  'genericOutputRisk',
  'tokenWasteRisk',
]);
export type TargetScore = z.infer<typeof TargetScoreSchema>;

export const ImprovementSuggestionCategorySchema = z.enum([
  'audience',
  'proof',
  'exclusion',
  'boundary',
  'framing',
  'task_load',
  'clarity',
  'structure',
  'theme_specific',
]);
export type ImprovementSuggestionCategory = z.infer<typeof ImprovementSuggestionCategorySchema>;

export const ImprovementSuggestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  impact: SeveritySchema,
  targetScores: z.array(TargetScoreSchema).min(1).max(3),
  category: ImprovementSuggestionCategorySchema,
  exampleChange: z.string().min(1).optional(),
});
export type ImprovementSuggestion = z.infer<typeof ImprovementSuggestionSchema>;

export const ImprovementStatusSchema = z.enum([
  'material_improvement',
  'minor_improvement',
  'no_significant_change',
  'possible_regression',
  'already_strong',
]);
export type ImprovementStatus = z.infer<typeof ImprovementStatusSchema>;

export const ExpectedUsefulnessSchema = z.enum(['higher', 'slightly_higher', 'unchanged', 'lower']);
export type ExpectedUsefulness = z.infer<typeof ExpectedUsefulnessSchema>;

export const ScoreDeltasSchema = z.object({
  scope: z.number().int().min(-10).max(10),
  contrast: z.number().int().min(-10).max(10),
  clarity: z.number().int().min(-10).max(10),
  constraintQuality: z.number().int().min(-10).max(10),
  genericOutputRisk: z.number().int().min(-10).max(10),
  tokenWasteRisk: z.number().int().min(-10).max(10),
});
export type ScoreDeltas = z.infer<typeof ScoreDeltasSchema>;

export const ImprovementSchema = z.object({
  status: ImprovementStatusSchema,
  scoreDeltas: ScoreDeltasSchema,
  overallDelta: z.number(),
  expectedUsefulness: ExpectedUsefulnessSchema,
  notes: z.array(z.string()).max(12),
});
export type Improvement = z.infer<typeof ImprovementSchema>;

export const EvaluationSchema = z.object({
  originalScore: ScoreSetSchema,
  rewriteScore: ScoreSetSchema,
  improvement: ImprovementSchema,
  signals: z.array(z.string()).max(12),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const AnalysisSchema = z.object({
  scores: ScoreSetSchema,
  issues: z.array(IssueSchema),
  detectedIssueCodes: z.array(IssueCodeSchema),
  signals: z.array(z.string()).max(12),
  summary: z.string(),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export const RewriteSchema = z.object({
  role: RoleSchema,
  mode: ModeSchema,
  rewrittenPrompt: z.string().min(1),
  explanation: z.string().optional(),
  changes: z.array(z.string()).optional(),
});
export type Rewrite = z.infer<typeof RewriteSchema>;

export const MetaSchema = z.object({
  version: z.literal(API_VERSION),
  requestId: z.string().min(1),
  latencyMs: z.number().int().nonnegative(),
  providerMode: ProviderModeSchema,
  providerModel: z.string().min(1).optional(),
});
export type Meta = z.infer<typeof MetaSchema>;

export const MetaV2Schema = z.object({
  version: z.literal(V2_API_VERSION),
  requestId: z.string().min(1),
  latencyMs: z.number().int().nonnegative(),
  providerMode: ProviderModeSchema,
  providerModel: z.string().min(1).optional(),
});
export type MetaV2 = z.infer<typeof MetaV2Schema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  meta: MetaSchema,
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const EmailSchema = z.string().trim().email('Invalid email address.');
export type Email = z.infer<typeof EmailSchema>;

export const AuthUserSchema = z.object({
  id: z.string().startsWith('usr_'),
  email: EmailSchema,
  createdAt: z.string().datetime(),
  lastSignInAt: z.string().datetime(),
  passkeyCount: z.number().int().nonnegative(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const MagicLinkRequestSchema = z.object({
  email: EmailSchema,
});
export type MagicLinkRequest = z.infer<typeof MagicLinkRequestSchema>;

export const MagicLinkVerifyResponseSchema = z.object({
  ok: z.literal(true),
  authenticated: z.literal(true),
  user: AuthUserSchema,
});
export type MagicLinkVerifyResponse = z.infer<typeof MagicLinkVerifyResponseSchema>;

export const SessionResponseSchema = z.object({
  authenticated: z.boolean(),
  user: AuthUserSchema.optional(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const LogoutResponseSchema = z.object({
  ok: z.literal(true),
});
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;

export const PasskeyRegisterVerifyRequestSchema = z.object({
  credentialId: z.string().trim().min(1),
  label: z.string().trim().min(1).max(100).optional(),
});
export type PasskeyRegisterVerifyRequest = z.infer<typeof PasskeyRegisterVerifyRequestSchema>;

export const PasskeyAuthenticateOptionsRequestSchema = z.object({
  email: EmailSchema.optional(),
});
export type PasskeyAuthenticateOptionsRequest = z.infer<typeof PasskeyAuthenticateOptionsRequestSchema>;

export const PasskeyAuthenticateVerifyRequestSchema = z.object({
  email: EmailSchema.optional(),
  credentialId: z.string().trim().min(1),
});
export type PasskeyAuthenticateVerifyRequest = z.infer<typeof PasskeyAuthenticateVerifyRequestSchema>;

export const AnalyzeAndRewriteResponseSchema = z.object({
  id: z.string().startsWith('par_'),
  analysis: AnalysisSchema,
  rewrite: RewriteSchema,
  evaluation: EvaluationSchema,
  meta: MetaSchema,
});
export type AnalyzeAndRewriteResponse = z.infer<typeof AnalyzeAndRewriteResponseSchema>;

export const ScoreBandSchema = z.enum(['poor', 'weak', 'usable', 'strong', 'excellent']);
export type ScoreBand = z.infer<typeof ScoreBandSchema>;

export const RewriteRecommendationSchema = z.enum([
  'rewrite_recommended',
  'rewrite_optional',
  'no_rewrite_needed',
]);
export type RewriteRecommendation = z.infer<typeof RewriteRecommendationSchema>;

export const ExpectedImprovementLevelSchema = z.enum(['low', 'high']);
export type ExpectedImprovementLevel = z.infer<typeof ExpectedImprovementLevelSchema>;

export const GatingSchema = z.object({
  rewritePreference: RewritePreferenceSchema,
  expectedImprovement: ExpectedImprovementLevelSchema,
  majorBlockingIssues: z.boolean(),
});
export type Gating = z.infer<typeof GatingSchema>;

export const EvaluationV2Schema = z.object({
  status: ImprovementStatusSchema,
  overallDelta: z.number(),
  signals: z.array(z.string()).max(12),
  scoreComparison: z.object({
    original: z.object({
      scope: score,
      contrast: score,
      clarity: score,
    }),
    rewrite: z.object({
      scope: score,
      contrast: score,
      clarity: score,
    }),
  }),
});
export type EvaluationV2 = z.infer<typeof EvaluationV2Schema>;

export const AnalyzeAndRewriteV2ResponseSchema = z.object({
  id: z.string().startsWith('par_'),
  overallScore: z.number().int().min(0).max(100),
  scoreBand: ScoreBandSchema,
  rewriteRecommendation: RewriteRecommendationSchema,
  analysis: AnalysisSchema,
  improvementSuggestions: z.array(ImprovementSuggestionSchema),
  gating: GatingSchema,
  rewrite: RewriteSchema.nullable(),
  evaluation: EvaluationV2Schema.nullable(),
  meta: MetaV2Schema,
});
export type AnalyzeAndRewriteV2Response = z.infer<typeof AnalyzeAndRewriteV2ResponseSchema>;

export const ErrorCodeSchema = z.enum([
  'INVALID_REQUEST',
  'PROMPT_REQUIRED',
  'PROMPT_TOO_LONG',
  'INVALID_ROLE',
  'INVALID_MODE',
  'UNSUPPORTED_CONTENT_TYPE',
  'UNAUTHORIZED',
  'PROVIDER_NOT_CONFIGURED',
  'UPSTREAM_MODEL_ERROR',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
  meta: z.union([MetaSchema, MetaV2Schema]),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const defaultPreferences = {
  includeScores: true,
  includeExplanation: true,
  includeAlternatives: false,
  preserveTone: false,
} satisfies Preferences;

export function normalizePreferences(preferences?: Partial<Preferences>): Preferences {
  return {
    ...defaultPreferences,
    ...preferences,
  };
}
