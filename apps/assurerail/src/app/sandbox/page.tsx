import { notFound } from "next/navigation";
import { sandboxEnabled } from "@/lib/customer-workspace";
import { SandboxExperience } from "./SandboxExperience";

export const metadata = {
  title: "Private full-system demonstration",
  description: "A non-operative synthetic AssureRail walkthrough across institutional, DA, PTC, lifecycle, integration and operations controls.",
  robots: { index: false, follow: false },
};

export default function SandboxPage() {
  if (!sandboxEnabled()) notFound();
  return <SandboxExperience />;
}
