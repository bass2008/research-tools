"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export default function ExampleGoal({ example }: { example: string }) {
  useEffect(() => { track("individual_example", { example }); }, [example]);
  return null;
}
