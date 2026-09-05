"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnalyticsDashboard } from "@/services/analytics-service";

type AnalyticsDashboardProps = {
  initialData: AnalyticsDashboard;
};

function pct(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

export function AnalyticsDashboardView({ initialData }: AnalyticsDashboardProps) {
  const [range, setRange] = React.useState<7 | 30 | 90>(initialData.range);
  const [data, setData] = React.useState(initialData);
  const [loading, setLoading] = React.useState(false);

  async function loadRange(next: 7 | 30 | 90) {
    setRange(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?range=${next}`);
      if (!res.ok) throw new Error("Failed to load analytics");
      const json = (await res.json()) as AnalyticsDashboard;
      setData(json);
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  }

  const kpis = [
    { label: "Tickets created", value: data.tickets.created },
    { label: "Open tickets", value: data.support.openTickets },
    { label: "Customers", value: data.customers.total },
    { label: "New customers", value: data.customers.newInRange },
    { label: "Chat messages", value: data.chat.messagesSent },
    { label: "KB views", value: data.knowledge.views },
    { label: "AI requests", value: data.ai.requests },
    { label: "AI success", value: pct(data.ai.successRate) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Support, CRM, chat, knowledge, and AI metrics for your organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {([7, 30, 90] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={range === option ? "default" : "outline"}
              disabled={loading}
              onClick={() => void loadRange(option)}
            >
              {option}d
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tickets created</CardTitle>
            <CardDescription>Daily volume in the selected range</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.tickets.byDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI usage</CardTitle>
            <CardDescription>Requests and successes per day</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.ai.byDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  name="Requests"
                />
                <Line
                  type="monotone"
                  dataKey="success"
                  stroke="#64748b"
                  strokeWidth={2}
                  dot={false}
                  name="Success"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Support & tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.tickets.byStatus.map((row) => (
              <div key={row.status} className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {row.status.replaceAll("_", " ")}
                </span>
                <Badge variant="secondary">{row.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chat & knowledge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Conversations" value={data.chat.conversationsCreated} />
            <Row label="Messages" value={data.chat.messagesSent} />
            <Row label="Published articles" value={data.knowledge.published} />
            <Row label="Searches" value={data.knowledge.searches} />
            <Row label="Zero-result searches" value={data.knowledge.noResultSearches} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI acceptance</CardTitle>
            <CardDescription>
              Generated, inserted, edited, and sent are tracked separately
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Generated" value={data.ai.acceptance.generated} />
            <Row label="Inserted" value={data.ai.acceptance.inserted} />
            <Row label="Edited" value={data.ai.acceptance.edited} />
            <Row label="Sent" value={data.ai.acceptance.sent} />
            <Row label="Insert rate" value={pct(data.ai.acceptance.insertedRate)} />
            <Row label="Sent rate" value={pct(data.ai.acceptance.sentRate)} />
            <Row label="Helpful rate" value={pct(data.ai.feedback.helpfulRate)} />
            <Row
              label="Avg latency"
              value={
                data.ai.avgLatencyMs != null
                  ? `${Math.round(data.ai.avgLatencyMs)} ms`
                  : "—"
              }
            />
            <Row label="RAG retrievals" value={data.ai.rag.retrievals} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
