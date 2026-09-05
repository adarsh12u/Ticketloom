"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { RoleBadge } from "@/components/organization/role-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type InvitationAcceptCardProps = {
  token: string;
  authenticated: boolean;
  invitation: {
    email: string;
    role: string;
    expiresAt: string;
    organization: { name: string; slug: string };
    invitedBy: { name: string | null; email: string } | null;
  } | null;
  error: string | null;
};

export function InvitationAcceptCard({
  token,
  authenticated,
  invitation,
  error,
}: InvitationAcceptCardProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function accept() {
    setPending(true);
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to accept invitation.");
      toast.success("Welcome to the organization");
      router.push("/dashboard");
      router.refresh();
    } catch (acceptError) {
      toast.error(
        acceptError instanceof Error ? acceptError.message : "Unable to accept invitation.",
      );
    } finally {
      setPending(false);
    }
  }

  if (error || !invitation) {
    return (
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle>Invitation unavailable</CardTitle>
          <CardDescription>
            {error ?? "This invitation link is invalid or has already been used."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/login">Go to login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle>Join {invitation.organization.name}</CardTitle>
        <CardDescription>
          You were invited as <RoleBadge role={invitation.role} className="align-middle" /> to{" "}
          <span className="font-medium text-foreground">{invitation.organization.slug}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/40 px-3 py-3 text-sm">
          <p>
            Invited email: <span className="font-medium">{invitation.email}</span>
          </p>
          {invitation.invitedBy ? (
            <p className="mt-1 text-muted-foreground">
              Invited by {invitation.invitedBy.name ?? invitation.invitedBy.email}
            </p>
          ) : null}
          <p className="mt-1 text-muted-foreground">
            Expires {new Date(invitation.expiresAt).toLocaleString()}
          </p>
        </div>

        {authenticated ? (
          <Button onClick={accept} disabled={pending} className="w-full">
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Accept invitation
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Sign in with <span className="font-medium text-foreground">{invitation.email}</span>{" "}
              to accept this invitation.
            </p>
            <Button asChild className="w-full">
              <Link href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}>
                Sign in to accept
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/signup?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}>
                Create account
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
