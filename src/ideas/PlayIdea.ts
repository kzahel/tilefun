/** Public submissions contain no audio, account identity or arbitrary attachments. */
export interface IdeaContext {
  worldId: string;
  generation: string;
  x: number;
  y: number;
  build: string;
  capturedAt: string;
}
export interface PlayIdeaSubmission {
  id: string;
  text: string;
  language: string;
  screenshot: string;
  context: IdeaContext;
}
export type IdeaStatus = "new" | "planned" | "done";
export interface PlayIdea extends PlayIdeaSubmission {
  createdAt: string;
  status: IdeaStatus;
}
export const IDEA_TEXT_LIMIT = 2000;
export const IDEA_IMAGE_LIMIT = 500_000;
export const IDEA_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
