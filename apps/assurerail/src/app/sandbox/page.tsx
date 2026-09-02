import { notFound } from "next/navigation";
import { sandboxEnabled } from "@/lib/customer-workspace";
import { SandboxExperience } from "./SandboxExperience";

export const metadata = {
  title: "Synthetic DA/PTC sandbox",
  description: "A non-operative synthetic AssureRail walkthrough. It cannot satisfy customer, route or production evidence gates.",
  robots: { index: false, follow: false },
};

export default function SandboxPage() {
  if (!sandboxEnabled()) notFound();
  return <SandboxExperience />;
}
