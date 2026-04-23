import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  open: boolean;
  onClose: () => void;
  bucket: "unsent-audio" | "unsent-images";
  path: string;
  kind: "audio" | "image";
};

export function MediaOverlay({ open, onClose, bucket, path, kind }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bucket, path]);

  const filename = path.split("/").pop() || (kind === "audio" ? "audio" : "image");

  const onDownload = async () => {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-border/60">
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-display">
            {kind === "audio" ? "Audio" : "Photo"}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onDownload} aria-label="Download">
              <Download className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="p-4 bg-background flex items-center justify-center min-h-[200px]">
          {!url && <p className="text-sm text-muted-foreground italic">Loading…</p>}
          {url && kind === "image" && (
            <img
              src={url}
              alt="entry"
              className="max-h-[80vh] w-auto object-contain"
              style={{ touchAction: "pinch-zoom" }}
            />
          )}
          {url && kind === "audio" && <audio controls src={url} className="w-full" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
