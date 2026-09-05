"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";

type HealthStatus = "healthy" | "degraded" | "unavailable" | "disabled";

type SystemPayload = {
  health: {
    postgres: { status: HealthStatus; latencyMs: number | null };
    redis: { status: HealthStatus; latencyMs: number | null };
    worker: { status: HealthStatus; detail: string };
    checkedAt: string;
  };
  queues:
    | { available: false; reason: string }
    | {
        available: true;
        email: {
          name: string;
          counts: Record<string, number>;
          recentFailed: Array<{
            id?: string;
            name: string;
            attemptsMade: number;
            failedReason: string | null;
            timestamp?: number;
          }>;
        };
        maintenance: {
          name: string;
          counts: Record<string, number>;
          recentFailed: Array<{
            id?: string;
            name: string;
            attemptsMade: number;
            failedReason: string | null;
            timestamp?: number;
          }>;
        };
      };
};

function statusVariant(status: HealthStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "healthy") return "default";
  if (status === "degraded") return "secondary";
  if (status === "disabled") return "outline";
  return "destructive";
}

export function SystemHealthPanel() {
  const [data, setData] = useState<SystemPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/admin/system");
      if (!response.ok) {
        setError(response.status === 403 ? "Access denied." : "Unable to load system status.");
        setData(null);
        return;
      }
      setData((await response.json()) as SystemPayload);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runSlaScan = () => {
    startTransition(async () => {
      const response = await fetch("/api/admin/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sla-scan" }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Unable to queue SLA scan.");
        return;
      }
      toast.success("SLA scan queued.");
      load();
    });
  };

  return (
    <div>
      <PageHeader
        title="System health"
        description="Infrastructure status for PostgreSQL, Redis, and background workers. Restricted to owners and admins."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={pending}>
              Refresh
            </Button>
            <Button onClick={runSlaScan} disabled={pending}>
              Queue SLA scan
            </Button>
          </div>
        }
      />

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["PostgreSQL", data.health.postgres],
                ["Redis", data.health.redis],
                ["Worker / queues", { status: data.health.worker.status, latencyMs: null as number | null }],
              ] as const
            ).map(([label, item]) => (
              <div key={label} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{label}</p>
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </div>
                {"latencyMs" in item && item.latencyMs != null ? (
                  <p className="mt-2 text-xs text-muted-foreground">{item.latencyMs} ms</p>
                ) : null}
                {label === "Worker / queues" ? (
                  <p className="mt-2 text-xs text-muted-foreground">{data.health.worker.detail}</p>
                ) : null}
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Checked at {new Date(data.health.checkedAt).toLocaleString()}
          </p>

          {!data.queues.available ? (
            <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
              Queue observability unavailable: {data.queues.reason}
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {[data.queues.email, data.queues.maintenance].map((queue) => (
                <section key={queue.name} className="rounded-lg border bg-card p-4 shadow-sm">
                  <h2 className="text-sm font-semibold">{queue.name}</h2>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    {Object.entries(queue.counts).map(([key, value]) => (
                      <div key={key} className="rounded-md bg-muted/40 px-2 py-1.5">
                        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {key}
                        </dt>
                        <dd className="font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Recent failures
                    </h3>
                    {queue.recentFailed.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">None</p>
                    ) : (
                      <ul className="mt-2 space-y-2 text-sm">
                        {queue.recentFailed.map((job) => (
                          <li key={`${queue.name}-${job.id}`} className="rounded-md border px-3 py-2">
                            <p className="font-medium">
                              {job.name} <span className="text-muted-foreground">#{job.id}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              attempts={job.attemptsMade}
                              {job.failedReason ? ` · ${job.failedReason}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
