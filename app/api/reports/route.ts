import { NextRequest, NextResponse } from "next/server";
import { auth as adminAuth, db as adminDb } from "@/lib/firebase-admin";

function startOfDay(d: Date) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}

function endOfDay(d: Date) {
  const t = new Date(d);
  t.setHours(23, 59, 59, 999);
  return t;
}

function daysBetween(start: Date, end: Date) {
  const days: string[] = [];
  const cur = new Date(startOfDay(start));
  while (cur <= endOfDay(end)) {
    days.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("range");
    const startParam = req.nextUrl.searchParams.get("start");
    const endParam = req.nextUrl.searchParams.get("end");

    let start: Date;
    let end: Date = new Date();

    if (startParam && endParam) {
      start = new Date(startParam);
      end = new Date(endParam);
    } else if (q === "today") {
      start = startOfDay(new Date());
      end = endOfDay(new Date());
    } else if (q === "week") {
      const now = new Date();
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
      end = endOfDay(now);
    } else if (q === "month") {
      const now = new Date();
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      end = endOfDay(now);
    } else if (q === "year") {
      const now = new Date();
      start = startOfDay(new Date(now.getFullYear(), 0, 1));
      end = endOfDay(now);
    } else {
      // default last 7 days
      const now = new Date();
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
      end = endOfDay(now);
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid date range" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(token);

    const snap = await adminDb
      .collection("sales")
      .where("createdBy", "==", decoded.uid)
      .get();

    const days = daysBetween(start, end);
    const series: Record<string, number> = {};
    days.forEach((d) => (series[d] = 0));

    let revenue = 0;
    let cost = 0;
    let profit = 0;
    let transactions = 0;

    snap.docs.forEach((d) => {
      const data = d.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      if (createdAt < start || createdAt > end) return;

      const day = createdAt.toISOString().split("T")[0];
      const g = Number(data.grandTotal || 0);
      const c = Number(data.totalCost || 0);
      const p = Number(data.totalProfit || (g - c));
      revenue += g;
      cost += c;
      profit += p;
      transactions += 1;
      if (series[day] != null) series[day] += g;
    });

    const summary = { revenue, cost, profit, transactions };

    return NextResponse.json({ success: true, data: { summary, series, days } });
  } catch (error) {
    console.error("Error generating reports:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to generate reports" }, { status: 500 });
  }
}
