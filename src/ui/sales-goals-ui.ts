export const salesGoalsUi = String.raw`
const goalLabels = {day:'Diaria',week:'Semanal',month:'Mensual',quarter:'Trimestral',semester:'Semestral',year:'Anual'};
function SalesGoalsView({section,company}) {
  const [session,setSession]=React.useState(undefined);
  const [tenant,setTenant]=React.useState('');
  const [view,setView]=React.useState(null);
  const [error,setError]=React.useState('');
  const [revision,reload]=React.useState(0);
  const [saving,setSaving]=React.useState(false);
  const [period,setPeriod]=React.useState('month');
  const [goalPeriod,setGoalPeriod]=React.useState('month');
  const [goalDate,setGoalDate]=React.useState(new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago'}).format(new Date()));
  const [goalView,setGoalView]=React.useState(null);
  const [goalError,setGoalError]=React.useState('');
  const [configDate,setConfigDate]=React.useState('');
  const [newCycle,setNewCycle]=React.useState({});
  const [before,setBefore]=React.useState('');
  const money=value=>value==null?'—':'$ '+new Intl.NumberFormat('es-CL').format(BigInt(value));
  const percent=value=>value==null?'—':value+'%';
  async function request(path,method='GET',body) {
    const response=await fetch('/api/v1/finance/'+path,{method,headers:{
      'x-tenant-id':tenant,...(body?{'content-type':'application/json'}:{})
    },...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json();
    if(!response.ok) throw Error(data.error||'No se pudo completar la operación.');
    return data;
  }
  function acceptSession(data) {
    setSession(data);
    setTenant(company||data.memberships[0]?.tenantId||'');
  }
  React.useEffect(()=>{request('session').then(acceptSession).catch(()=>setSession(null));},[]);
  React.useEffect(()=>{
    if(!tenant)return;
    let live=true;
    setError('');
    const path=section==='history'?'sales/goals'+(before?'?before='+before:''):'sales/goals/progress'+(section==='all'&&configDate?'?date='+configDate:'');
    request(path).then(data=>{if(live)setView({tenant,section,before,configDate,data});})
      .catch(err=>{if(live)setError(err.message);});
    return ()=>{live=false;};
  },[tenant,section,revision,before,configDate]);
  React.useEffect(()=>{
    if(!tenant||section!=='summary')return;
    let live=true;
    setGoalView(null);setGoalError('');
    request('sales/goals/comparison?'+new URLSearchParams({period:goalPeriod,date:goalDate}))
      .then(item=>{if(live)setGoalView({tenant,goalPeriod,goalDate,item});})
      .catch(err=>{if(live)setGoalError(err.message);});
    return ()=>{live=false;};
  },[tenant,section,goalPeriod,goalDate]);
  const chosenGoal=goalView?.tenant===tenant&&goalView.goalPeriod===goalPeriod&&goalView.goalDate===goalDate?goalView.item:null;
  const data=view?.tenant===tenant&&view?.section===section&&view?.before===before&&view?.configDate===configDate?view.data:null;
  const member=session?.memberships.find(m=>m.tenantId===tenant);
  async function save(event,item=data) {
    event.preventDefault();
    if(saving)return;
    const fields=new FormData(event.currentTarget);
    const body={target:fields.get('target'),responsible:fields.get('responsible'),notes:fields.get('notes'),startDate:fields.get('startDate'),endDate:fields.get('endDate')};
    setSaving(true);setError('');
    try {
      if(item.goal) await request('sales/goals/'+item.goal.id,'PATCH',{...body,version:item.goal.updatedAt});
      else await request('sales/goals','POST',{...body,period:item.period});
      reload(value=>value+1);
    } catch(err){setError(err.message);} finally{setSaving(false);}
  }
  const overview=['summary','all'].includes(section);
  const cards={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,240px),1fr))',gap:12};
  const panel={border:'1px solid #8c98a8',borderRadius:8,padding:12,minWidth:0};
  const chart=(title,series,items=data)=><section style={panel}>
    <h3>{title}</h3>
    {items.map(item=>{
      const values=series(item);
      const max=Math.max(1,...values.map(([,value])=>Math.abs(Number(value))));
      return <div key={item.period} style={{marginBottom:12}}>
        <strong>{goalLabels[item.period]}</strong>
        {values.map(([label,value])=><div key={label}>
          <span title={money(value)}>{label} · {money(value)}</span>
          {value!=null&&<meter min={-max} max={max} value={Number(value)} aria-label={goalLabels[item.period]+' '+label} style={{display:'block',width:'100%'}}/>}
        </div>)}
      </div>;
    })}
  </section>;
  const field={display:'block',margin:'8px 0'};
  const metric=(name,value)=><li><strong>{name}</strong> {value}</li>;
  return <section aria-label="Metas de ventas" style={{display:'grid',gap:12}}>
    {error&&<p role="alert">{error}</p>}
    {session===undefined&&<p role="status">Consultando sesión financiera…</p>}
    {session===null&&<p>Tu sesión actual no tiene acceso financiero. Ingresa al ERP con una cuenta habilitada para tu empresa.</p>}
    {session&&<>
      {!company&&<label style={field}>Empresa <select value={tenant} disabled={saving} onChange={e=>{setBefore('');setTenant(e.target.value);}}>
        {session.memberships.map(m=><option key={m.tenantId} value={m.tenantId}>{m.name}</option>)}
      </select></label>}
      {!tenant&&<p>No tienes empresas asignadas.</p>}

      {tenant&&!data&&!error&&<p role="status">Consultando ventas y metas…</p>}
      {data&&section==='summary'&&<>
        <label style={field}>Período de análisis <select value={period} onChange={event=>setPeriod(event.target.value)}>
          {Object.entries(goalLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></label>
        <div style={cards}>
          {chart('Evolución de ventas',item=>[['Hace 3 años',item.comparisons[3].nominal],['Hace 2 años',item.comparisons[2].nominal],['Hace 1 año',item.comparisons[1].nominal],['Actual',item.current]],data.filter(item=>item.period===period))}
          {chart('Ventas por documento',item=>[[33,'Factura afecta'],[34,'Factura exenta'],[39,'Boleta afecta'],[41,'Boleta exenta']].map(([type,label])=>{
            const doc=item.breakdown?.documents.find(d=>d.type===type);
            return [label+' · '+(doc?.count||0)+' documentos',doc?.gross||'0'];
          }),data.filter(item=>item.period===period))}
          {chart('IVA y montos exentos',item=>[['IVA de DTE aceptados',item.breakdown?.vat],['Monto exento',item.breakdown?.exempt]],data.filter(item=>item.period===period))}
          {chart('Comparación histórica e IPC',item=>[['Ciclo equivalente anterior',item.comparisons[1].nominal],['Anterior actualizado',item.comparisons[1].adjusted],['Actual',item.current],['Meta manual',item.goal?.target]],data.filter(item=>item.period===period))}
        </div>
        <h3>Metas comerciales y cumplimiento</h3>
        <div style={cards}>
          <label style={field}>Período de meta <select value={goalPeriod} onChange={event=>setGoalPeriod(event.target.value)}>
            {Object.entries({day:'Día',week:'Semana',month:'Mes',quarter:'Trimestre',semester:'Semestre',year:'Año'}).map(([key,label])=><option key={key} value={key}>{label}</option>)}
          </select></label>
          <label style={field}>Fecha dentro del ciclo de meta <input type="date" value={goalDate}
            max={new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago'}).format(new Date())}
            onChange={event=>{if(event.target.value)setGoalDate(event.target.value);}}/></label>
        </div>
        {goalError&&<p role="alert">{goalError}</p>}
        {!chosenGoal&&!goalError&&<p role="status">Consultando ciclo de meta…</p>}
        {chosenGoal&&chart('Meta manual y ventas comparables',item=>[['Meta manual',item.goal?.target],['Ventas reales',item.current],['Ciclo equivalente anterior',item.comparisons[1].nominal],['Anterior actualizado por IPC',item.comparisons[1].adjusted]],[chosenGoal])}
      </>}
      {data&&overview&&<div style={cards}>
        {(section==='summary'?(chosenGoal?[chosenGoal]:[]):data).map(item=><article key={item.period} style={{border:'1px solid #8c98a8',borderRadius:8,padding:12}}>
          <h3>Meta {goalLabels[item.period].toLowerCase()}</h3>
          <p>{item.start} a {item.end}</p>
          <ul>{metric('Objetivo',item.goal?money(item.goal.target):'Sin meta definida')}
            {metric('Venta bruta',money(item.current))}
            {metric('Cumplimiento',percent(item.completion))}
            {metric('Venta equivalente anterior',money(item.comparisons[1].nominal))}
            {metric('Variación real interanual',percent(item.comparisons[1].realGrowth))}
            {overview&&<>
              {metric('Monto pendiente',money(item.remaining))}
              {metric('Monto excedido',item.goal&&BigInt(item.current)>BigInt(item.goal.target)?money(BigInt(item.current)-BigInt(item.goal.target)):'—')}
              {metric('Días restantes',item.daysRemaining)}
              {metric('Proyección de cierre',money(item.projection))}
              {metric('Ciclo inmediato anterior',money(item.comparisons[0].nominal))}
              {metric('Histórico interanual ajustado por IPC',money(item.comparisons[1].adjusted))}
              {metric('Variación nominal interanual',percent(item.comparisons[1].nominalGrowth))}
            </>}</ul>
          {item.goal&&<progress aria-label={'Cumplimiento '+goalLabels[item.period]} max="100" value={Math.min(100,Math.max(0,Number(item.completion)))}/>}
          <small>IPC de referencia {item.referenceMonth||'sin datos'}{item.provisional?' · ajuste limitado por disponibilidad':''}.</small>
        </article>)}
      </div>}
      {data&&section==='all'&&<>
        <div style={cards}>
          {chart('Ventas acumuladas y objetivos',item=>[['Ventas actuales',item.current],['Meta manual',item.goal?.target]])}
          {chart('Evolución y comparación histórica',item=>[['Hace 3 años',item.comparisons[3].nominal],['Hace 2 años',item.comparisons[2].nominal],['Hace 1 año',item.comparisons[1].nominal],['Ciclo anterior',item.comparisons[0].nominal],['Actual',item.current]])}
          {chart('Histórico nominal y ajustado por IPC',item=>[['Nominal interanual',item.comparisons[1].nominal],['Ajustado por IPC',item.comparisons[1].adjusted]])}
        </div>
        <h3>Configurar metas</h3>
        <label style={field}>Consultar ciclos en <input type="date" value={configDate} disabled={saving} onChange={e=>{setNewCycle({});setConfigDate(e.target.value);}}/></label>
        {member?.role!=='OWNER'&&<p>Solo un propietario de esta empresa puede guardar metas.</p>}
        {member?.role==='OWNER'&&<div style={cards}>
          {data.map(item=>{
            const creating=Boolean(newCycle[item.period]);
            const goal=creating?null:item.goal;
            return <form key={tenant+':'+item.period+':'+item.start+':'+(goal?.updatedAt||'new')} style={panel} onSubmit={event=>save(event,{...item,goal})}>
            <h4>Meta {goalLabels[item.period].toLowerCase()}</h4>
            <p>{item.start} a {item.end} · CLP · referencia de comparación mostrada</p>
            {item.goal&&<button type="button" disabled={saving} onClick={()=>setNewCycle({...newCycle,[item.period]:!creating})}>{creating?'Editar ciclo consultado':'Configurar otro ciclo'}</button>}
            <label style={field}>Inicio <input name="startDate" type="date" defaultValue={creating?'':item.start} required/></label>
            <label style={field}>Término <input name="endDate" type="date" defaultValue={creating?'':item.end} required/></label>
            <p>Venta del año anterior {money(item.comparisons[1].nominal)} · Ajustada {money(item.comparisons[1].adjusted)}</p>
            <label style={field}>Monto objetivo CLP <input style={{maxWidth:'100%'}} name="target" inputMode="numeric" pattern="[1-9][0-9]{0,14}" defaultValue={goal?.target||''} required/></label>
            <label style={field}>Responsable <input style={{maxWidth:'100%'}} name="responsible" maxLength="100" defaultValue={goal?.responsible||''} required/></label>
            <label style={field}>Observaciones <textarea style={{maxWidth:'100%'}} name="notes" maxLength="1000" defaultValue={goal?.notes||''}/></label>
            <button type="submit" disabled={saving}>{goal?'Modificar meta':'Guardar meta'}</button>
          </form>;})}
        </div>}
        <details><summary>Historial de metas</summary><SalesGoalsView key={tenant+':'+revision} section="history" company={tenant}/></details>
      </>}
      {data&&section==='history'&&<>
        <div style={{overflowX:'auto'}}><table><caption>Historial de metas manuales</caption>
          <thead><tr>{['Período','Inicio','Término','Meta','Responsable','Última edición'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{data.map(g=><tr key={g.id}><td>{goalLabels[g.period]}</td><td>{g.startDate.slice(0,10)}</td><td>{g.endDate.slice(0,10)}</td><td>{money(g.target)}</td><td>{g.responsible}</td><td>{g.updatedAt.slice(0,10)}</td></tr>)}</tbody>
        </table></div>
        {!data.length&&<p>Sin metas registradas para esta selección.</p>}
        <label style={field}>Ver metas anteriores a <input type="date" value={before} onChange={e=>setBefore(e.target.value)}/></label>
      </>}
    </>}
  </section>;
}
`;
