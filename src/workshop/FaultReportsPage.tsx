import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { StoredFaultReport } from "../diagnostics/FaultReport.js";
import { workshopJson } from "./AuthClient.js";

export default function FaultReportsPage() {
  const cache = useQueryClient(),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const list = useQuery({
    queryKey: ["fault-reports", offset],
    queryFn: () =>
      workshopJson<{ total: number; reports: StoredFaultReport[] }>(
        `fault-reports?offset=${offset}`,
      ),
  });
  const detail = useQuery({
    queryKey: ["fault-report", selected],
    enabled: !!selected,
    queryFn: () => workshopJson<StoredFaultReport>(`fault-reports/${selected}`),
  });
  async function remove(id: string) {
    try {
      await workshopJson(`fault-reports/${id}`, { method: "DELETE" });
      setSelected(null);
      await cache.invalidateQueries({ queryKey: ["fault-reports"] });
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <section>
      <h1>Game diagnostics</h1>
      <p>Automatic crash, server hang, request timeout and repeated chunk failure reports.</p>
      <button type="button" onClick={() => void list.refetch()}>
        Refresh reports
      </button>
      {error || list.error || detail.error ? (
        <p role="alert">{error || String(list.error ?? detail.error)}</p>
      ) : null}
      {list.isPending ? <p role="status">Loading reports…</p> : null}
      {list.data ? (
        <>
          <p>{list.data.total} reports</p>
          <ul>
            {list.data.reports.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setSelected(r.id)}>
                  {r.kind}: {r.message}
                </button>{" "}
                <small>
                  {r.capturedAt} · {r.build}
                </small>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 30))}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={offset + 30 >= list.data.total}
            onClick={() => setOffset(offset + 30)}
          >
            Next
          </button>
        </>
      ) : null}
      {detail.data ? (
        <article>
          <h2>{detail.data.message}</h2>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {JSON.stringify(detail.data, null, 2)}
          </pre>
          <button type="button" onClick={() => void remove(detail.data.id)}>
            Delete report
          </button>
        </article>
      ) : null}
    </section>
  );
}
