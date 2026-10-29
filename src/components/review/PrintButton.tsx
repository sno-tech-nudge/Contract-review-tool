"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button className="btn btn--sm" onClick={() => window.print()}>
      <Printer /> Print or save as PDF
    </button>
  );
}
