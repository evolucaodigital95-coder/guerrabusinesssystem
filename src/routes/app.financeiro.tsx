import { createFileRoute } from "@tanstack/react-router";
import { MODULES } from "@/lib/modules";
import { ModulePage } from "@/components/module-page";

const mod = MODULES.find((m) => m.to === "/app/financeiro")!;

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({
    meta: [
      { title: `${mod.label} — GBS` },
      { name: "description", content: mod.description },
    ],
  }),
  component: () => <ModulePage module={mod} />,
});
