import jsPDF from "jspdf";
import "jspdf-autotable";

interface EntregaItem {
  cantidad: number;
  descripcion: string;
  numero_serie: string;
}

interface CartaResponsivaData {
  folioOrdenCompra: string;
  fechaOrdenCompra: string | null;
  periodoSupervision: string;
  ubicacion: string;
  entregadoPorNombre: string;
  recibidoPorNombre: string;
  recibidoPorFecha: string;
  firmaUrl: string | null;
  notas: string;
  items: EntregaItem[];
}

export const generateCartaResponsivaPDF = async (data: CartaResponsivaData) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // Header - Right aligned info
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const headerLines = [
    "Asunto: Carta Responsiva de Resguardo",
    `Periodo de supervisión: ${data.periodoSupervision || "—"}`,
    data.ubicacion,
  ];
  headerLines.forEach((line, i) => {
    doc.text(line, pageWidth - margin, 20 + i * 5, { align: "right" });
  });

  // NRT Logo text (top right)
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("NRT.", pageWidth - margin, 42, { align: "right" });
  doc.setFontSize(10);
  doc.text("MÉXICO", pageWidth - margin, 47, { align: "right" });

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Entrega Recepción de Bienes", pageWidth / 2, 58, { align: "center" });

  // Body text
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const fechaOC = data.fechaOrdenCompra 
    ? new Date(data.fechaOrdenCompra).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  
  const bodyText = `Por medio del presente se hace la entrega de equipo que se describe en la siguiente orden de compra ${data.folioOrdenCompra} con fecha del día ${fechaOC}.`;
  const splitBody = doc.splitTextToSize(bodyText, pageWidth - margin * 2);
  doc.text(splitBody, margin, 68);

  // "Se entrega:" label
  doc.setFont("helvetica", "normal");
  doc.text("Se entrega:", margin, 82);

  // Items table
  const tableBody = data.items.map(item => [
    item.cantidad.toString(),
    item.descripcion,
    item.numero_serie,
  ]);

  (doc as any).autoTable({
    startY: 88,
    head: [["CANTIDAD", "DESCRIPCIÓN DEL BIEN", "No. SERIE"]],
    body: tableBody,
    theme: "grid",
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 9,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 25, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 35, halign: "center" },
    },
  });

  const tableEndY = (doc as any).lastAutoTable.finalY + 20;

  // Signature section
  const sigSectionY = Math.max(tableEndY, 170);
  const colWidth = (pageWidth - margin * 2) / 2;

  // Left - Entrega
  doc.setFontSize(9);
  doc.text("ENTREGA:", margin, sigSectionY);
  doc.text("FECHA Y FIRMA", margin, sigSectionY + 5);

  // Draw signature line
  doc.line(margin, sigSectionY + 30, margin + colWidth - 10, sigSectionY + 30);
  doc.setFont("helvetica", "bold");
  doc.text(data.entregadoPorNombre, margin, sigSectionY + 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Encargada Almacén principal", margin, sigSectionY + 41);

  // Right - Recibe
  const rightX = margin + colWidth;
  doc.setFontSize(9);
  doc.text("RECIBE:", rightX, sigSectionY);
  doc.text("NOMBRE, FECHA Y FIRMA", rightX, sigSectionY + 5);

  // Load and draw signature image if available
  if (data.firmaUrl) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = data.firmaUrl!;
      });
      doc.addImage(img, "PNG", rightX, sigSectionY + 8, 50, 20);
    } catch {
      // If image fails, just skip
    }
  }

  doc.line(rightX, sigSectionY + 30, rightX + colWidth - 10, sigSectionY + 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(data.recibidoPorNombre, rightX, sigSectionY + 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const fechaRecibido = new Date(data.recibidoPorFecha).toLocaleDateString("es-MX");
  doc.text(`Fecha: ${fechaRecibido}`, rightX, sigSectionY + 41);

  // Notes at bottom
  if (data.notas) {
    const notasY = sigSectionY + 52;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.line(margin, notasY - 2, pageWidth - margin, notasY - 2);
    const notasText = `Nota: ${data.notas}`;
    const splitNotas = doc.splitTextToSize(notasText, pageWidth - margin * 2);
    doc.text(splitNotas, margin, notasY + 3);
    doc.line(margin, notasY + 3 + splitNotas.length * 5 + 2, pageWidth - margin, notasY + 3 + splitNotas.length * 5 + 2);
  }

  doc.save(`Carta_Responsiva_${data.folioOrdenCompra}.pdf`);
};
