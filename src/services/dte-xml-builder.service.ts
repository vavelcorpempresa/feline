import {
  CaratulaEnvioSII,
  CodigoTipoDTE,
  ConstruirDteInput,
} from '../types/sii-dte.types';
import {
  escapeXmlSiiText,
  formatSiiTimestamp,
  normalizeAndValidateRut,
} from '../utils/sii-normative.utils';
import { CafTedService } from './caf-ted.service';

// ============================================================================
// CONSTRUCTOR Y NORMALIZADOR DE XML (DTE / ENVIO DTE / ENVIO BOLETA)
// Respeta el orden de secuencia (<xs:sequence>) exigido por DTE_v10.xsd y EnvioDTE_v10.xsd
// ============================================================================

export class DteXmlBuilderService {
  /**
   * Determina si el TipoDTE corresponde a una Boleta Electrónica (39 o 41).
   * En el SII, las Boletas tienen diferencias específicas de nombres de tags en <Emisor>
   * y se empaquetan en <EnvioBOLETA> en lugar de <EnvioDTE>.
   */
  public static isBoleta(tipoDte: CodigoTipoDTE): boolean {
    return (
      tipoDte === CodigoTipoDTE.BoletaElectronica ||
      tipoDte === CodigoTipoDTE.BoletaNoAfectaOExenta
    );
  }

  /**
   * Valida los datos que no dependen del folio ni del CAF. Se ejecuta ANTES de asignar el folio:
   * un error de datos no debe consumir un folio (que luego habría que anular ante el SII).
   */
  public static validarAntesDeFolio(input: Omit<ConstruirDteInput, 'caf'>): void {
    const { idDoc, emisor, receptor, detalles, referencias } = input;
    const isBoleta = DteXmlBuilderService.isBoleta(idDoc.TipoDTE);
    normalizeAndValidateRut(emisor.RUTEmisor);
    normalizeAndValidateRut(receptor.RUTRecep);
    if (!detalles || detalles.length === 0) {
      throw new Error('El DTE debe contener al menos 1 ítem en <Detalle>.');
    }
    if (!isBoleta && (emisor.Acteco || []).length === 0) {
      throw new Error('Todo DTE (excepto Boletas) requiere al menos un código <Acteco> en <Emisor>.');
    }
    if (!isBoleta && (!receptor.GiroRecep || !receptor.DirRecep || !receptor.CmnaRecep)) {
      throw new Error(
        `Para TipoDTE ${idDoc.TipoDTE}, los campos GiroRecep, DirRecep y CmnaRecep son estrictamente obligatorios según DTE_v10.xsd.`
      );
    }
    if (
      (idDoc.TipoDTE === CodigoTipoDTE.NotaCreditoElectronica || idDoc.TipoDTE === CodigoTipoDTE.NotaDebitoElectronica) &&
      (!referencias || referencias.length === 0)
    ) {
      throw new Error(`El TipoDTE ${idDoc.TipoDTE} exige al menos un nodo <Referencia> según la normativa del SII.`);
    }
  }

