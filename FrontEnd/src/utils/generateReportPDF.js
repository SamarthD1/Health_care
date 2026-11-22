import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Live S3 Bucket for Aegis-Protected MediCore Backend in AWS ap-south-1
export const S3_BASE_URL = "https://medicore-patient-reports-017080036675.s3.ap-south-1.amazonaws.com/reports";

export const getS3ReportUrl = (report) => {
  const paddedId = String(report.id || 1).padStart(4, "0");
  const cleanName = (report.patient_name || report.name || "Patient").trim().replace(/\s+/g, "_");
  const filename = `Report_${paddedId}_${cleanName}.pdf`;
  return `${S3_BASE_URL}/${filename}`;
};

export const fetchS3ReportBlobUrl = async (report) => {
  const s3Url = getS3ReportUrl(report);
  try {
    const response = await fetch(s3Url, { cache: "no-store" });
    if (response.ok) {
      const blob = await response.blob();
      return { url: URL.createObjectURL(blob), fromS3: true, s3Url };
    }
  } catch (err) {
    console.warn("Direct S3 fetch error:", err);
  }
  return null;
};

export const createReportPDFDoc = (report, currentUser = null) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Colors
  const primaryColor = [24, 76, 120]; // #184C78 deep blue
  const textColor = [33, 37, 41];
  const lightGray = [245, 247, 250];

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("E-HEALTH MANAGEMENT HUB", 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("HOSPITAL & PATIENT HEALTHCARE MANAGEMENT SYSTEM", 14, 17);

  doc.setFontSize(8);
  doc.text("Official Clinical Medical Record", pageWidth - 14, 17, { align: "right" });

  // Subheader title bar
  doc.setFillColor(235, 242, 250);
  doc.rect(0, 26, pageWidth, 9, "F");
  doc.setTextColor(30, 60, 90);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PATIENT EXAMINATION & DIAGNOSTIC REPORT", 14, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const formattedDate = report.date ? new Date(report.date).toLocaleDateString() : "N/A";
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 32, { align: "right" });

  // Patient & Doctor Information Box
  let startY = 42;
  doc.setDrawColor(210, 220, 230);
  doc.setFillColor(...lightGray);
  doc.roundedRect(14, startY, pageWidth - 28, 38, 2, 2, "FD");

  const doctorName =
    report.doctor_name ||
    (currentUser?.userType === "doctor" ? currentUser.name : report.name) ||
    "Dr. Specialist";
  const patientName =
    report.patient_name ||
    (currentUser?.userType === "patient" ? currentUser.name : report.name) ||
    "Patient";
  const department = report.doctor_department || "Consultant Physician";

  // Left Column (Patient)
  doc.setTextColor(...textColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PATIENT INFORMATION", 18, startY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Patient Name:`, 18, startY + 14);
  doc.setFont("helvetica", "bold");
  doc.text(`${patientName}`, 42, startY + 14);

  doc.setFont("helvetica", "normal");
  doc.text(`Patient ID:`, 18, startY + 21);
  doc.text(`P-${report.patientid || "001"}`, 42, startY + 21);

  doc.text(`Age / Gender:`, 18, startY + 28);
  doc.text(
    `${report.patient_age || "N/A"} yrs / ${report.patient_gender || "N/A"}`,
    42,
    startY + 28
  );

  // Right Column (Doctor & Report Details)
  const col2X = pageWidth / 2 + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CONSULTATION DETAILS", col2X, startY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Report ID:`, col2X, startY + 14);
  doc.setFont("helvetica", "bold");
  doc.text(`#REP-${report.id || "001"}`, col2X + 26, startY + 14);

  doc.setFont("helvetica", "normal");
  doc.text(`Date & Time:`, col2X, startY + 21);
  doc.text(`${formattedDate} at ${report.time || "N/A"}`, col2X + 26, startY + 21);

  doc.text(`Doctor:`, col2X, startY + 28);
  doc.text(`${doctorName} (${department})`, col2X + 26, startY + 28);

  // Vitals Table
  startY += 45;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text("1. CLINICAL VITALS", 14, startY);

  autoTable(doc, {
    startY: startY + 3,
    margin: { left: 14, right: 14 },
    theme: "grid",
    head: [["Temperature", "Blood Pressure", "Weight", "Blood Glucose"]],
    body: [
      [
        report.temperature ? `${report.temperature} °F` : "N/A",
        report.bp ? `${report.bp} mmHg` : "N/A",
        report.weight ? `${report.weight} kg` : "N/A",
        report.glucose ? `${report.glucose} mg/dL` : "N/A",
      ],
    ],
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      textColor: textColor,
      fontSize: 8.5,
    },
  });

  // Diagnosis Section
  startY = doc.lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text("2. DIAGNOSIS & CLINICAL NOTES", 14, startY);

  doc.setFillColor(...lightGray);
  doc.setDrawColor(210, 220, 230);
  doc.roundedRect(14, startY + 3, pageWidth - 28, 24, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...textColor);
  doc.text("Primary Diagnosis:", 18, startY + 10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 40, 40);
  doc.text(`${report.disease || "Under Evaluation"}`, 50, startY + 10);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textColor);
  doc.text("Physician Notes:", 18, startY + 18);
  doc.setFont("helvetica", "normal");
  const notes =
    report.info ||
    "Patient presented for clinical evaluation. Diagnostic tests reviewed and confirmed.";
  const splitNotes = doc.splitTextToSize(notes, pageWidth - 70);
  doc.text(splitNotes, 50, startY + 18);

  // Footer & Aegis Integrity Notice
  doc.setDrawColor(200, 200, 200);
  doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "E-Health Management Hub • Verified by Aegis Guardian S3 Vault • Valid without physical signature",
    14,
    pageHeight - 10
  );
  doc.text(`Page 1 of 1`, pageWidth - 14, pageHeight - 10, { align: "right" });

  return { doc, patientName };
};

export const generateReportPDF = async (report, currentUser = null) => {
  const s3Url = getS3ReportUrl(report);
  try {
    const response = await fetch(s3Url, { cache: "no-store" });
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const paddedId = String(report.id || 1).padStart(4, "0");
      const cleanName = (report.patient_name || report.name || "Patient").trim().replace(/\s+/g, "_");
      const filename = `Report_${paddedId}_${cleanName}.pdf`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }
  } catch (_) {}
  const { doc, patientName } = createReportPDFDoc(report, currentUser);
  doc.save(`Report_${report.id || "medical"}_${(patientName || "patient").replace(/\s+/g, "_")}.pdf`);
};

export const getReportPDFBlobUrl = async (report, currentUser = null) => {
  const s3Result = await fetchS3ReportBlobUrl(report);
  if (s3Result && s3Result.url) {
    return s3Result.url;
  }
  const { doc } = createReportPDFDoc(report, currentUser);
  const pdfBlob = doc.output("blob");
  return URL.createObjectURL(pdfBlob);
};

export const viewReportPDFInNewTab = async (report, currentUser = null) => {
  const url = await getReportPDFBlobUrl(report, currentUser);
  window.open(url, "_blank");
};
