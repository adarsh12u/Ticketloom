"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";

export function SignupForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      workspaceName: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = (await response.json().catch(() => null)) as
      | { error?: string; redirectTo?: string }
      | null;

    if (!response.ok) {
      const message = data?.error ?? "Unable to create account.";
      if (response.status === 409) {
        setError("email", { message });
      } else {
        setError("root", { message });
      }
      toast.error(message);
      return;
    }

    toast.success("Account created");
    router.push(data?.redirectTo ?? "/onboarding");
    router.refresh();
  });

  return (
    <div className="space-y-6">
      {errors.root ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errors.root.message}
        </div>
      ) : null}

      <GoogleAuthButton label="Continue with Google" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
        </div>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              autoComplete="given-name"
              disabled={isSubmitting}
              {...register("firstName")}
            />
            {errors.firstName ? (
              <p className="text-xs text-destructive">{errors.firstName.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              autoComplete="family-name"
              disabled={isSubmitting}
              {...register("lastName")}
            />
            {errors.lastName ? (
              <p className="text-xs text-destructive">{errors.lastName.message}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            disabled={isSubmitting}
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            disabled={isSubmitting}
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="workspaceName">Workspace name</Label>
          <Input
            id="workspaceName"
            placeholder="Acme Support"
            disabled={isSubmitting}
            {...register("workspaceName")}
          />
          {errors.workspaceName ? (
            <p className="text-xs text-destructive">{errors.workspaceName.message}</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
