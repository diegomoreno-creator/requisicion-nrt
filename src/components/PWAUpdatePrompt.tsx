import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";

const PWAUpdatePrompt = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      window.location.reload();
    };

    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        // If there's already a waiting worker
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdate(true);
        }

        // Listen for new updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setShowUpdate(true);
            }
          });
        });
      } catch (err) {
        console.error("SW update check failed:", err);
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    checkForUpdates();

    // Check for updates periodically (every 30 seconds)
    const interval = setInterval(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        reg?.update();
      } catch {}
    }, 30000);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      clearInterval(interval);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm w-[90vw] font-barlow animate-in slide-in-from-bottom-4">
      <RefreshCw className="w-5 h-5 shrink-0" />
      <span className="text-sm font-medium flex-1">Nueva versión disponible</span>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleUpdate}
        className="shrink-0"
      >
        Actualizar
      </Button>
      <button onClick={() => setShowUpdate(false)} className="shrink-0 opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default PWAUpdatePrompt;
