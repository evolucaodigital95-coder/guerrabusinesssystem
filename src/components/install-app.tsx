import { useEffect, useState } from "react";
import { Share, Smartphone, SquarePlus } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

let deferred: InstallPrompt | null = null;
if (typeof window !== "undefined") {
  // O Chrome/Android só avisa uma vez: guardamos o convite para usar quando a pessoa pedir.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
  });
}

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

const isIOS = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Item "Instalar o app" do menu da conta (Android/desktop instala direto; iPhone mostra o passo a passo). */
export function InstallAppMenuItem() {
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  if (installed) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      return;
    }
    setHelp(true);
  }

  return (
    <>
      <DropdownMenuItem onSelect={install}>
        <Smartphone /> Instalar o app no celular
      </DropdownMenuItem>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">GBS no seu celular</DialogTitle>
            <DialogDescription>
              Fica com ícone próprio, abre em tela cheia e tem atalho para Venda no evento.
            </DialogDescription>
          </DialogHeader>
          {isIOS() ? (
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <Share className="mt-0.5 h-4 w-4 shrink-0 text-clay" />
                No Safari, toque em <b>Compartilhar</b> (o quadrado com a seta para cima).
              </li>
              <li className="flex gap-3">
                <SquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-clay" />
                Escolha <b>Adicionar à Tela de Início</b> e confirme.
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm">
              <li>
                <b>1.</b> Abra o GBS no <b>Chrome</b> do celular.
              </li>
              <li>
                <b>2.</b> Toque no menu <b>⋮</b> e escolha <b>Instalar app</b> (ou{" "}
                <b>Adicionar à tela inicial</b>).
              </li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
