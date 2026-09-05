import { NextResponse } from "next/server";

import {
  handleTicketRouteError,
  requireApiUser,
  ticketService,
} from "@/controllers/ticket-controller";
import { updateTicketSchema } from "@/lib/validations/ticket";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const ticket = await ticketService.get(user.id, id);
    return NextResponse.json({ ticket });
  } catch (error) {
    return handleTicketRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const ticket = await ticketService.update(user.id, id, parsed.data);
    return NextResponse.json({ ticket });
  } catch (error) {
    return handleTicketRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const ticket = await ticketService.archive(user.id, id);
    return NextResponse.json({ ticket });
  } catch (error) {
    return handleTicketRouteError(error);
  }
}
