import { NextResponse } from "next/server";

import {
  handleCustomerRouteError,
  requireApiUser,
  customerService,
} from "@/controllers/customer-controller";

export async function GET() {
  try {
    const user = await requireApiUser();
    const meta = await customerService.getMeta(user.id);
    return NextResponse.json(meta);
  } catch (error) {
    return handleCustomerRouteError(error);
  }
}
