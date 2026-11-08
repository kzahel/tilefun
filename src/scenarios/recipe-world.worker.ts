import { type LocalAuthorityPort, serveLocalAuthority } from "../server/LocalServerRuntime.js";
import { RecipeWorldAuthority } from "./RecipeWorldAuthority.js";

serveLocalAuthority(
  globalThis as unknown as LocalAuthorityPort,
  (transport) => new RecipeWorldAuthority(transport),
);
