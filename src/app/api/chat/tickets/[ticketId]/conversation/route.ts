import { NextResponse } from "next/server";

import {
  chatService,
  handleChatRouteError,
  requireApiUser,
} from "@/controllers/chat-controller";

type Params = { params: Promise<{ ticketId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { ticketId } = await params;
    const conversation = await chatService.getOrCreateForTicket(user.id, ticketId);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    return handleChatRouteError(error);
  }
}
