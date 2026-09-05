import { NextResponse } from "next/server";

import {
  chatService,
  handleChatRouteError,
  requireApiUser,
} from "@/controllers/chat-controller";

export async function GET() {
  try {
    const user = await requireApiUser();
    const counts = await chatService.unreadCounts(user.id);
    return NextResponse.json({ counts });
  } catch (error) {
    return handleChatRouteError(error);
  }
}
