import { useEffect, useRef, useState } from "react";
import { Camera, ClipboardPaste, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { invalidCodeMessage, parseScannedCode, resolveDynamicPix, type ParsedDocument } from "@/lib/boleto";

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
      setErro(invalidCodeMessage(codigo));
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
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear boleto ou Pix</DialogTitle>
          <DialogDescription>
            Aponte a câmera para o QR Code Pix ou para as barras do boleto (bancário ou concessionária).
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          {/* Faixa de leitura com linha central */}
          <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2">
            <div className="relative h-24 rounded-sm border border-primary/70 bg-primary/5">
              <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-primary shadow-[0_0_6px_rgba(0,0,0,0.5)]" />
              <div className="absolute left-0 top-1/2 h-0.5 w-3 -translate-y-1/2 bg-primary shadow-sm" />
              <div className="absolute right-0 top-1/2 h-0.5 w-3 -translate-y-1/2 bg-primary shadow-sm" />
              <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/40" />
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/40" />
            </div>
          </div>
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-semibold text-primary-foreground drop-shadow-md">
            Posicione o QR Code ou as barras dentro da área
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
          <Textarea
            id="codigo-manual"
            autoComplete="off"
            rows={4}
            placeholder="Digite ou cole os 44, 47 ou 48 números, ou o Pix copia e cola completo"
            value={manual}
            onChange={(e) => {
              setManual(e.target.value);
              if (erro) setErro(null);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey || manual.trim().length < 10) return;
              e.preventDefault();
              void processar(manual).then((accepted) => {
                if (accepted) setManual("");
              });
            }}
          />
          <p className="text-xs text-muted-foreground">
            Pontos, espaços, traços e quebras de linha são aceitos.
          </p>
        </div>

        <Button
          className="w-full gap-2"
          disabled={manual.trim().length < 10}
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
