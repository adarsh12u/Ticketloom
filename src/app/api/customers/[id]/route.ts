import { NextResponse } from "next/server";

import {
  handleCustomerRouteError,
  requireApiUser,
  customerService,
} from "@/controllers/customer-controller";
import { updateCustomerSchema } from "@/lib/validations/customer";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const customer = await customerService.get(user.id, id);
    return NextResponse.json({ customer });
  } catch (error) {
    return handleCustomerRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const customer = await customerService.update(user.id, id, parsed.data);
    return NextResponse.json({ customer });
  } catch (error) {
    return handleCustomerRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const customer = await customerService.archive(user.id, id);
    return NextResponse.json({ customer });
  } catch (error) {
    return handleCustomerRouteError(error);
  }
}
