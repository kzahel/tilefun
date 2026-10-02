import type { ArtNote, BuildingReview } from "../art/ArtNotes.js";
import type { ReviewFeedback } from "../interiors/review/ReviewFeedback.js";

export interface WorkshopTool {
  id: string;
  name: string;
  description: string;
  url: string;
  mode: "source" | "review" | "adapter" | "link";
}
export interface ReviewBatch {
  id: string;
  name: string;
  description: string;
  toolId: string;
}
export interface WorkshopCandidate {
  id: string;
  batchId: string;
  name: string;
  prompt: string;
  url: string;
  kind: "art" | "interior" | "motion";
  /** Handoff derived from the candidate's actual world generation and location. */
  exploreUrl?: string;
  fingerprint: string;
  sourceFingerprint?: string;
  review?: BuildingReview;
  art?: Omit<ArtNote, "id" | "threadId" | "createdAt" | "note" | "reply" | "status">;
  interior?: Omit<ReviewFeedback, "id" | "createdAt" | "note" | "verdict">;
  sceneSignature?: string;
  excluded?: string;
}
export interface WorkshopManifest {
  version: 1;
  inputDigest: string;
  tools: WorkshopTool[];
  batches: ReviewBatch[];
  candidates: WorkshopCandidate[];
}
export type CandidateState = "unchecked" | "changed" | "approved" | "changes" | "excluded";
export interface CandidateSummary extends WorkshopCandidate {
  state: CandidateState;
  lastDecision?: string;
}
export interface WorkshopThread {
  id: string;
  kind: "art" | "interior";
  name: string;
  note: string;
  reply: string;
  status: string;
  createdAt: string;
  url: string;
  caseId?: string;
}
export interface WorkshopInbox {
  manifestCurrent: boolean;
  candidates: CandidateSummary[];
  requests: WorkshopThread[];
}
export interface WorkshopActivity extends WorkshopThread {
  eventId: string;
  verdict?: string;
}
export type WorkshopEvent =
  | {
      id: string;
      type: "review";
      candidateId: string;
      fingerprint: string;
      verdict: "approved" | "changes" | "clear";
      note: string;
      pins?: { x: number; y: number; size: 16 | 32 }[];
    }
  | {
      id: string;
      type: "source";
      sheetId: string;
      fingerprint: string;
      rect: [number, number, number, number];
      sliceKeys: string[];
      intent: ArtNote["intent"];
      note: string;
    }
  | { id: string; type: "reply"; threadId: string; reply: string; status: ArtNote["status"] };
export interface WorkshopSession {
  local?: boolean;
  authenticated: boolean;
  configured: boolean;
  csrfToken?: string;
  owner?: string;
}
