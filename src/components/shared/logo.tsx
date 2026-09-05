import Link from "next/link";

import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  href?: string;
  showWordmark?: boolean;
};

export function Logo({ className, href = "/", showWordmark = true }: LogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <path
            d="M5 7.5 12 4l7 3.5v6.2c0 3.2-2.6 5.9-7 7.3-4.4-1.4-7-4.1-7-7.3V7.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9 12.2h6M12 9.5v5.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {showWordmark ? (
        <span className="text-sm font-semibold tracking-tight text-foreground">Ticketloom</span>
      ) : null}
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  );
}