  /**
   * Construye el nodo <Documento ID="..."> completo con su Timbre Electrónico <TED>
   * listo para ser firmado mediante XMLDSig.
   */
  public static buildDocumentoXml(input: ConstruirDteInput): {
    docId: string;
    tedXml: string;
    unsignedDteXml: string;
  } {
    const { idDoc, emisor, receptor, totales, detalles, dscRcgGlobal, referencias } = input;
    const isBoleta = DteXmlBuilderService.isBoleta(idDoc.TipoDTE);

    // Normalizar RUTs con Módulo 11
    const rutEmisorNorm = normalizeAndValidateRut(emisor.RUTEmisor);
    const rutRecepNorm = normalizeAndValidateRut(receptor.RUTRecep);

    const docId = `F${idDoc.Folio}T${idDoc.TipoDTE}`;
    const tmstFirma = input.timestampFirma || formatSiiTimestamp(new Date());

    // 1. Construir <IdDoc> respetando el orden estricto de DTE_v10.xsd
    let idDocXml = `<IdDoc>`;
    idDocXml += `<TipoDTE>${idDoc.TipoDTE}</TipoDTE>`;
    idDocXml += `<Folio>${idDoc.Folio}</Folio>`;
    idDocXml += `<FchEmis>${escapeXmlSiiText(idDoc.FchEmis)}</FchEmis>`;
    if (idDoc.IndNoRebaja) idDocXml += `<IndNoRebaja>${idDoc.IndNoRebaja}</IndNoRebaja>`;
    if (idDoc.TipoDespacho) idDocXml += `<TipoDespacho>${idDoc.TipoDespacho}</TipoDespacho>`;
    if (idDoc.IndTraslado) idDocXml += `<IndTraslado>${idDoc.IndTraslado}</IndTraslado>`;
    if (isBoleta) {
      // En Boletas (39/41), IndServicio es obligatorio (por defecto 3: Boleta de Ventas y Servicios)
      idDocXml += `<IndServicio>${idDoc.IndServicio ?? 3}</IndServicio>`;
    } else if (idDoc.IndServicio) {
      idDocXml += `<IndServicio>${idDoc.IndServicio}</IndServicio>`;
    }
    if (idDoc.MntBruto) idDocXml += `<MntBruto>${idDoc.MntBruto}</MntBruto>`;
    if (!isBoleta && idDoc.FmaPago) idDocXml += `<FmaPago>${idDoc.FmaPago}</FmaPago>`;
    if (idDoc.FchVenc) idDocXml += `<FchVenc>${escapeXmlSiiText(idDoc.FchVenc)}</FchVenc>`;
    idDocXml += `</IdDoc>`;

    // 2. Construir <Emisor> (Diferenciando tags de Factura/DTE vs Boleta según XSD del SII)
    let emisorXml = `<Emisor>`;
    emisorXml += `<RUTEmisor>${rutEmisorNorm}</RUTEmisor>`;
    if (isBoleta) {
      emisorXml += `<RznSocEmisor>${escapeXmlSiiText(emisor.RznSoc, 100)}</RznSocEmisor>`;
      emisorXml += `<GiroEmisor>${escapeXmlSiiText(emisor.GiroEmis, 80)}</GiroEmisor>`;
    } else {
      emisorXml += `<RznSoc>${escapeXmlSiiText(emisor.RznSoc, 100)}</RznSoc>`;
      emisorXml += `<GiroEmis>${escapeXmlSiiText(emisor.GiroEmis, 80)}</GiroEmis>`;
      // Hasta 4 códigos Acteco permitidos en DTE_v10.xsd
      const actecos = (emisor.Acteco || []).slice(0, 4);
      if (actecos.length === 0) {
        throw new Error('Todo DTE (excepto Boletas) requiere al menos un código <Acteco> en <Emisor>.');
      }
      for (const acteco of actecos) {
        emisorXml += `<Acteco>${acteco}</Acteco>`;
      }
    }
    if (emisor.CdgSIISucur) {
      emisorXml += `<CdgSIISucur>${escapeXmlSiiText(emisor.CdgSIISucur, 20)}</CdgSIISucur>`;
    }
    emisorXml += `<DirOrigen>${escapeXmlSiiText(emisor.DirOrigen, 70)}</DirOrigen>`;
    emisorXml += `<CmnaOrigen>${escapeXmlSiiText(emisor.CmnaOrigen, 20)}</CmnaOrigen>`;
    if (emisor.CiudadOrigen) {
      emisorXml += `<CiudadOrigen>${escapeXmlSiiText(emisor.CiudadOrigen, 20)}</CiudadOrigen>`;
    }
    emisorXml += `</Emisor>`;

    // 3. Construir <Receptor>
    let receptorXml = `<Receptor>`;
    receptorXml += `<RUTRecep>${rutRecepNorm}</RUTRecep>`;
    if (receptor.CdgIntRecep) {
      receptorXml += `<CdgIntRecep>${escapeXmlSiiText(receptor.CdgIntRecep, 20)}</CdgIntRecep>`;
    }
    receptorXml += `<RznSocRecep>${escapeXmlSiiText(receptor.RznSocRecep, 100)}</RznSocRecep>`;
    if (!isBoleta) {
      if (!receptor.GiroRecep || !receptor.DirRecep || !receptor.CmnaRecep) {
        throw new Error(
          `Para TipoDTE ${idDoc.TipoDTE}, los campos GiroRecep, DirRecep y CmnaRecep son estrictamente obligatorios según DTE_v10.xsd.`
        );
      }
      receptorXml += `<GiroRecep>${escapeXmlSiiText(receptor.GiroRecep, 40)}</GiroRecep>`;
    }
    if (receptor.Contacto) {
      receptorXml += `<Contacto>${escapeXmlSiiText(receptor.Contacto, 80)}</Contacto>`;
    }
    if (!isBoleta && receptor.CorreoRecep) {
      receptorXml += `<CorreoRecep>${escapeXmlSiiText(receptor.CorreoRecep, 80)}</CorreoRecep>`;
    }
    if (receptor.DirRecep) {
      receptorXml += `<DirRecep>${escapeXmlSiiText(receptor.DirRecep, 70)}</DirRecep>`;
    }
    if (receptor.CmnaRecep) {
      receptorXml += `<CmnaRecep>${escapeXmlSiiText(receptor.CmnaRecep, 20)}</CmnaRecep>`;
    }
    if (receptor.CiudadRecep) {
      receptorXml += `<CiudadRecep>${escapeXmlSiiText(receptor.CiudadRecep, 20)}</CiudadRecep>`;
    }
    receptorXml += `</Receptor>`;

    // 4. Construir <Totales> y validar cuadratura aritmética
    let totalesXml = `<Totales>`;
    if (totales.MntNeto !== undefined && totales.MntNeto > 0) {
      totalesXml += `<MntNeto>${Math.round(totales.MntNeto)}</MntNeto>`;
    }
    if (totales.MntExe !== undefined && totales.MntExe > 0) {
      totalesXml += `<MntExe>${Math.round(totales.MntExe)}</MntExe>`;
    }
    if (!isBoleta && totales.TasaIVA !== undefined && (totales.MntNeto ?? 0) > 0) {
      totalesXml += `<TasaIVA>${totales.TasaIVA}</TasaIVA>`;
    }
    if (totales.IVA !== undefined && totales.IVA > 0) {
      totalesXml += `<IVA>${Math.round(totales.IVA)}</IVA>`;
    }
    totalesXml += `<MntTotal>${Math.round(totales.MntTotal)}</MntTotal>`;
    totalesXml += `</Totales>`;

    const encabezadoXml = `<Encabezado>${idDocXml}${emisorXml}${receptorXml}${totalesXml}</Encabezado>`;

    // 5. Construir líneas <Detalle>
    let detallesXml = '';
    for (const item of detalles) {
      detallesXml += `<Detalle>`;
      detallesXml += `<NroLinDet>${item.NroLinDet}</NroLinDet>`;
      if (item.CdgItem) {
        detallesXml += `<CdgItem>`;
        detallesXml += `<TpoCodigo>${escapeXmlSiiText(item.CdgItem.TpoCodigo, 10)}</TpoCodigo>`;
        detallesXml += `<VlrCodigo>${escapeXmlSiiText(item.CdgItem.VlrCodigo, 35)}</VlrCodigo>`;
        detallesXml += `</CdgItem>`;
      }
      if (item.IndExe) {
        detallesXml += `<IndExe>${item.IndExe}</IndExe>`;
      }
      detallesXml += `<NmbItem>${escapeXmlSiiText(item.NmbItem, 80)}</NmbItem>`;
      if (item.DscItem) {
        detallesXml += `<DscItem>${escapeXmlSiiText(item.DscItem, 1000)}</DscItem>`;
      }
      if (item.QtyItem !== undefined) {
        detallesXml += `<QtyItem>${item.QtyItem}</QtyItem>`;
      }
      if (item.UnmdItem) {
        detallesXml += `<UnmdItem>${escapeXmlSiiText(item.UnmdItem, 4)}</UnmdItem>`;
      }
      if (item.PrcItem !== undefined) {
        detallesXml += `<PrcItem>${item.PrcItem}</PrcItem>`;
      }
      if (item.DescuentoPct !== undefined) {
        detallesXml += `<DescuentoPct>${item.DescuentoPct}</DescuentoPct>`;
      }
      if (item.DescuentoMonto !== undefined) {
        detallesXml += `<DescuentoMonto>${Math.round(item.DescuentoMonto)}</DescuentoMonto>`;
      }
      detallesXml += `<MontoItem>${Math.round(item.MontoItem)}</MontoItem>`;
      detallesXml += `</Detalle>`;
    }

    // 6. Construir <DscRcgGlobal> (Opcional)
    let dscRcgXml = '';
    if (dscRcgGlobal && dscRcgGlobal.length > 0) {
      for (const dr of dscRcgGlobal) {
        dscRcgXml += `<DscRcgGlobal>`;
        dscRcgXml += `<NroLinDR>${dr.NroLinDR}</NroLinDR>`;
        dscRcgXml += `<TpoMov>${dr.TpoMov}</TpoMov>`;
        if (dr.GlosaDR) {
          dscRcgXml += `<GlosaDR>${escapeXmlSiiText(dr.GlosaDR, 45)}</GlosaDR>`;
        }
        dscRcgXml += `<TpoValor>${dr.TpoValor}</TpoValor>`;
        dscRcgXml += `<ValorDR>${dr.ValorDR}</ValorDR>`;
        if (dr.IndExeDR) {
          dscRcgXml += `<IndExeDR>${dr.IndExeDR}</IndExeDR>`;
        }
        dscRcgXml += `</DscRcgGlobal>`;
      }
    }

    // 7. Construir <Referencia> (Obligatorio para Notas de Crédito 61 y Notas de Débito 56)
    let referenciasXml = '';
    if (
      (idDoc.TipoDTE === CodigoTipoDTE.NotaCreditoElectronica ||
        idDoc.TipoDTE === CodigoTipoDTE.NotaDebitoElectronica) &&
      (!referencias || referencias.length === 0)
    ) {
      throw new Error(
        `El TipoDTE ${idDoc.TipoDTE} exige al menos un nodo <Referencia> según la normativa del SII.`
      );
    }

    if (referencias && referencias.length > 0) {
      for (const ref of referencias) {
        referenciasXml += `<Referencia>`;
        referenciasXml += `<NroLinRef>${ref.NroLinRef}</NroLinRef>`;
        referenciasXml += `<TpoDocRef>${escapeXmlSiiText(ref.TpoDocRef, 3)}</TpoDocRef>`;
        if (ref.IndGlobal) {
          referenciasXml += `<IndGlobal>${ref.IndGlobal}</IndGlobal>`;
        }
        referenciasXml += `<FolioRef>${escapeXmlSiiText(ref.FolioRef, 18)}</FolioRef>`;
        referenciasXml += `<FchRef>${escapeXmlSiiText(ref.FchRef)}</FchRef>`;
        if (ref.CodRef) {
          referenciasXml += `<CodRef>${ref.CodRef}</CodRef>`;
        }
        if (ref.RazonRef) {
          referenciasXml += `<RazonRef>${escapeXmlSiiText(ref.RazonRef, 90)}</RazonRef>`;
        }
        referenciasXml += `</Referencia>`;
      }
    }

    // 8. Generar el Timbre Electrónico <TED version="1.0"> firmado con la llave privada del CAF
    const tedXml = CafTedService.generateTedXml({
      ...input,
      emisor: { ...emisor, RUTEmisor: rutEmisorNorm },
      receptor: { ...receptor, RUTRecep: rutRecepNorm },
      timestampFirma: tmstFirma,
    });

    // 9. Ensamblar <Documento ID="..."> y envolver en <DTE version="1.0">
    const documentoXml =
      `<Documento ID="${docId}">` +
      `${encabezadoXml}` +
      `${detallesXml}` +
      `${dscRcgXml}` +
      `${referenciasXml}` +
      `${tedXml}` +
      `<TmstFirma>${tmstFirma}</TmstFirma>` +
      `</Documento>`;

    const unsignedDteXml = `<DTE version="1.0">${documentoXml}</DTE>`;

    return {
      docId,
      tedXml,
      unsignedDteXml,
    };
  }

