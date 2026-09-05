import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export const metadata: Metadata = {
  title: "Reset password",
};

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.03_255)_0%,_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.26_0.04_255)_0%,_transparent_50%)]" />
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
            <p className="text-sm text-muted-foreground">
              Enter a strong password to finish resetting your account.
            </p>
          </div>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>
      <footer className="relative z-10 px-4 py-4 text-center text-xs text-muted-foreground">
        <Link href="/login" className="hover:text-foreground">
          Back to sign in
        </Link>
      </footer>
    </div>
  );
}
