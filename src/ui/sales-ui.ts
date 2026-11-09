export const salesUi = String.raw`
const salesPeriods = {day:'Hoy',week:'Esta semana',month:'Este mes',quarter:'Este trimestre',year:'Este año'};
function SalesView({api,tenant,page}) {
  const summary = page === 'sales-summary';
  const kind = page === 'sales-invoices' ? 'invoice' : page === 'sales-receipts' ? 'receipt' : 'all';
  const [query,setQuery] = useState({kind});
  const [result,setResult] = useState(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  const [period,setPeriod] = useState('month');
  useEffect(() => {
    let current = true;
    setResult(null); setError(''); setLoading(true);
    const path = summary ? 'sales/summary' : 'sales/documents?' + new URLSearchParams(query);
    api(path).then(data => { if(current) setResult(data); })
      .catch(err => { if(current) setError(err.message); })
      .finally(() => { if(current) setLoading(false); });
    return () => { current = false; };
  }, [query]);
  async function download(row,format) {
    setError('');
    try {
      const response = await fetch('/api/v1/finance/sales/documents/'+row.id+'/'+format, {
        headers:{'x-tenant-id':tenant}
      });
      if (!response.ok) throw Error('El documento no está disponible para descarga.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = ['DTE',row.tipoDte,row.folio].join('_')+'.'+format;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch(err) { setError(err.message); }
  }
  const money = value => value == null ? '—' : '$ '+clp(value);
  return <section aria-busy={loading}>
    {!summary&&<form className="toolbar" onSubmit={event=>{
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      setQuery({kind,...Object.fromEntries([...fields].filter(([,v])=>v))});
    }}>
      <label>Desde<input type="date" name="from"/></label><label>Hasta<input type="date" name="to"/></label>
      <label>Folio<input type="number" name="folio" min="1"/></label>
      <label>Estado SII<select name="status"><option value="">Todos</option>
        {['PENDIENTE','FIRMADO','EN_LOTE','ENVIADO','ACEPTADO','ACEPTADO_CON_REPARO','RECHAZADO','ANULADO'].map(s=><option key={s}>{s}</option>)}
      </select></label>
      <button type="submit">Filtrar</button>
    </form>}
    {error&&<p role="alert">{error}</p>}
    {loading&&<p role="status">Consultando ventas…</p>}
    {result&&summary&&<>
      <p>Montos de documentos aceptados por el SII, incluidos los aceptados con reparo. Las notas de crédito se descuentan. Cifras al {result.asOf}.</p>
      <div className="scroll"><table><caption>Venta bruta acumulada por período</caption>
        <thead><tr><th>Período</th><th>Total bruto</th></tr></thead><tbody>
          {Object.entries(salesPeriods).map(([id,label])=><tr key={id}><th scope="row">{label}</th><td>{money(result.periods[id].gross)}</td></tr>)}
        </tbody></table></div>
      <label>Detalle del período<select value={period} onChange={e=>setPeriod(e.target.value)}>
        {Object.entries(salesPeriods).map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select></label>
      <dl className="card">{Object.entries({net:'Neto',exempt:'Exento',vat:'IVA de documentos aceptados',gross:'Bruto',invoices:'Facturas aceptadas',receipts:'Boletas aceptadas',credits:'Notas de crédito aceptadas',rejected:'Documentos rechazados'}).map(([id,label])=>
        <React.Fragment key={id}><dt>{label}</dt><dd>{['net','exempt','vat','gross'].includes(id)?money(result.periods[period][id]):result.periods[period][id]}</dd></React.Fragment>
      )}</dl>
    </>}
    {result&&!summary&&<>
      {result.items.length===0?<p>No hay documentos para estos filtros.</p>:<div className="scroll"><table>
        <caption>Documentos de venta de la empresa seleccionada</caption>
        <thead><tr>{['Fecha','Folio','Tipo','Cliente','RUT','Neto','IVA','Total','Condición','Estado SII','Estado de pago','Saldo','Archivos'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{result.items.map(row=><tr key={row.id}>
          <td>{row.fechaEmision.slice(0,10)}</td><td>{row.folio}</td><td>{row.tipoDte}</td>
          <td>{row.customer?.name??'—'}</td><td>{row.customer?.rut??'—'}</td>
          <td>{money(row.mntNeto)}</td><td>{money(row.iva)}</td><td>{money(row.mntTotal)}</td>
          <td>{({1:'Contado',2:'Crédito',3:'Sin costo'})[row.paymentTerms]??'Sin dato'}</td>
          <td>{row.estado}</td><td>{row.paymentStatus}</td><td>{money(row.balance)}</td>
          <td>{['pdf','xml'].map(format=><button key={format} type="button" aria-label={'Descargar '+format.toUpperCase()+' del folio '+row.folio} onClick={()=>download(row,format)}>{format.toUpperCase()}</button>)}</td>
        </tr>)}</tbody>
      </table></div>}
      {result.nextCursor&&<button type="button" onClick={()=>setQuery({...query,cursor:result.nextCursor})}>Página siguiente</button>}
      {query.cursor&&<button type="button" onClick={()=>{const {cursor,...first}=query;setQuery(first)}}>Primera página</button>}
    </>}
  </section>;
}
`;
