import { NextResponse } from "next/server";

import {
  handleCustomerRouteError,
  requireApiUser,
  customerService,
} from "@/controllers/customer-controller";
import { createCustomerNoteSchema } from "@/lib/validations/customer";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = createCustomerNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const note = await customerService.addNote(user.id, id, parsed.data.body);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return handleCustomerRouteError(error);
  }
}
