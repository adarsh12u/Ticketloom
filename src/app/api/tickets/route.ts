import { NextResponse } from "next/server";

import {
  handleTicketRouteError,
  requireApiUser,
  ticketService,
} from "@/controllers/ticket-controller";
import { checkRateLimit } from "@/lib/redis/rate-limit";
import { createTicketSchema, listTicketsSchema } from "@/lib/validations/ticket";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const parsed = listTicketsSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (parsed.data.q) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const rate = await checkRateLimit(`search:tickets:${user.id}:${ip}`, 60, 60_000);
      if (!rate.allowed) {
        return NextResponse.json(
          { error: "Too many search requests. Please try again later." },
          { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
        );
      }
    }

    const result = await ticketService.list(user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleTicketRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const ticket = await ticketService.create(user.id, parsed.data);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return handleTicketRouteError(error);
  }
}
