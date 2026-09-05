import { NextResponse } from "next/server";

import {
  handleTicketRouteError,
  requireApiUser,
  ticketService,
} from "@/controllers/ticket-controller";
import { createTagSchema } from "@/lib/validations/ticket";

export async function GET() {
  try {
    const user = await requireApiUser();
    const meta = await ticketService.getMeta(user.id);
    return NextResponse.json({ tags: meta.tags });
  } catch (error) {
    return handleTicketRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const tag = await ticketService.createTag(user.id, parsed.data);
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return handleTicketRouteError(error);
  }
}
