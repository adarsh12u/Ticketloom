import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Bot,
  MessageSquare,
  Ticket,
  Workflow,
} from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { marketingNav } from "@/lib/navigation";

const features = [
  {
    title: "Smart Ticketing",
    description:
      "Track every customer issue with statuses, priorities, assignments, tags, and a full activity timeline.",
    icon: Ticket,
  },
  {
    title: "AI Assistance",
    description:
      "Classify tickets, summarize conversations, and draft responses — always with agent review.",
    icon: Bot,
  },
  {
    title: "Real-Time Collaboration",
    description:
      "Team chat, ticket-linked discussion, presence, and notifications keep support teams aligned.",
    icon: MessageSquare,
  },
  {
    title: "Knowledge Base",
    description:
      "Publish articles and documents your team and AI assistant can use to resolve issues faster.",
    icon: BookOpen,
  },
  {
    title: "Analytics",
    description:
      "Measure volume, response time, resolution trends, and agent performance from real data.",
    icon: BarChart3,
  },
  {
    title: "Automation",
    description:
      "Background workers handle email, notifications, AI jobs, and report generation reliably.",
    icon: Workflow,
  },
];

export function MarketingLanding() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex">
            {marketingNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.title}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Start Free</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.04_255)_0%,_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.28_0.05_255)_0%,_transparent_55%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
            <div className="flex flex-col justify-center">
              <p className="mb-3 text-sm font-medium text-primary">Ticketloom</p>
              <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
                Resolve customer issues faster with an AI-assisted support workspace.
              </h1>
              <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
                Ticketloom unifies ticketing, collaboration, knowledge, and analytics so support
                teams can work with clarity — and optional local AI when you need it.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href="/signup">Start Free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/dashboard">View Demo</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-3 shadow-sm sm:p-4">
              <div className="rounded-lg border bg-background">
                <div className="flex items-center gap-2 border-b px-3 py-2.5">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                  </div>
                  <div className="ml-2 h-6 flex-1 rounded-md bg-muted/70" />
                </div>
                <div className="grid gap-3 p-3 sm:grid-cols-[140px_1fr]">
                  <div className="hidden space-y-2 rounded-md border bg-sidebar p-2 sm:block">
                    {["Overview", "Tickets", "Customers", "Knowledge", "Chat"].map((item, index) => (
                      <div
                        key={item}
                        className={`rounded-md px-2 py-1.5 text-xs ${
                          index === 1 ? "bg-sidebar-accent font-medium text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {["128", "34", "9", "86"].map((value, index) => (
                        <div key={value} className="rounded-md border p-2.5">
                          <div className="text-[10px] text-muted-foreground">
                            {["Total", "Open", "Urgent", "Resolved"][index]}
                          </div>
                          <div className="mt-1 text-lg font-semibold">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-medium">Recent tickets</div>
                        <div className="text-xs text-primary">View all</div>
                      </div>
                      {[
                        ["#1042", "Payment webhook failed", "Urgent"],
                        ["#1041", "Refund policy question", "Medium"],
                        ["#1040", "SSO login loop", "High"],
                      ].map(([id, subject, priority]) => (
                        <div
                          key={id}
                          className="flex items-center justify-between border-t py-2 text-xs first:border-t-0"
                        >
                          <div>
                            <span className="font-medium text-foreground">{id}</span>
                            <span className="ml-2 text-muted-foreground">{subject}</span>
                          </div>
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight">Built for modern support teams</h2>
            <p className="mt-2 text-muted-foreground">
              Every capability maps to a real operational need — not a feature checklist for show.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-lg border bg-card p-5 shadow-sm">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="how-it-works" className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                ["Capture", "Tickets arrive from customers and channels into one workspace."],
                ["Collaborate", "Agents discuss internally, use knowledge, and draft AI-assisted replies."],
                ["Improve", "Analytics and audit logs reveal performance and accountability."],
              ].map(([title, copy], index) => (
                <div key={title} className="rounded-lg border bg-card p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Step {index + 1}
                  </div>
                  <h3 className="mt-2 text-base font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight">Simple pricing for teams</h2>
            <p className="mt-2 text-muted-foreground">
              Portfolio demo pricing — no payment integration in Milestone 1.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Starter", "Free", "For small teams evaluating Ticketloom"],
              ["Growth", "$29", "For growing support orgs with AI workflows"],
              ["Scale", "$79", "For multi-team workspaces and advanced controls"],
            ].map(([name, price, copy], index) => (
              <div
                key={name}
                className={`rounded-lg border bg-card p-6 shadow-sm ${
                  index === 1 ? "border-primary/40 ring-1 ring-primary/20" : ""
                }`}
              >
                <h3 className="text-base font-semibold">{name}</h3>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {price}
                  {price !== "Free" ? (
                    <span className="text-sm font-normal text-muted-foreground"> /seat</span>
                  ) : null}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
                <Button className="mt-5 w-full" variant={index === 1 ? "default" : "outline"} asChild>
                  <Link href="/signup">Get started</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section id="documentation" className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="rounded-xl border bg-card px-6 py-10 text-center shadow-sm sm:px-10">
              <h2 className="text-2xl font-semibold tracking-tight">
                Ready to explore the product shell?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                Start with the dashboard foundation. Authentication, multi-tenancy, tickets, Redis,
                workers, chat, and AI follow in later milestones.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button size="lg" asChild>
                  <Link href="/signup">Start Free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/dashboard">View Demo</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} Ticketloom. Built as a portfolio-quality modular monolith.</p>
        </div>
      </footer>
    </div>
  );
}
