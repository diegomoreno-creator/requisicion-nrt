import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Megaphone, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BroadcastNotification = () => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Por favor completa el título y el mensaje");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-broadcast-notification", {
        body: {
          title: title.trim(),
          message: message.trim(),
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Notificación enviada a ${data.recipients || 0} dispositivos`);
        setTitle("");
        setMessage("");
      } else {
        throw new Error(data?.error || "Error al enviar notificación");
      }
    } catch (error: any) {
      console.error("Error sending broadcast:", error);
      toast.error(error.message || "Error al enviar la notificación");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Enviar Aviso General</CardTitle>
        </div>
        <CardDescription>
          Envía una notificación push a todos los usuarios suscritos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="broadcast-title">Título</Label>
          <Input
            id="broadcast-title"
            placeholder="Ej: Mantenimiento programado"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="broadcast-message">Mensaje</Label>
          <Textarea
            id="broadcast-message"
            placeholder="Escribe el mensaje del aviso..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground text-right">
            {message.length}/200
          </p>
        </div>
        <Button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Enviar Notificación
        </Button>
      </CardContent>
    </Card>
  );
};

export default BroadcastNotification;
