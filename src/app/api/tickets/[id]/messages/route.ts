import { NextResponse } from "next/server";

import {
  handleTicketRouteError,
  requireApiUser,
  ticketService,
} from "@/controllers/ticket-controller";
import { createTicketMessageSchema } from "@/lib/validations/ticket";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = createTicketMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await ticketService.addMessage(user.id, id, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleTicketRouteError(error);
  }
}
