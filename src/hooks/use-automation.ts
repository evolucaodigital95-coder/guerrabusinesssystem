import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useSession } from "@/hooks/use-session";
import { emitAutomation } from "@/lib/automation/engine";
import type { AutomationEvent, AutomationPayload } from "@/lib/automation/events";

/**
 * Ponto único de disparo de automações na interface.
 * Uso: const { emit } = useAutomation(); ... emit("lecture.created", { lectureId });
 */
export function useAutomation() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { user } = useSession();

  const emit = useCallback(
    async (event: AutomationEvent, payload: AutomationPayload = {}, options?: { dryRun?: boolean }) => {
      if (!organizationId) return [];
      return emitAutomation(
        {
          supabase,
          queryClient,
          organizationId,
          userId: user?.id ?? null,
          userLabel:
            (user?.user_metadata?.["full_name"] as string | undefined) ?? user?.email ?? null,
          dryRun: options?.dryRun,
        },
        event,
        payload,
      );
    },
    [organizationId, queryClient, user],
  );

  return { emit, ready: !!organizationId };
}
