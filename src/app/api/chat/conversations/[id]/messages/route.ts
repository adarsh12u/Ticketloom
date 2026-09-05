import { NextResponse } from "next/server";

import {
  chatService,
  handleChatRouteError,
  requireApiUser,
} from "@/controllers/chat-controller";
import { listMessagesSchema } from "@/lib/validations/chat";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const url = new URL(request.url);
    const parsed = listMessagesSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed." }, { status: 400 });
    }
    const result = await chatService.listMessages(user.id, id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleChatRouteError(error);
  }
}
