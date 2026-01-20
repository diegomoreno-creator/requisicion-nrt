import jsPDF from "jspdf";

// Function to load Barlow Black font into jsPDF
// We'll use a fallback approach - try to use the font from canvas
export const addBarlowBlackToDoc = async (doc: jsPDF): Promise<void> => {
  try {
    // Create a canvas to extract font data
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
      // Test if Barlow is loaded
      ctx.font = "900 48px Barlow";
      const testText = ctx.measureText("NRT");
      
      // If the font is loaded, we can use it via canvas rendering
      // jsPDF doesn't natively support web fonts, so we'll render via canvas
      console.log("Barlow font test width:", testText.width);
    }
  } catch (error) {
    console.log("Font loading note:", error);
  }
};

// Render NRT MÉXICO header using canvas for custom font support
export const renderNRTHeader = (
  doc: jsPDF,
  pageWidth: number,
  yPosition: number
): number => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  if (!ctx) {
    // Fallback to helvetica
    return renderFallbackHeader(doc, pageWidth, yPosition);
  }

  // Set canvas size for high quality
  const scale = 4;
  const nrtFontSize = 28;
  const mexicoFontSize = nrtFontSize * 0.75;
  
  // Measure text widths
  ctx.font = `900 ${nrtFontSize * scale}px Barlow`;
  const nrtWidth = ctx.measureText("NRT").width / scale;
  
  ctx.font = `900 ${mexicoFontSize * scale}px Barlow`;
  const mexicoWidth = ctx.measureText(" MÉXICO").width / scale;
  
  const totalWidth = nrtWidth + mexicoWidth;
  const totalHeight = nrtFontSize * 1.2;
  
  // Set canvas dimensions
  canvas.width = (totalWidth + 10) * scale;
  canvas.height = totalHeight * scale;
  
  // Clear canvas with white background
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw NRT in red
  ctx.font = `900 ${nrtFontSize * scale}px Barlow`;
  ctx.fillStyle = "#d03925";
  ctx.textBaseline = "top";
  ctx.fillText("NRT", 0, 0);
  
  // Draw MÉXICO in dark gray
  ctx.font = `900 ${mexicoFontSize * scale}px Barlow`;
  ctx.fillStyle = "#3c3c3c";
  const mexicoY = (nrtFontSize - mexicoFontSize) * scale * 0.8; // Align baseline
  ctx.fillText(" MÉXICO", nrtWidth * scale, mexicoY);
  
  // Convert canvas to image and add to PDF
  const imgData = canvas.toDataURL("image/png");
  const imgWidth = totalWidth + 10;
  const imgHeight = totalHeight;
  const xPos = (pageWidth - imgWidth) / 2;
  
  doc.addImage(imgData, "PNG", xPos, yPosition - 5, imgWidth, imgHeight);
  
  return yPosition + imgHeight + 5;
};

// Fallback header using helvetica if canvas fails
const renderFallbackHeader = (
  doc: jsPDF,
  pageWidth: number,
  yPosition: number
): number => {
  const nrtFontSize = 24;
  const mexicoFontSize = nrtFontSize * 0.75;
  
  doc.setFontSize(nrtFontSize);
  doc.setFont("helvetica", "bold");
  const nrtText = "NRT";
  const nrtWidth = doc.getTextWidth(nrtText);
  
  doc.setFontSize(mexicoFontSize);
  const mexicoText = " MÉXICO";
  const mexicoWidth = doc.getTextWidth(mexicoText);
  
  const totalWidth = nrtWidth + mexicoWidth;
  const startX = (pageWidth - totalWidth) / 2;
  
  doc.setFontSize(nrtFontSize);
  doc.setTextColor(208, 57, 37);
  doc.text(nrtText, startX, yPosition);
  
  doc.setFontSize(mexicoFontSize);
  doc.setTextColor(60, 60, 60);
  doc.text(mexicoText, startX + nrtWidth, yPosition);
  
  doc.setTextColor(0, 0, 0);
  
  return yPosition + 15;
};
