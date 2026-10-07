"use client";

import { useEffect } from "react";

import { startErrorReports } from "@/lib/errors";
import { useSite } from "./LocaleProvider";

export default function ErrorReporter({ release }: { release?: string }) {
  const dsn = useSite().errorsDsn;
  useEffect(() => startErrorReports(dsn, release), [dsn, release]);
  return null;
}
