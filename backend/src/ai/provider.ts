import type { AnalysisMode } from "@nooksure/shared";

/**
 * Server-side AI provider adapter. Concrete providers (and the fixture
 * provider used when no API key is configured) implement this interface so
 * routes never talk to a vendor SDK directly. Implementations come later.
 */
export interface AiProvider {
  readonly mode: AnalysisMode;
  readonly name: string;
}
