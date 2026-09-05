import { NextResponse } from "next/server";

import {
  chatService,
  handleChatRouteError,
  requireApiUser,
} from "@/controllers/chat-controller";
import {
  createConversationSchema,
  listConversationsSchema,
} from "@/lib/validations/chat";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const parsed = listConversationsSchema.safeParse(
      Object.fromEntries(url.searchParams),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const result = await chatService.list(user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleChatRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = createConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const conversation = await chatService.create(user.id, parsed.data);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    return handleChatRouteError(error);
  }
}
