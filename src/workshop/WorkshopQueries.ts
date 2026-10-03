import { useQuery } from "@tanstack/react-query";
import { sessionRequest, workshopJson } from "./AuthClient.js";
import type { WorkshopInbox, WorkshopManifest } from "./WorkshopTypes.js";
export const useSession = () =>
  useQuery({
    queryKey: ["session"],
    queryFn: sessionRequest,
    refetchInterval: 30_000,
    retry: false,
  });
export function useInbox() {
  const session = useSession();
  return useQuery({
    queryKey: ["workshop", "inbox"],
    queryFn: () => workshopJson<WorkshopInbox>("workshop/inbox"),
    enabled: session.data?.authenticated === true,
    refetchInterval: 30_000,
  });
}
export function useManifest() {
  const session = useSession();
  return useQuery({
    queryKey: ["workshop", "manifest"],
    queryFn: () =>
      workshopJson<WorkshopManifest & { current: boolean; reviewAllowed?: boolean }>(
        "workshop/manifest",
      ),
    enabled: session.data?.authenticated === true,
  });
}
