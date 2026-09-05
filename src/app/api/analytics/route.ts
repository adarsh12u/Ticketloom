import { NextResponse } from "next/server";
import { z } from "zod";

import {
  analyticsService,
  handleAnalyticsRouteError,
  requireApiUser,
} from "@/controllers/analytics-controller";

const rangeSchema = z.enum(["7", "30", "90"]).transform((v) => Number(v) as 7 | 30 | 90);

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const parsed = rangeSchema.safeParse(url.searchParams.get("range") ?? "30");
    if (!parsed.success) {
      return NextResponse.json(
        { error: "range must be 7, 30, or 90.", code: "VALIDATION" },
        { status: 400 },
      );
    }
    const data = await analyticsService.getDashboard(user.id, parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    return handleAnalyticsRouteError(error);
  }
}
