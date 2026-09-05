import { NextResponse } from "next/server";

import {
  handleCustomerRouteError,
  requireApiUser,
  customerService,
} from "@/controllers/customer-controller";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const customer = await customerService.restore(user.id, id);
    return NextResponse.json({ customer });
  } catch (error) {
    return handleCustomerRouteError(error);
  }
}
