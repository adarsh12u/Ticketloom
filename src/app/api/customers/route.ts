import { NextResponse } from "next/server";

import {
  handleCustomerRouteError,
  requireApiUser,
  customerService,
} from "@/controllers/customer-controller";
import { checkRateLimit } from "@/lib/redis/rate-limit";
import {
  createCustomerSchema,
  listCustomersSchema,
} from "@/lib/validations/customer";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const parsed = listCustomersSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (parsed.data.q) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const rate = await checkRateLimit(`search:customers:${user.id}:${ip}`, 60, 60_000);
      if (!rate.allowed) {
        return NextResponse.json(
          { error: "Too many search requests. Please try again later." },
          { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
        );
      }
    }

    const result = await customerService.list(user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleCustomerRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const customer = await customerService.create(user.id, parsed.data);
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return handleCustomerRouteError(error);
  }
}
