"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailPlus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { RoleBadge } from "@/components/organization/role-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSIGNABLE_ROLES, MEMBER_ROLES } from "@/lib/authz/permissions";

export type MemberRow = {
  id: string;
  role: string;
  status: string;
  createdAt: string | Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    firstName: string | null;
    lastName: string | null;
  };
};

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | Date;
  invitedBy: { id: string; name: string | null; email: string } | null;
};

type MembersManagerProps = {
  members: MemberRow[];
  invitations: InvitationRow[];
  currentUserId: string;
  canInvite: boolean;
  canUpdate: boolean;
  canRemove: boolean;
};

export function MembersManager({
  members,
  invitations,
  currentUserId,
  canInvite,
  canUpdate,
  canRemove,
}: MembersManagerProps) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<(typeof ASSIGNABLE_ROLES)[number]>("AGENT");
  const [pending, setPending] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<MemberRow | null>(null);

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/organizations/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to send invitation.");
      toast.success("Invitation sent");
      setInviteOpen(false);
      setEmail("");
      setRole("AGENT");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send invitation.");
    } finally {
      setPending(false);
    }
  }

  async function updateRole(membershipId: string, nextRole: string) {
    setPending(true);
    try {
      const response = await fetch("/api/organizations/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, role: nextRole }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to update role.");
      toast.success("Role updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update role.");
    } finally {
      setPending(false);
    }
  }

  async function removeMember() {
    if (!removeTarget) return;
    setPending(true);
    try {
      const response = await fetch("/api/organizations/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: removeTarget.id }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to remove member.");
      toast.success("Member removed");
      setRemoveTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove member.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage who can access this organization and what they can do.
          </p>
        </div>
        {canInvite ? (
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <MailPlus className="h-4 w-4" />
            Invite member
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization members</CardTitle>
          <CardDescription>
            {members.length === 0
              ? "No members found for this organization."
              : `${members.length} member${members.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              Invite teammates to collaborate in this workspace.
            </div>
          ) : (
            members.map((member) => {
              const displayName =
                member.user.name ??
                ([member.user.firstName, member.user.lastName].filter(Boolean).join(" ") ||
                  member.user.email);
              const isSelf = member.user.id === currentUserId;

              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 rounded-md border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {displayName}
                        {isSelf ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Status: {member.status}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {canUpdate ? (
                      <select
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={member.role}
                        disabled={pending}
                        onChange={(event) => updateRole(member.id, event.target.value)}
                        aria-label={`Role for ${displayName}`}
                      >
                        {MEMBER_ROLES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                        {!MEMBER_ROLES.includes(
                          member.role as (typeof MEMBER_ROLES)[number],
                        ) ? (
                          <option value={member.role}>{member.role}</option>
                        ) : null}
                      </select>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}

                    {canRemove && !isSelf ? (
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Remove ${displayName}`}
                        disabled={pending}
                        onClick={() => setRemoveTarget(member)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending invitations</CardTitle>
          <CardDescription>
            Invitations expire after 7 days and can only be accepted once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {invitations.filter((invite) => invite.status === "PENDING").length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No pending invitations.
            </div>
          ) : (
            invitations
              .filter((invite) => invite.status === "PENDING")
              .map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-2 rounded-md border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(invite.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <RoleBadge role={invite.role} />
                </div>
              ))
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>
              Send a secure invitation email. The recipient must sign in with the invited address.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={inviteMember} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as (typeof ASSIGNABLE_ROLES)[number])
                }
              >
                {ASSIGNABLE_ROLES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `Remove ${removeTarget.user.email} from this organization? They will lose access immediately.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={removeMember}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
