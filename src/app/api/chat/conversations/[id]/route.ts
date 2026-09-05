import { NextResponse } from "next/server";

import {
  chatService,
  handleChatRouteError,
  requireApiUser,
} from "@/controllers/chat-controller";
import {
  assignConversationSchema,
  updateConversationStatusSchema,
} from "@/lib/validations/chat";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const conversation = await chatService.get(user.id, id);
    return NextResponse.json({ conversation });
  } catch (error) {
    return handleChatRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = await request.json();

    if ("assigneeId" in body) {
      const parsed = assignConversationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed." }, { status: 400 });
      }
      const conversation = await chatService.assign(user.id, {
        conversationId: id,
        assigneeId: parsed.data.assigneeId,
      });
      return NextResponse.json({ conversation });
    }

    if ("status" in body) {
      const parsed = updateConversationStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed." }, { status: 400 });
      }
      const conversation = await chatService.updateStatus(user.id, id, parsed.data.status);
      return NextResponse.json({ conversation });
    }

    return NextResponse.json({ error: "No supported fields." }, { status: 400 });
  } catch (error) {
    return handleChatRouteError(error);
  }
}
