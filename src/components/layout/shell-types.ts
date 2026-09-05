export type ShellUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type ShellOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export function getUserInitials(user: Pick<ShellUser, "name" | "firstName" | "lastName" | "email">) {
  if (user.firstName || user.lastName) {
    return `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "U";
  }
  if (user.name) {
    const parts = user.name.trim().split(/\s+/);
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "U";
  }
  return user.email.slice(0, 2).toUpperCase();
}

export function roleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  if (role === "OWNER") return "default";
  if (role === "ADMIN" || role === "MANAGER") return "secondary";
  return "outline";
}
