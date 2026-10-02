import { chmod, mkdir } from "node:fs/promises";
import { request } from "@playwright/test";
export const WORKSHOP_TEST_PASSWORD = "tilefun-workshop-browser-test-only";
export const WORKSHOP_TEST_STATE = "test-results/workshop-session.json";
export default async function setup() {
  await mkdir("test-results", { recursive: true });
  const api = await request.newContext({ baseURL: "http://localhost:4174" });
  try {
    const response = await api.post("/tilefun/api/auth/login", {
      data: { username: "owner", password: WORKSHOP_TEST_PASSWORD },
    });
    if (!response.ok()) throw new Error(`Test Workshop login failed: ${response.status()}`);
    await api.storageState({ path: WORKSHOP_TEST_STATE });
    await chmod(WORKSHOP_TEST_STATE, 0o600);
  } finally {
    await api.dispose();
  }
}
