import { useEffect, useRef, useState } from "react";
import { Camera, ClipboardPaste, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseScannedCode, type ParsedDocument } from "@/lib/boleto";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (result: ParsedDocument) => void;
};

export function ScannerDialog({ open, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [manual, setManual] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);

  function processar(codigo: string): boolean {
    const parsed = parseScannedCode(codigo);
    if (parsed.kind === "desconhecido") {
      setErro("O QR Code não é um Pix válido nem um boleto reconhecido. Tente novamente.");
      return false;
    }
    setErro(null);
    stopRef.current?.();
    onDetected(parsed);
    onOpenChange(false);
    return true;
  }

  useEffect(() => {
    if (!open) return;
    let cancelado = false;

    (async () => {
      try {
        setErro(null);
        setLendo(true);
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current ?? undefined,
          (result) => {
            if (result && !cancelado) {
              if (processar(result.getText())) cancelado = true;
            }
          },
        );
        stopRef.current = () => controls.stop();
        if (cancelado) controls.stop();
      } catch {
        setErro("Não foi possível acessar a câmera. Cole o código abaixo.");
      } finally {
        setLendo(false);
      }
    })();

    return () => {
      cancelado = true;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear boleto ou Pix</DialogTitle>
          <DialogDescription>
            Aponte a câmera para o QR Code Pix ou código de barras do boleto.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border bg-muted">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        </div>

        {erro && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <X className="mt-0.5 size-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="codigo-manual" className="flex items-center gap-2">
            <ClipboardPaste className="size-4" /> Código Pix ou linha digitável
          </Label>
          <Input
            id="codigo-manual"
            inputMode="text"
            placeholder="00190.00009 01234.567890 ..."
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
        </div>

        <Button
          className="w-full gap-2"
          disabled={manual.trim().length < 10 || lendo}
          onClick={() => {
            if (processar(manual)) setManual("");
          }}
        >
          {erro ? <RotateCcw className="size-4" /> : <Camera className="size-4" />}
          Interpretar código
        </Button>
      </DialogContent>
    </Dialog>
  );
}
