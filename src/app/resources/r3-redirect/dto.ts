// ============================================================================
// REDIRECT DTOs
// File: src/app/resources/r3-redirect/dto.ts
// ============================================================================

export interface RedirectUrlData {
  id: string;
  shortCode: string;
  originalUrl: string;
  expiresAt: Date | string | null;
}
