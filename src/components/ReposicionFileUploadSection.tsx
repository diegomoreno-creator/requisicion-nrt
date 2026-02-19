import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, X, FileText, Loader2, ExternalLink, Link2, Plus } from "lucide-react";

interface UploadedFile {
  id?: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
}

interface ReposicionFileUploadSectionProps {
  reposicionId: string;
  userId: string;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
}

const ReposicionFileUploadSection = ({
  reposicionId,
  userId,
  files,
  onFilesChange,
  disabled = false,
}: ReposicionFileUploadSectionProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [externalLink, setExternalLink] = useState("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    // Function to sanitize file names for storage
    const sanitizeFileName = (name: string): string => {
      return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
        .replace(/_+/g, '_'); // Collapse multiple underscores
    };

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "Archivo muy grande",
            description: `${file.name} excede el límite de 10MB`,
            variant: "destructive",
          });
          continue;
        }

        // Generate unique file path with sanitized name
        const sanitizedName = sanitizeFileName(file.name);
        const fileName = `${userId}/${reposicionId}/${Date.now()}_${sanitizedName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('reposicion_archivos')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({
            title: "Error al subir archivo",
            description: uploadError.message,
            variant: "destructive",
          });
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('reposicion_archivos')
          .getPublicUrl(fileName);

        newFiles.push({
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
        });
      }

      if (newFiles.length > 0) {
        onFilesChange([...files, ...newFiles]);
        toast({
          title: "Archivos subidos",
          description: `${newFiles.length} archivo(s) subido(s) correctamente`,
        });
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Error",
        description: "No se pudieron subir los archivos",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleRemoveFile = async (index: number) => {
    const fileToRemove = files[index];
    
    // Extract file path from URL for deletion
    try {
      const url = new URL(fileToRemove.file_url);
      const pathParts = url.pathname.split('/reposicion_archivos/');
      if (pathParts.length > 1) {
        const filePath = decodeURIComponent(pathParts[1]);
        await supabase.storage
          .from('reposicion_archivos')
          .remove([filePath]);
      }
    } catch (error) {
      console.error('Error removing file from storage:', error);
    }

    const updatedFiles = files.filter((_, i) => i !== index);
    onFilesChange(updatedFiles);
  };

  const handleAddExternalLink = () => {
    const trimmed = externalLink.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
    } catch {
      toast({
        title: "Enlace inválido",
        description: "Por favor ingresa una URL válida (ej. https://drive.google.com/...)",
        variant: "destructive",
      });
      return;
    }

    const hostname = new URL(trimmed).hostname.replace('www.', '');
    const linkName = `Enlace externo (${hostname})`;

    onFilesChange([...files, {
      file_name: linkName,
      file_url: trimmed,
      file_type: 'external_link',
      file_size: 0,
    }]);

    setExternalLink("");
    toast({
      title: "Enlace agregado",
      description: "El enlace externo se agregó correctamente",
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">
          Archivos de Referencia
          <span className="text-xs text-muted-foreground ml-2">(Comprobantes, facturas, etc.)</span>
        </Label>
      </div>

      {/* Upload button */}
      {!disabled && (
        <div className="flex items-center gap-2">
          <Input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
            id="reposicion-file-upload"
          />
          <Label
            htmlFor="reposicion-file-upload"
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors ${
              isUploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Subir archivo
              </>
            )}
          </Label>
          <span className="text-xs text-muted-foreground">
            PDF, imágenes, Word, Excel (máx. 10MB)
          </span>
        </div>
      )}

      {/* External link input */}
      {!disabled && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              ¿Archivo mayor a 10MB? Agrega un enlace externo
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="url"
              placeholder="https://drive.google.com/... o Dropbox, iCloud, etc."
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddExternalLink())}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddExternalLink}
              disabled={!externalLink.trim()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          </div>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                {file.file_type === 'external_link' ? (
                  <Link2 className="h-5 w-5 text-primary flex-shrink-0" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.file_name}</p>
                  {file.file_size && file.file_size > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.file_size)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && disabled && (
        <p className="text-sm text-muted-foreground italic">
          No hay archivos adjuntos
        </p>
      )}
    </div>
  );
};

export default ReposicionFileUploadSection;