  /**
   * Construye el sobre <EnvioDTE version="1.0"> o <EnvioBOLETA version="1.0">
   * que agrupa la <Caratula> y los nodos <DTE version="1.0"> previamente firmados.
   */
  public static buildEnvioLoteXml(params: {
    caratula: CaratulaEnvioSII;
    signedDtesXml: string[];
    esBoleta?: boolean;
    setDocId?: string;
  }): { setDocId: string; unsignedEnvioXml: string } {
    const setDocId = params.setDocId || 'SetDoc';
    const { caratula, signedDtesXml, esBoleta = false } = params;

    if (signedDtesXml.length === 0) {
      throw new Error('El sobre de envío al SII debe contener al menos un DTE firmado.');
    }

    let subTotXml = '';
    for (const sub of caratula.SubTotDTE) {
      subTotXml += `<SubTotDTE><TpoDTE>${sub.TpoDTE}</TpoDTE><NroDTE>${sub.NroDTE}</NroDTE></SubTotDTE>`;
    }

    const caratulaXml =
      `<Caratula version="1.0">` +
      `<RutEmisor>${normalizeAndValidateRut(caratula.RutEmisor)}</RutEmisor>` +
      `<RutEnvia>${normalizeAndValidateRut(caratula.RutEnvia)}</RutEnvia>` +
      `<RutReceptor>${normalizeAndValidateRut(caratula.RutReceptor)}</RutReceptor>` +
      `<FchResol>${escapeXmlSiiText(caratula.FchResol)}</FchResol>` +
      `<NroResol>${caratula.NroResol}</NroResol>` +
      `<TmstFirmaEnv>${escapeXmlSiiText(caratula.TmstFirmaEnv)}</TmstFirmaEnv>` +
      `${subTotXml}` +
      `</Caratula>`;

    // Limpiar posibles declaraciones <?xml ...?> individuales de cada DTE antes de incrustarlos en <SetDTE>
    const dtesConcatenated = signedDtesXml
      .map((dte) => dte.replace(/<\?xml[^>]*\?>\s*/g, '').trim())
      .join('');

    const rootTag = esBoleta ? 'EnvioBOLETA' : 'EnvioDTE';
    const schemaXsd = esBoleta
      ? 'http://www.sii.cl/SiiDte EnvioBOLETA_v11.xsd'
      : 'http://www.sii.cl/SiiDte EnvioDTE_v10.xsd';

    const unsignedEnvioXml =
      `<?xml version="1.0" encoding="ISO-8859-1"?>\n` +
      `<${rootTag} xmlns="http://www.sii.cl/SiiDte" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${schemaXsd}" version="1.0">` +
      `<SetDTE ID="${setDocId}">` +
      `${caratulaXml}` +
      `${dtesConcatenated}` +
      `</SetDTE>` +
      `</${rootTag}>`;

    return {
      setDocId,
      unsignedEnvioXml,
    };
  }
}
