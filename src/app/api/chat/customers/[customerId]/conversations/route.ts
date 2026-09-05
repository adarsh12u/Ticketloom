import { NextResponse } from "next/server";

import {
  chatService,
  handleChatRouteError,
  requireApiUser,
} from "@/controllers/chat-controller";

type Params = { params: Promise<{ customerId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { customerId } = await params;
    const conversations = await chatService.listForCustomer(user.id, customerId);
    return NextResponse.json({ conversations });
  } catch (error) {
    return handleChatRouteError(error);
  }
}
