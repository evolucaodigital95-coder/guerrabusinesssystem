import { useState } from "react";
import { CalendarPlus, Download, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadICS, googleCalendarUrl, type CalendarLecture } from "@/lib/calendar";

/** Botão "Agenda" com Google Agenda, iPhone/Outlook (.ics) e ajuda para o TimeTree. */
export function CalendarActions({
  lecture,
  loadMany,
  label = "Agenda",
}: {
  /** Uma palestra (página da palestra). */
  lecture?: CalendarLecture;
  /** Várias palestras (página Agenda): carregadas sob demanda. */
  loadMany?: () => Promise<CalendarLecture[]>;
  label?: string;
}) {
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  async function exportMany() {
    if (!loadMany) return;
    setBusy(true);
    try {
      const list = await loadMany();
      if (list.length === 0) {
        toast.info("Nenhuma palestra futura para exportar.");
        return;
      }
      downloadICS(list, "palestras-gbs");
      toast.success(
        `${list.length} palestra${list.length > 1 ? "s" : ""} exportada${list.length > 1 ? "s" : ""}.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível exportar.");
    } finally {
      setBusy(false);
    }
  }

  const google = lecture
    ? googleCalendarUrl(lecture, `${window.location.origin}/app/palestras/${lecture.id}`)
    : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={busy}>
            <CalendarPlus /> {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Levar para o seu calendário
          </DropdownMenuLabel>
          {lecture && (
            <>
              <DropdownMenuItem
                disabled={!google}
                onSelect={() => google && window.open(google, "_blank", "noopener")}
              >
                <CalendarPlus /> Adicionar ao Google Agenda
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => downloadICS([lecture], `palestra-${lecture.title.slice(0, 30)}`)}
              >
                <Download /> iPhone, Mac ou Outlook (.ics)
              </DropdownMenuItem>
            </>
          )}
          {loadMany && (
            <DropdownMenuItem onSelect={exportMany}>
              <Download /> Exportar todas as próximas (.ics)
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setHelp(true)}>
            <HelpCircle /> Como ver no TimeTree
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Palestras no TimeTree</DialogTitle>
            <DialogDescription>
              O TimeTree mostra os calendários que já estão no seu celular. Então o caminho é levar
              a palestra para o Google Agenda ou para o calendário do iPhone.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li>
              <b>1.</b> Aqui no GBS, use <b>Adicionar ao Google Agenda</b> (uma palestra) ou{" "}
              <b>Exportar todas as próximas (.ics)</b> e abra o arquivo no celular.
            </li>
            <li>
              <b>2.</b> No TimeTree, abra o menu do calendário e ative a exibição dos calendários do
              aparelho (Google/iCloud). O nome da opção pode variar conforme a versão do app.
            </li>
            <li>
              <b>3.</b> As palestras aparecem junto com os eventos da família ou da equipe, com
              lembrete um dia antes.
            </li>
          </ol>
          <p className="text-[11px] text-muted-foreground">
            Sincronização automática (cada nova palestra entrando sozinha no Google Agenda) exige
            conectar uma conta Google ao GBS — fica para uma próxima etapa.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
