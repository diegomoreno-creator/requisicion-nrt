import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, Loader2, X } from "lucide-react";

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    file_name: string;
    file_url: string;
    file_type?: string | null;
    file_size?: number | null;
  } | null;
}

const FilePreviewModal = ({
  open,
  onOpenChange,
  file,
}: FilePreviewModalProps) => {
  const [loading, setLoading] = useState(true);

  if (!file) return null;

  const isImage = file.file_type?.startsWith("image/") || 
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.file_name);
  const isPdf = file.file_type === "application/pdf" || 
    /\.pdf$/i.test(file.file_name);

  const canPreview = isImage || isPdf;

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <DialogTitle className="truncate text-base">
                  {file.file_name}
                </DialogTitle>
                {file.file_size && (
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.file_size)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={file.file_url} download={file.file_name}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir
                </a>
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden p-4 min-h-[400px]">
          {canPreview ? (
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {isImage ? (
                <div className="h-full flex items-center justify-center">
                  <img
                    src={file.file_url}
                    alt={file.file_name}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                    onLoad={() => setLoading(false)}
                    onError={() => setLoading(false)}
                  />
                </div>
              ) : isPdf ? (
                <iframe
                  src={`${file.file_url}#toolbar=1&navpanes=0`}
                  className="w-full h-[70vh] rounded-lg border"
                  title={file.file_name}
                  onLoad={() => setLoading(false)}
                />
              ) : null}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                Vista previa no disponible
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Este tipo de archivo no puede visualizarse directamente.
                Puedes descargarlo o abrirlo en una nueva pestaña.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <a href={file.file_url} download={file.file_name}>
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
                  </a>
                </Button>
                <Button asChild>
                  <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir en nueva pestaña
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreviewModal;
