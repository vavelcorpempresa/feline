import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import { ClienteReceptor, DocumentoDTE, Tenant } from '@prisma/client';
import { ODOO_L10N_CL_DOCUMENT_TYPES } from './odoo-account-move.service';
import { DetalleItemSII } from '../types/sii-dte.types';
import { receptorDelDocumento } from './dte-archivos';

// ============================================================================
// REPRESENTACIÓN IMPRESA DEL DTE (PDF) CON TIMBRE ELECTRÓNICO PDF417
// El timbre codifica el nodo <TED> completo (PDF417, nivel de corrección 5), como exige el SII.
// ============================================================================

const clp = (n: number) => '$ ' + Math.round(n).toLocaleString('es-CL');

export class DtePdfService {
  /** Genera la imagen PNG del timbre PDF417 a partir del XML <TED>. */
  public static async timbrePdf417(tedXml: string): Promise<Buffer> {
    // `eclevel` y `columns` son opciones propias de PDF417 que los tipos de bwip-js no declaran
    const opciones = { bcid: 'pdf417', text: tedXml, eclevel: 5, columns: 18, scale: 2, height: 2 };
    return bwipjs.toBuffer(opciones as Parameters<typeof bwipjs.toBuffer>[0]);
  }

  public static async generar(
    doc: DocumentoDTE & { tenant: Tenant; receptor: ClienteReceptor }
  ): Promise<Buffer> {
    const tipo = ODOO_L10N_CL_DOCUMENT_TYPES.find((d) => d.code === doc.tipoDte);
    const titulo = tipo?.reportName ?? `DOCUMENTO TRIBUTARIO ELECTRÓNICO ${doc.tipoDte}`;
    const detalles = (doc.detallesJson as unknown as DetalleItemSII[]) ?? [];
    const timbre = doc.tedXml ? await DtePdfService.timbrePdf417(doc.tedXml) : null;
    const t = doc.tenant;
    const r = receptorDelDocumento(doc, doc.receptor);

    return new Promise<Buffer>((resolve, reject) => {
      const pdf = new PDFDocument({ size: 'LETTER', margin: 40 });
      const chunks: Buffer[] = [];
      pdf.on('data', (c: Buffer) => chunks.push(c));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      // Recuadro tributario (RUT, tipo y folio), obligatorio en la representación impresa
      const boxX = 372;
      pdf.lineWidth(2).strokeColor('#C00000').rect(boxX, 40, 200, 80).stroke();
      pdf.fillColor('#C00000').font('Helvetica-Bold').fontSize(12);
      pdf.text(`R.U.T.: ${t.rut}`, boxX, 52, { width: 200, align: 'center' });
      pdf.text(titulo, boxX + 8, 70, { width: 184, align: 'center' });
      pdf.text(`N° ${doc.folio}`, boxX, 100, { width: 200, align: 'center' });
      pdf.fillColor('#000').font('Helvetica').fontSize(8);
      pdf.text('S.I.I. - SANTIAGO', boxX, 126, { width: 200, align: 'center' });

      // Emisor
      pdf.font('Helvetica-Bold').fontSize(13).text(t.razonSocial, 40, 45, { width: 320 });
      pdf.font('Helvetica').fontSize(9);
      pdf.text(`Giro: ${t.giro}`, { width: 320 });
      pdf.text(`${t.direccionOrigen}, ${t.comunaOrigen}, ${t.ciudadOrigen}`, { width: 320 });

      // Receptor
      let y = 160;
      pdf.lineWidth(0.5).strokeColor('#999').rect(40, y, 532, 70).stroke();
      pdf.fontSize(9);
      const fila = (label: string, valor: string, x: number, yy: number) => {
        pdf.font('Helvetica-Bold').text(label, x, yy, { continued: true });
        pdf.font('Helvetica').text(` ${valor}`);
      };
      fila('Señor(es):', r.razonSocial, 48, y + 8);
      fila('R.U.T.:', r.rut, 400, y + 8);
      fila('Giro:', r.giro, 48, y + 22);
      fila('Fecha emisión:', doc.fechaEmision.toISOString().slice(0, 10), 400, y + 22);
      fila('Dirección:', `${r.direccion}, ${r.comuna}`, 48, y + 36);
      if (doc.fechaVenc) fila('Vencimiento:', doc.fechaVenc.toISOString().slice(0, 10), 400, y + 36);

      // Detalle
      y = 245;
      pdf.rect(40, y, 532, 16).fillColor('#EEE').fill().fillColor('#000');
      pdf.font('Helvetica-Bold').fontSize(8);
      pdf.text('Cant.', 46, y + 4).text('Descripción', 90, y + 4).text('P. Unitario', 380, y + 4, { width: 80, align: 'right' }).text('Total', 480, y + 4, { width: 86, align: 'right' });
      y += 20;
      pdf.font('Helvetica').fontSize(8);
      for (const d of detalles) {
        if (y > 600) {
          pdf.addPage();
          y = 40;
        }
        pdf.text(String(d.QtyItem ?? 1), 46, y, { width: 40 });
        pdf.text(d.NmbItem + (d.IndExe === 1 ? ' (exento)' : ''), 90, y, { width: 280 });
        pdf.text(d.PrcItem !== undefined ? clp(d.PrcItem) : '', 380, y, { width: 80, align: 'right' });
        pdf.text(clp(d.MontoItem), 480, y, { width: 86, align: 'right' });
        y += 14;
      }

      // Totales
      y = Math.max(y + 10, 470);
      const total = (label: string, valor: number, bold = false) => {
        pdf.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 9);
        pdf.text(label, 380, y, { width: 100, align: 'right' });
        pdf.text(clp(valor), 480, y, { width: 86, align: 'right' });
        y += 15;
      };
      if (doc.mntNeto > 0) total('Monto Neto', doc.mntNeto);
      if (doc.mntExento > 0) total('Monto Exento', doc.mntExento);
      if (doc.iva > 0) total(`IVA ${Number(doc.tasaIva)}%`, doc.iva);
      total('TOTAL', doc.mntTotal, true);

      // Timbre electrónico
      if (timbre) {
        const ty = Math.max(y + 20, 560);
        // Alto real de la imagen (cabecera PNG: ancho y alto en bytes 16-23)
        const altoTimbre = (230 * timbre.readUInt32BE(20)) / timbre.readUInt32BE(16);
        pdf.image(timbre, 40, ty, { width: 230 });
        pdf.font('Helvetica').fontSize(7);
        pdf.text('Timbre Electrónico SII', 40, ty + altoTimbre + 4, { width: 230, align: 'center' });
        pdf.text(`Res. ${t.nroResol} de ${t.fchResol.toISOString().slice(0, 4)} - Verifique documento: www.sii.cl`, 40, ty + altoTimbre + 14, {
          width: 230,
          align: 'center',
        });
      }

      pdf.end();
    });
  }
}
