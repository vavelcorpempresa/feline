export const salesListUi = String.raw`
const salesListTitles={facturas:'Facturas emitidas',borradores:'Borradores',boletas:'Boletas emitidas',documentos:'Documentos emitidos',pagados:'Documentos pagados',pendientes:'Pendientes de pago',vencidos:'Documentos vencidos',corregidos:'Anulados o corregidos',cobranzas:'Cuentas por cobrar'};
const salesListPeriods={all:'Todo el historial',today:'Hoy',yesterday:'Ayer',week:'Esta semana',lastWeek:'Semana anterior',month:'Este mes',lastMonth:'Mes anterior',quarter:'Este trimestre',lastQuarter:'Trimestre anterior',semester:'Este semestre',lastSemester:'Semestre anterior',year:'Este año',lastYear:'Año anterior',custom:'Período personalizado'};
function salesListRange(period,today) {
  if(period==='all')return ['',''];
  const date=new Date(today);
  const day=86400000;
  const text=d=>d.toISOString().slice(0,10);
  if(period==='today')return [today,today];
  if(period==='yesterday'){const previous=text(new Date(date.getTime()-day));return [previous,previous];}
  if(period==='week'||period==='lastWeek'){
    const start=date.getTime()-day*((date.getUTCDay()+6)%7+(period==='lastWeek'?7:0));
    return [text(new Date(start)),text(new Date(start+6*day))];
  }
  const lengths={month:1,lastMonth:1,quarter:3,lastQuarter:3,semester:6,lastSemester:6,year:12,lastYear:12};
  const length=lengths[period];
  const month=Math.floor(date.getUTCMonth()/length)*length-(period.startsWith('last')?length:0);
  return [text(new Date(Date.UTC(date.getUTCFullYear(),month,1))),text(new Date(Date.UTC(date.getUTCFullYear(),month+length,0)))];
}
function SalesListPage({section,documents,company,loading,columns,formatMoney,cardStyle}) {
  const [period,setPeriod]=React.useState('all');
  const [from,setFrom]=React.useState('');
  const [to,setTo]=React.useState('');
  const [search,setSearch]=React.useState('');
  const [type,setType]=React.useState('');
  const [status,setStatus]=React.useState('');
  const [payment,setPayment]=React.useState('');
  const [min,setMin]=React.useState('');
  const [max,setMax]=React.useState('');
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago'}).format(new Date());
  const balanceView=['pendientes','vencidos','cobranzas'].includes(section);
  const dateOf=d=>String(section==='borradores'?d.createdAt||'':section==='vencidos'?d.dueDate||d.invoiceDateDue||'':d.invoiceDate||'').slice(0,10);
  const amountOf=d=>Number(balanceView?d.amountResidual:d.amountTotal)||0;
  const [start,end]=period==='custom'?[from,to]:salesListRange(period,today);
  const invalid=Boolean((start&&end&&start>end)||(min!==''&&max!==''&&Number(min)>Number(max)));
  const q=search.trim().toLowerCase();
  const filtered=invalid?[]:documents.filter(d=>{
    const date=dateOf(d);
    return (!start||date>=start)&&(!end||(date&&date<=end))
      &&(!type||String(d.documentTypeCode)===type)&&(!status||d.dteStatus===status)&&(!payment||d.paymentState===payment)
      &&(min===''||amountOf(d)>=Number(min))&&(max===''||amountOf(d)<=Number(max))
      &&[d.id,d.name,d.l10nLatamDocumentNumber,d.partnerRut,d.partnerName].some(value=>String(value||'').toLowerCase().includes(q));
  });
  const sum=filtered.reduce((total,d)=>total+amountOf(d),0);
  const counts=new Map();
  for(const d of filtered)counts.set(d.documentTypeCode,(counts.get(d.documentTypeCode)||0)+1);
  const reset=()=>{setPeriod('all');setFrom('');setTo('');setSearch('');setType('');setStatus('');setPayment('');setMin('');setMax('');};
  const dateLabel=section==='borradores'?'creación':section==='vencidos'?'vencimiento':'emisión';
  const moneyLabel=balanceView?'Saldo pendiente':section==='borradores'?'Total estimado':'Total de documentos';
  const csv=()=>{
    const safe=value=>{const text=String(value??'');return '"'+(/^[\s]*[=+@\-]|^[\t\r\n]/.test(text)?"'":"")+text.replace(/"/g,'""')+'"';};
    const rows=[['Fecha','Folio','Tipo DTE','Cliente','RUT','Neto','Exento','IVA','Total','Saldo','Estado SII','Estado de pago'],
      ...filtered.map(d=>[dateOf(d),d.l10nLatamDocumentNumber||d.id,d.documentTypeCode,d.partnerName,d.partnerRut,d.amountUntaxed,d.amountExempt,d.amountTax,d.amountTotal,d.amountResidual,d.dteStatus,d.paymentState])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='ventas-'+section+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const options=(key)=>[...new Set(documents.map(d=>d[key]).filter(Boolean))].map(value=><option key={value} value={value}>{value}</option>);
  return <antd.Card title={salesListTitles[section]} style={cardStyle}>
    <p>{company?.razonSocial} · Filtro por fecha de {dateLabel}.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end',marginBottom:16}}>
      <label>Período <select value={period} onChange={e=>setPeriod(e.target.value)}>{Object.entries(salesListPeriods).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      {period==='custom'&&<><label>Desde <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta <input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></>}
    </div>
    <antd.Row gutter={[12,12]} style={{marginBottom:16}}>
      <antd.Col xs={24} sm={12}><antd.Statistic title="Registros" value={filtered.length}/></antd.Col>
      <antd.Col xs={24} sm={12}><antd.Statistic title={moneyLabel} value={sum} formatter={formatMoney}/></antd.Col>
    </antd.Row>
    <section aria-label="Distribución por tipo documental" style={{marginBottom:16}}>
      <h3>Distribución por tipo documental</h3>
      {Array.from(counts,([code,count])=><div key={code}>
        <span title={String(count)}>DTE {code} · {count}</span>
        <antd.Progress aria-label={'DTE '+code+' '+count+' registros'} percent={Math.round(count*100/filtered.length)} showInfo={false}/>
      </div>)}
      {!counts.size&&<p>Sin registros para el período y los filtros actuales.</p>}
    </section>
    <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:16}}>
      <label>Buscar <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Folio, RUT o cliente"/></label>
      <label>Tipo <select value={type} onChange={e=>setType(e.target.value)}><option value="">Todos</option>{options('documentTypeCode')}</select></label>
      <label>Estado SII <select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos</option>{options('dteStatus')}</select></label>
      <label>Estado de pago <select value={payment} onChange={e=>setPayment(e.target.value)}><option value="">Todos</option>{options('paymentState')}</select></label>
      <label>Monto mínimo <input type="number" min="0" value={min} onChange={e=>setMin(e.target.value)}/></label>
      <label>Monto máximo <input type="number" min="0" value={max} onChange={e=>setMax(e.target.value)}/></label>
      <antd.Button onClick={reset}>Limpiar filtros</antd.Button><antd.Button disabled={!filtered.length} onClick={csv}>Exportar CSV</antd.Button>
    </div>
    {invalid&&<p role="alert">Revisa los límites del rango.</p>}
    <antd.Table rowKey="id" size="small" loading={loading} dataSource={filtered} scroll={{x:1100}} pagination={{pageSize:10,showTotal:total=>total+' registros'}}
      columns={[{title:'Fecha de '+dateLabel,key:'date',render:(_,d)=>dateOf(d)||'—',sorter:(a,b)=>dateOf(a).localeCompare(dateOf(b)),defaultSortOrder:'descend'},
        ...columns,...(balanceView?[{title:'Saldo',dataIndex:'amountResidual',render:formatMoney,sorter:(a,b)=>amountOf(a)-amountOf(b)}]:[])]}/>
  </antd.Card>;
}
`;
