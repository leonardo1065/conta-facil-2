import { useEffect, useRef, useState } from "react";
import { Camera, ClipboardPaste, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseScannedCode, resolveDynamicPix, type ParsedDocument } from "@/lib/boleto";

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

  async function processar(codigo: string): Promise<boolean> {
    const initial = parseScannedCode(codigo);
    const parsed = initial.kind === "pix" ? await resolveDynamicPix(initial) : initial;
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
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.ITF,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODABAR,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          },
          videoRef.current ?? undefined,
          (result) => {
            if (result && !cancelado) {
              void processar(result.getText()).then((accepted) => {
                if (accepted) cancelado = true;
              });
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
            Aponte para o QR Pix ou alinhe horizontalmente as 48 posições do boleto.
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-5 top-1/2 h-20 -translate-y-1/2 border-x-2 border-primary">
            <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-primary shadow-sm" />
          </div>
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-semibold text-primary-foreground drop-shadow-md">
            Alinhe todas as barras dentro da faixa
          </p>
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
            void processar(manual).then((accepted) => {
              if (accepted) setManual("");
            });
          }}
        >
          {erro ? <RotateCcw className="size-4" /> : <Camera className="size-4" />}
          Interpretar código
        </Button>
      </DialogContent>
    </Dialog>
  );
}
