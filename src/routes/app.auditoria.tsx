import { createFileRoute } from "@tanstack/react-router";
import { MODULES } from "@/lib/modules";
import { ModulePage } from "@/components/module-page";
import { RequirePermission } from "@/components/require-permission";

const mod = MODULES.find((m) => m.to === "/app/auditoria")!;

export const Route = createFileRoute("/app/auditoria")({
  head: () => ({
    meta: [
      { title: `${mod.label} — GBS` },
      { name: "description", content: mod.description },
    ],
  }),
  component: () => (
    <RequirePermission permission="settings">
      <ModulePage module={mod} />
    </RequirePermission>
  ),
});
