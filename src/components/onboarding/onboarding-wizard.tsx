"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Settings2, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const steps = [
  {
    id: 1,
    title: "Workspace details",
    description: "Confirm or update your organization name.",
    icon: Building2,
  },
  {
    id: 2,
    title: "Invite team",
    description: "Invite agents who will work in this organization.",
    icon: Users,
  },
  {
    id: 3,
    title: "Preferences",
    description: "Set default support channels and priorities.",
    icon: Settings2,
  },
  {
    id: 4,
    title: "Finish setup",
    description: "Review and open your Ticketloom workspace.",
    icon: Check,
  },
] as const;

const workspaceSchema = z.object({
  workspaceName: z.string().min(2, "Workspace name is required"),
  industry: z.string().optional(),
});

const inviteSchema = z.object({
  emails: z.string().optional(),
});

const preferencesSchema = z.object({
  defaultPriority: z.string().min(1),
  supportEmail: z.union([z.literal(""), z.email("Enter a valid support email")]),
});

type WorkspaceValues = z.infer<typeof workspaceSchema>;
type InviteValues = z.infer<typeof inviteSchema>;
type PreferencesValues = z.infer<typeof preferencesSchema>;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [pending, setPending] = React.useState(false);

  const workspaceForm = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { workspaceName: "", industry: "SaaS" },
  });

  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { emails: "" },
  });

  const preferencesForm = useForm<PreferencesValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: { defaultPriority: "MEDIUM", supportEmail: "" },
  });

  React.useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/organizations/current");
        if (!response.ok) return;
        const data = (await response.json()) as {
          organization?: { name?: string };
        };
        if (data.organization?.name) {
          workspaceForm.setValue("workspaceName", data.organization.name);
        }
      } catch {
        // ignore preload failures; user can still type a name
      }
    })();
  }, [workspaceForm]);

  async function saveWorkspace(values: WorkspaceValues) {
    setPending(true);
    try {
      const response = await fetch("/api/organizations/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.workspaceName }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        // If user has no org yet, create one
        const createResponse = await fetch("/api/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: values.workspaceName }),
        });
        const createData = (await createResponse.json()) as { error?: string };
        if (!createResponse.ok) {
          throw new Error(createData.error ?? data.error ?? "Unable to save workspace.");
        }
      }
      toast.success("Workspace saved");
      setStep(2);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save workspace.");
    } finally {
      setPending(false);
    }
  }

  async function sendInvites(values: InviteValues) {
    setPending(true);
    try {
      const emails = (values.emails ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      for (const email of emails) {
        const response = await fetch("/api/organizations/members/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role: "AGENT" }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? `Unable to invite ${email}.`);
        }
      }

      if (emails.length > 0) {
        toast.success(`Sent ${emails.length} invitation${emails.length === 1 ? "" : "s"}`);
      }
      setStep(3);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send invitations.");
    } finally {
      setPending(false);
    }
  }

  const finish = () => {
    toast.success("Onboarding complete");
    router.push("/dashboard");
    router.refresh();
  };

  const skip = () => {
    router.push("/dashboard");
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            Step {step} of {steps.length}
          </span>
          <Button variant="ghost" size="sm" onClick={skip}>
            Skip for now
          </Button>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(step / steps.length) * 100}%` }}
          />
        </div>
        <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((item) => {
            const Icon = item.icon;
            const active = item.id === step;
            const complete = item.id < step;
            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-md border px-2.5 py-2",
                  active && "border-primary/40 bg-primary/5",
                  complete && "border-success/30 bg-success/5",
                )}
              >
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5",
                      active && "text-primary",
                      complete && "text-success",
                      !active && !complete && "text-muted-foreground",
                    )}
                  />
                  <span className="truncate">{item.title}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">{steps[step - 1].title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{steps[step - 1].description}</p>
        </div>

        {step === 1 ? (
          <form
            className="space-y-4"
            onSubmit={workspaceForm.handleSubmit(saveWorkspace)}
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="workspaceName">Workspace name</Label>
              <Input id="workspaceName" {...workspaceForm.register("workspaceName")} />
              {workspaceForm.formState.errors.workspaceName ? (
                <p className="text-xs text-destructive">
                  {workspaceForm.formState.errors.workspaceName.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="SaaS, Ecommerce, Fintech…"
                {...workspaceForm.register("industry")}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={pending}>
                Continue
              </Button>
            </div>
          </form>
        ) : null}

        {step === 2 ? (
          <form className="space-y-4" onSubmit={inviteForm.handleSubmit(sendInvites)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="emails">Team emails</Label>
              <Input
                id="emails"
                placeholder="alex@acme.com, sam@acme.com"
                {...inviteForm.register("emails")}
              />
              <p className="text-xs text-muted-foreground">
                Optional. Separate multiple emails with commas. Invites use the secure invitation
                system.
              </p>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="submit" disabled={pending}>
                Continue
              </Button>
            </div>
          </form>
        ) : null}

        {step === 3 ? (
          <form
            className="space-y-4"
            onSubmit={preferencesForm.handleSubmit(() => setStep(4))}
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="defaultPriority">Default ticket priority</Label>
              <Input id="defaultPriority" {...preferencesForm.register("defaultPriority")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support email</Label>
              <Input
                id="supportEmail"
                type="email"
                {...preferencesForm.register("supportEmail")}
              />
              {preferencesForm.formState.errors.supportEmail ? (
                <p className="text-xs text-destructive">
                  {preferencesForm.formState.errors.supportEmail.message}
                </p>
              ) : null}
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="submit">Continue</Button>
            </div>
          </form>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-4 text-sm">
              <p className="font-medium text-foreground">Your organization is ready.</p>
              <p className="mt-1 text-muted-foreground">
                Membership, roles, and invitations are live. Tickets and other modules arrive in
                later milestones.
              </p>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button type="button" onClick={finish}>
                Open dashboard
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
