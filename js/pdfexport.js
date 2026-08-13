// ============================================================
// Relatório em PDF: um resumo visual de cada hábito (sequência
// atual e um mini-heatmap das últimas ~12 semanas), pra guardar
// ou imprimir. Usa a biblioteca jsPDF, carregada via <script> no
// index.html (window.jspdf.jsPDF).
// ============================================================

import { getHabitsOnce, getLogsOnce } from "./db.js";
import { toDateKey, addDays, startOfWeek, computeStreak } from "./calendar.js";

const PAGE_W = 595.28; // A4 em pt
const PAGE_H = 841.89;
const MARGIN = 42;

export async function exportPdf(uid){
  if(!window.jspdf){ throw new Error("jsPDF não carregou"); }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const habits = (await getHabitsOnce(uid)).filter(h => !h.archived);

  let y = MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text("Haimë — relatório de hábitos", MARGIN, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, MARGIN, y);
  y += 30;

  if(habits.length === 0){
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(12);
    doc.text("Nenhum hábito cadastrado ainda.", MARGIN, y);
  }

  for(const habit of habits){
    const logs = await getLogsOnce(uid, habit.id);
    const blockHeight = 110;
    if(y + blockHeight > PAGE_H - MARGIN){
      doc.addPage();
      y = MARGIN;
    }
    y = drawHabitBlock(doc, habit, logs, y);
  }

  doc.save(`haime-relatorio-${new Date().toISOString().slice(0,10)}.pdf`);
}

function drawHabitBlock(doc, habit, logs, y){
  const [r, g, b] = hexToRgb(habit.color);
  const startY = y;

  // quadrado colorido + nome
  doc.setFillColor(r, g, b);
  doc.roundedRect(MARGIN, y, 14, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(habit.name || "(sem nome)", MARGIN + 22, y + 11);

  // meta (objetivo + tipo)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  const goalLabel = habit.goal === "quit" ? "Abandonar" : "Construir";
  const typeLabel = habit.type === "count"
    ? (habit.target ? `meta de ${habit.target}/dia` : "várias vezes ao dia")
    : "marcação diária";
  doc.text(`${goalLabel} · ${typeLabel}`, MARGIN + 22, y + 23);

  // streak
  const streak = computeStreak(habit, logs);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(r, g, b);
  const streakLabel = streak <= 0
    ? "sem sequência no momento"
    : habit.goal === "quit"
      ? `${streak} dia${streak>1?"s":""} limpo${streak>1?"s":""}`
      : `${streak} dia${streak>1?"s":""} seguido${streak>1?"s":""}`;
  doc.text(streakLabel, PAGE_W - MARGIN - doc.getTextWidth(streakLabel), y + 11);

  y += 30;

  // mini-heatmap: 12 semanas x 7 dias
  const cell = 9, gap = 2, weeks = 12;
  const today = new Date(); today.setHours(0,0,0,0);
  const end = startOfWeek(today);
  const start = addDays(end, -(weeks-1)*7);

  for(let w=0; w<weeks; w++){
    const weekStart = addDays(start, w*7);
    for(let d=0; d<7; d++){
      const date = addDays(weekStart, d);
      const key = toDateKey(date);
      const log = logs[key];
      const x = MARGIN + w*(cell+gap);
      const cy = y + d*(cell+gap);
      if(date > today){
        doc.setFillColor(245, 245, 245);
      } else if(log && log.value > 0){
        const intensity = habit.type === "count" && habit.target ? Math.min(1, log.value/habit.target) : 1;
        doc.setFillColor(
          Math.round(255 - (255-r)*(0.35+intensity*0.65)),
          Math.round(255 - (255-g)*(0.35+intensity*0.65)),
          Math.round(255 - (255-b)*(0.35+intensity*0.65))
        );
      } else {
        doc.setFillColor(238, 238, 238);
      }
      doc.roundedRect(x, cy, cell, cell, 1.5, 1.5, "F");
    }
  }

  y += 7*(cell+gap) + 20;

  // linha divisória
  doc.setDrawColor(225, 225, 225);
  doc.line(MARGIN, y - 8, PAGE_W - MARGIN, y - 8);

  return y;
}

function hexToRgb(hex){
  const clean = (hex || "#4FA99A").replace("#", "");
  const num = parseInt(clean.length === 3
    ? clean.split("").map(c => c+c).join("")
    : clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
