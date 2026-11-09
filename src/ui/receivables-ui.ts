/** Componentes React del módulo de cartera; se compilan con el mismo esbuild del panel. */
export const receivablesUi = String.raw`
const receivableTypes={33:'Factura',34:'Factura exenta',39:'Boleta',41:'Boleta exenta',56:'Nota de débito',61:'Nota de crédito'};
function FinanceDialog({title,onClose,busy,children}) {
  const ref=useRef(null), label=React.useId();
  useEffect(()=>{ref.current.showModal();return()=>{if(ref.current?.open)ref.current.close()}},[]);
  return <dialog ref={ref} aria-labelledby={label} onCancel={e=>{e.preventDefault();if(!busy)onClose()}} className="finance-dialog">
    <div className="dialog-title"><h3 id={label}>{title}</h3><button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar ventana">Cerrar</button></div>{children}
  </dialog>;
}
function FinanceFeedback({message}) {return message?.error?<p role="alert" className="message error">{message.text}</p>:null}
function useOperationKey(){const value=useRef(null);return body=>{const json=JSON.stringify(body);if(value.current?.json!==json)value.current={json,key:crypto.randomUUID()};return value.current.key}}
function ReceiptForm({row,api,act,busy,message,onClose}) {
  const key=useOperationKey();
  return <FinanceDialog title="Registrar cobro recibido" {...{onClose,busy}}><p>{row.customerName} · Documento {row.folio}. Saldo: {clp(row.balance)} CLP.</p>
    <p>Esta acción registra un abono ya recibido y su asiento contable. No realiza transferencias ni cargos.</p><FinanceFeedback message={message}/>
    <form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const body={date:f.get('date'),amount:f.get('amount'),method:f.get('method'),reference:f.get('reference')};if(await act(()=>api('receivables/'+row.id+'/receipts','POST',body,key(body)),'Cobro registrado y contabilizado.'))onClose()}}>
      <fieldset disabled={busy}><legend>Datos del cobro</legend><div className="row"><label>Fecha<input name="date" type="date" required defaultValue={today()}/></label><label>Monto CLP<input name="amount" inputMode="numeric" pattern="[0-9]+" maxLength="18" required defaultValue={row.balance}/></label></div>
      <label>Medio de pago<select name="method"><option value="TRANSFERENCIA">Transferencia recibida</option><option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option><option value="OTRO">Otro</option></select></label>
      <label>Referencia o comprobante<input name="reference" required maxLength="100"/></label><p><small>Se utiliza la cuenta contable Caja y Bancos del plan actual. La conciliación de cartolas se incorporará en el módulo Bancos.</small></p></fieldset>
      <button className="primary" disabled={busy}>Registrar cobro</button></form></FinanceDialog>;
}
function CreditForm({row,api,act,busy,message,onClose}) {
  const credit=BigInt(row.amount)<0, key=useOperationKey();
  const [options,O]=useState([]),[cursor,C]=useState(null),[selected,S]=useState(''),[amount,A]=useState(''),[loading,L]=useState(true),[error,E]=useState('');
  const path='receivables?'+new URLSearchParams({asOf:today(),customerId:row.customerId,kind:credit?'debt':'credit'});
  useEffect(()=>{let active=true;api(path).then(r=>{if(active){O(r.items);C(r.nextCursor)}}).catch(e=>active&&E(e.message)).finally(()=>active&&L(false));return()=>{active=false}},[row.id]);
  function choose(id){S(id);const other=options.find(d=>d.id===id);if(other){const a=BigInt(row.balance)<0?-BigInt(row.balance):BigInt(row.balance),b=BigInt(other.balance)<0?-BigInt(other.balance):BigInt(other.balance);A(String(a<b?a:b))}}
  return <FinanceDialog title="Aplicar nota de crédito" {...{onClose,busy}}><p>{row.customerName} · Documento {row.folio}.</p><p>La aplicación compensa dos saldos del mismo cliente. No vuelve a contabilizar la nota ni modifica sus referencias tributarias.</p>
    <FinanceFeedback message={message}/>{error&&<p role="alert" className="message error">{error}</p>}{loading&&<p role="status">Cargando documentos disponibles…</p>}
    <form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const body={creditId:credit?row.id:selected,invoiceId:credit?selected:row.id,amount,date:f.get('date')};if(await act(()=>api('credit-allocations','POST',body,key(body)),'Crédito aplicado a la deuda.'))onClose()}}>
      <fieldset disabled={busy||loading}><legend>Compensación de saldos</legend><label>{credit?'Deuda a compensar':'Nota de crédito disponible'}<select required value={selected} onChange={e=>choose(e.target.value)}><option value="">Selecciona un documento</option>{options.map(d=><option key={d.id} value={d.id}>{receivableTypes[d.documentType]} · {d.folio} · saldo {clp(d.balance)} CLP</option>)}</select></label>
      {!loading&&!options.length&&<p>No hay documentos con saldo disponible para este cliente.</p>}
      {cursor&&<button type="button" disabled={loading||busy} onClick={async()=>{L(true);try{const r=await api(path+'&cursor='+cursor);O(v=>[...v,...r.items]);C(r.nextCursor)}catch(e){E(e.message)}finally{L(false)}}}>Cargar más documentos</button>}
      <div className="row"><label>Monto CLP<input required inputMode="numeric" pattern="[0-9]+" maxLength="18" value={amount} onChange={e=>A(e.target.value)}/></label><label>Fecha<input name="date" type="date" required defaultValue={today()}/></label></div></fieldset>
      <button className="primary" disabled={busy||loading||!selected}>Aplicar crédito</button></form></FinanceDialog>;
}
function SettlementReverseForm({kind,record,api,act,busy,message,onClose}) {
  const key=useOperationKey(), receipt=kind==='receipt';
  return <FinanceDialog title={receipt?'Revertir registro de cobro':'Revertir aplicación de crédito'} {...{onClose,busy}}>
    <p>Monto original: {clp(record.amount)} CLP.</p><p>{receipt?'Se conservará el cobro original y se generará un asiento inverso. Esto no devuelve dinero al cliente.':'Se restituirán los saldos de la nota de crédito y de la deuda. No se genera otro asiento.'}</p><FinanceFeedback message={message}/>
    <form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget),body={date:f.get('date'),reason:f.get('reason')};const path=(receipt?'receipts/':'credit-allocations/')+record.id+'/reverse';if(await act(()=>api(path,'POST',body,key(body)),'Reversión registrada con su historial.'))onClose()}}>
      <fieldset disabled={busy}><legend>Motivo de la corrección</legend><label>Fecha<input name="date" type="date" required defaultValue={today()}/></label><label>Motivo<input name="reason" required minLength="3" maxLength="200"/></label><label className="checkbox-label"><input type="checkbox" required/>Revisé el movimiento que voy a revertir.</label></fieldset><button className="primary" disabled={busy}>Confirmar reversión</button>
    </form></FinanceDialog>;
}
function ReceivableHistory({row,api,can,busy,onClose,onReverse}) {
  const[data,D]=useState(null),[error,E]=useState('');
  useEffect(()=>{let active=true;api('receivables/'+row.id).then(r=>active&&D(r)).catch(e=>active&&E(e.message));return()=>{active=false}},[row.id]);
  const methods={TRANSFERENCIA:'Transferencia',EFECTIVO:'Efectivo',TARJETA:'Tarjeta',OTRO:'Otro'};
  return <FinanceDialog title={'Movimientos del documento '+row.folio} {...{onClose,busy}}><p>{row.customerName}</p>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Cargando movimientos…</p>}
    {data&&<><p>Importe: {clp(data.amount)} CLP · Saldo actual: {clp(data.balance)} CLP</p>{data.legacyPayments&&<p className="message">Hay pagos del módulo anterior que requieren conciliación antes de registrar nuevos movimientos.</p>}
    <h4>Cobros recibidos</h4><div className="scroll"><table><thead><tr><th>Fecha</th><th className="money">Monto CLP</th><th>Medio y referencia</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{data.receipts.map(r=><tr key={r.id}><td>{r.date.slice(0,10)}</td><td className="money">{clp(r.amount)}</td><td>{methods[r.method]} · {r.reference}</td><td>{r.reversal?'Revertido el '+r.reversal.date.slice(0,10):'Registrado'}</td><td>{!r.reversal&&can('reverseCollection')&&<button disabled={busy} onClick={()=>onReverse('receipt',r)}>Revertir registro</button>}</td></tr>)}</tbody></table>{!data.receipts.length&&<p>No hay cobros registrados en este módulo.</p>}</div>
    <h4>Aplicaciones de crédito</h4><div className="scroll"><table><thead><tr><th>Fecha</th><th className="money">Monto CLP</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{data.allocations.map(a=><tr key={a.id}><td>{a.date.slice(0,10)}</td><td className="money">{clp(a.amount)}</td><td>{a.reversal?'Revertida el '+a.reversal.date.slice(0,10):'Aplicada'}</td><td>{!a.reversal&&can('settle')&&<button disabled={busy} onClick={()=>onReverse('allocation',a)}>Revertir aplicación</button>}</td></tr>)}</tbody></table>{!data.allocations.length&&<p>No hay aplicaciones de crédito.</p>}</div></>}
  </FinanceDialog>;
}
function ReceivablesView({api,can,act,busy,message,data,query,onQuery,onNext}) {
  const[modal,M]=useState(null),[draft,F]=useState(query);
  const type=receivableTypes, currentView=query.asOf===today();
  const amount=value=>data?clp(value):'—';
  return <><p>Documentos centralizados en el libro contable. Los pagos anteriores sin conciliar se señalan para revisión.</p>
    <form className="toolbar" onSubmit={e=>{e.preventDefault();onQuery(draft)}}><label>Saldo al día<input type="date" required disabled={busy} value={draft.asOf} onChange={e=>F({...draft,asOf:e.target.value})}/></label><label>Cliente, RUT o folio<input maxLength="100" value={draft.search} disabled={busy} onChange={e=>F({...draft,search:e.target.value})}/></label><label>Documentos<select value={draft.kind} disabled={busy} onChange={e=>F({...draft,kind:e.target.value})}><option value="all">Todos</option><option value="debt">Deudas pendientes</option><option value="credit">Créditos disponibles</option></select></label><button disabled={busy}>Consultar cartera</button></form>
    <div className="row"><div className="card"><small>Deuda pendiente · CLP</small><div className="amount">{amount(data?.summary.pending)}</div></div><div className="card"><small>Créditos sin aplicar · CLP</small><div className="amount">{amount(data?.summary.credits)}</div></div><div className="card"><small>Saldo neto · CLP</small><div className="amount">{amount(data?.summary.net)}</div></div></div>
    {!currentView&&<p className="message">Consulta histórica: consulta los saldos de hoy para registrar cobros o aplicar créditos.</p>}<p><small>Importes según los filtros y la fecha consultada. Un saldo neto negativo corresponde a crédito a favor del cliente.</small></p>
    {data?.summary.reviewCount>0&&<p className="message">{data.summary.reviewCount} documento(s) tienen pagos anteriores por conciliar. Sus saldos requieren revisión.</p>}
    {data?.reconciliation&&data.reconciliation.difference!=='0'&&<p role="alert" className="message error">La cartera difiere del saldo de Clientes del libro en {clp(data.reconciliation.difference)} CLP. Revisa asientos manuales o saldos de apertura sin documento asociado.</p>}
    <div className="card scroll"><table><caption>Antigüedad de la deuda pendiente · CLP</caption><thead><tr><th>Por vencer o vence hoy</th><th>1–30 días</th><th>31–60 días</th><th>61–90 días</th><th>Más de 90 días</th><th>Sin vencimiento</th></tr></thead><tbody><tr>{['notDue','overdue30','overdue60','overdue90','overdueMore','withoutDueDate'].map(k=><td className="money" key={k}>{amount(data?.summary[k])}</td>)}</tr></tbody></table></div>
    <div className="card scroll"><table><caption>Documentos · saldos al {data?.asOf||query.asOf}</caption><thead><tr><th>Cliente</th><th>Documento</th><th>Fecha / vencimiento</th><th className="money">Importe CLP</th><th className="money">Saldo CLP</th><th>Acciones</th></tr></thead><tbody>{data?.items.map(r=><tr key={r.id}><td>{r.customerName}<br/><small>{r.customerRut}</small></td><td>{type[r.documentType]} · {r.folio}</td><td>{r.date.slice(0,10)}<br/><small>{r.dueDate?r.dueDate.slice(0,10):'Sin vencimiento informado'}</small></td><td className="money">{clp(r.amount)}</td><td className="money">{clp(r.balance)}</td><td><div className="table-actions"><button disabled={busy} onClick={()=>M({kind:'history',row:r})}>Ver movimientos</button>{r.legacyPayments?<span>Revisar pagos anteriores</span>:<>{currentView&&BigInt(r.amount)>0&&BigInt(r.balance)>0&&can('collect')&&!['ANULADO','RECHAZADO'].includes(r.documentStatus)&&<button disabled={busy} onClick={()=>M({kind:'receipt',row:r})}>Registrar cobro</button>}{currentView&&BigInt(r.balance)!==0n&&can('settle')&&<button disabled={busy} onClick={()=>M({kind:'credit',row:r})}>Aplicar crédito</button>}</>}</div></td></tr>)}</tbody></table>{data&&!data.items.length&&<p>No hay documentos que coincidan con la consulta.</p>}{data?.nextCursor&&<button disabled={busy} onClick={onNext}>Ver más documentos</button>}</div>
    {modal?.kind==='receipt'&&<ReceiptForm key={modal.row.id} {...{api,act,busy,message}} row={modal.row} onClose={()=>M(null)}/>}
    {modal?.kind==='credit'&&<CreditForm key={modal.row.id} {...{api,act,busy,message}} row={modal.row} onClose={()=>M(null)}/>}
    {modal?.kind==='history'&&<ReceivableHistory {...{api,can,busy}} row={modal.row} onClose={()=>M(null)} onReverse={(kind,record)=>M({kind:'reverse',operation:kind,record})}/>}
    {modal?.kind==='reverse'&&<SettlementReverseForm {...{api,act,busy,message}} kind={modal.operation} record={modal.record} onClose={()=>M(null)}/>}
  </>;
}
function CustomerForm({customer,api,act,busy,message,onClose}) {
  return <FinanceDialog title={customer?'Editar cliente':'Crear cliente'} {...{onClose,busy}}><FinanceFeedback message={message}/><form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget),body={razonSocial:f.get('razonSocial'),giro:f.get('giro'),direccion:f.get('direccion'),comuna:f.get('comuna'),ciudad:f.get('ciudad'),taxpayerType:f.get('taxpayerType'),...(f.get('correoDte')?{correoDte:f.get('correoDte')}:{}),...(f.get('contacto')?{contacto:f.get('contacto')}:{})};if(!customer)body.rut=f.get('rut');if(await act(()=>api('customers'+(customer?'/'+customer.id:''),customer?'PUT':'POST',body),'Cliente guardado en el maestro de la empresa.'))onClose()}}>
    <fieldset disabled={busy}><legend>Identificación y contacto</legend><div className="row"><label>RUT<input name="rut" required readOnly={!!customer} defaultValue={customer?.rut||''} maxLength="15"/></label><label>Razón social<input name="razonSocial" required minLength="2" maxLength="100" defaultValue={customer?.razonSocial||''}/></label></div>
    {customer&&<small>El RUT se conserva para mantener la identidad y el historial del cliente.</small>}<label>Giro<input name="giro" required minLength="2" maxLength="40" defaultValue={customer?.giro||''}/></label><label>Dirección<input name="direccion" required minLength="3" maxLength="70" defaultValue={customer?.direccion||''}/></label><div className="row"><label>Comuna<input name="comuna" required minLength="2" maxLength="20" defaultValue={customer?.comuna||''}/></label><label>Ciudad<input name="ciudad" required minLength="2" maxLength="20" defaultValue={customer?.ciudad||''}/></label></div>
    <label>Tipo de contribuyente<select name="taxpayerType" defaultValue={customer?.taxpayerType||'VAT_AFFECTED_1ST_CAT'}><option value="VAT_AFFECTED_1ST_CAT">Contribuyente de primera categoría</option><option value="END_CONSUMER">Consumidor final</option><option value="FEES_RECEIPT_ISSUER">Emisor de honorarios</option><option value="FOREIGNER">Extranjero</option></select></label><label>Contacto<input name="contacto" maxLength="80" defaultValue={customer?.contacto||''}/></label><label>Correo para documentos<input name="correoDte" type="email" maxLength="80" defaultValue={customer?.correoDte||''}/></label></fieldset><button className="primary" disabled={busy}>Guardar cliente</button>
  </form></FinanceDialog>;
}
function CustomersView({api,can,act,busy,message,data,search,onSearch,onNext}) {
  const[draft,F]=useState(search),[editing,E]=useState(undefined);
  return <><div className="toolbar"><form className="row" onSubmit={e=>{e.preventDefault();onSearch(draft)}}><label>Nombre o RUT<input value={draft} maxLength="100" disabled={busy} onChange={e=>F(e.target.value)}/></label><button disabled={busy}>Buscar clientes</button></form>{can('customers')&&<button disabled={busy} onClick={()=>E(null)}>Crear cliente</button>}</div>
    <div className="card scroll"><table><thead><tr><th>RUT</th><th>Razón social</th><th>Contacto</th><th>Comuna</th><th>Acción</th></tr></thead><tbody>{data?.items.map(c=><tr key={c.id}><td>{c.rut}</td><td>{c.razonSocial}</td><td>{c.contacto||'—'}<br/><small>{c.correoDte||''}</small></td><td>{c.comuna}</td><td>{can('customers')&&<button disabled={busy} onClick={()=>E(c)}>Editar cliente</button>}</td></tr>)}</tbody></table>{data&&!data.items.length&&<p>No hay clientes para esta búsqueda.</p>}{data?.nextCursor&&<button disabled={busy} onClick={onNext}>Ver más clientes</button>}</div>
    {editing!==undefined&&<CustomerForm {...{api,act,busy,message}} customer={editing} onClose={()=>E(undefined)}/>}
  </>;
}
`;
