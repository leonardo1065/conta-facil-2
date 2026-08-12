import { useEffect, useRef, useState } from "react";
import { Camera, ClipboardPaste, X } from "lucide-react";
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

  useEffect(() => {
    if (!open) return;
    let cancelado = false;

    (async () => {
      try {
        setErro(null);
        setLendo(true);
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current ?? undefined,
          (result) => {
            if (result && !cancelado) {
              cancelado = true;
              stopRef.current?.();
              onDetected(parseScannedCode(result.getText()));
              onOpenChange(false);
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
  }, [open, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear boleto ou Pix</DialogTitle>
          <DialogDescription>
            Aponte a câmera para o código de barras ou QR Code, ou cole a linha digitável.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border bg-muted">
          {erro ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <X className="size-5 text-destructive" />
              {erro}
            </div>
          ) : (
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="codigo-manual" className="flex items-center gap-2">
            <ClipboardPaste className="size-4" /> Linha digitável / payload Pix
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
            onDetected(parseScannedCode(manual));
            setManual("");
            onOpenChange(false);
          }}
        >
          <Camera className="size-4" /> Usar código
        </Button>
      </DialogContent>
    </Dialog>
  );
}
