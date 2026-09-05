"use client";

import { signIn } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type GoogleAuthButtonProps = {
  label?: string;
};

export function GoogleAuthButton({ label = "Continue with Google" }: GoogleAuthButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={async () => {
        try {
          await signIn("google", { callbackUrl: "/dashboard" });
        } catch {
          toast.error("Unable to sign in with Google. Please try again.");
        }
      }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M21.35 11.1h-9.18v2.96h5.27c-.23 1.5-1.78 4.4-5.27 4.4-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.84 4.14 14.84 3.2 12.17 3.2 7.13 3.2 3.05 7.3 3.05 12.4s4.08 9.2 9.12 9.2c5.26 0 8.73-3.7 8.73-8.9 0-.6-.07-1.05-.15-1.6Z"
        />
      </svg>
      {label}
    </Button>
  );
}
