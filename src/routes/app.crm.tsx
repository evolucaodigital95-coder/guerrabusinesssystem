import { createFileRoute } from "@tanstack/react-router";
import { MODULES } from "@/lib/modules";
import { ModulePage } from "@/components/module-page";

const mod = MODULES.find((m) => m.to === "/app/crm")!;

export const Route = createFileRoute("/app/crm")({
  head: () => ({
    meta: [
      { title: `${mod.label} — GBS` },
      { name: "description", content: mod.description },
    ],
  }),
  component: () => <ModulePage module={mod} />,
});
