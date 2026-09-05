import { NextResponse } from "next/server";

import {
  handleTicketRouteError,
  requireApiUser,
  ticketService,
} from "@/controllers/ticket-controller";

export async function GET() {
  try {
    const user = await requireApiUser();
    const meta = await ticketService.getMeta(user.id);
    return NextResponse.json(meta);
  } catch (error) {
    return handleTicketRouteError(error);
  }
}
