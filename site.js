/**
 * Fluxo Jurídico — landing page behavior
 *
 * Responsibilities:
 * - navigation and reveal interactions;
 * - viewport lifecycle for workflow/hero animations;
 * - product tour;
 * - lead capture;
 * - billing configuration and Mercado Pago checkout return.
 *
 * Business rules such as prices and plan limits are owned by the backend.
 */
(()=>{
'use strict';
const $=(q,root=document)=>root.querySelector(q);
const $$=(q,root=document)=>[...root.querySelectorAll(q)];
const params=new URLSearchParams(location.search);

/* Attribution persisted with leads for campaign/source analysis. */
const attribution={
  utmSource:params.get('utm_source')||'',
  utmMedium:params.get('utm_medium')||'',
  utmCampaign:params.get('utm_campaign')||'',
  utmContent:params.get('utm_content')||'',
  referrer:document.referrer||''
};

/* Navigation + generic reveal-on-scroll. */
const nav=$('.nav');
addEventListener('scroll',()=>nav?.classList.toggle('scrolled',scrollY>12),{passive:true});

const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    const group=entry.target.parentElement ? $$('.reveal',entry.target.parentElement) : [];
    const index=Math.max(0,group.indexOf(entry.target));
    entry.target.style.transitionDelay=Math.min(index*55,220)+'ms';
    entry.target.classList.add('visible');
    observer.unobserve(entry.target);
  });
},{threshold:.08,rootMargin:'0px 0px -24px'}):null;
$$('.reveal').forEach(el=>observer?observer.observe(el):el.classList.add('visible'));

/* Viewport lifecycle:
   - workflow resets offscreen so it always starts at 01;
   - hero callouts pause offscreen to avoid unnecessary animation work. */
const flowSection=$('.flow-section');
if(flowSection){
  flowSection.classList.add('flow-reset');
  if('IntersectionObserver'in window){
    const flowObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.intersectionRatio>=.32){
          flowSection.classList.remove('flow-active');
          flowSection.classList.remove('flow-reset');
          void flowSection.offsetWidth;
          requestAnimationFrame(()=>flowSection.classList.add('flow-active'));
        }else if(entry.intersectionRatio<=.08){
          flowSection.classList.remove('flow-active');
          flowSection.classList.add('flow-reset');
        }
      });
    },{threshold:[0,.08,.32,.55]});
    flowObserver.observe(flowSection);
  }else{
    flowSection.classList.remove('flow-reset');
    flowSection.classList.add('flow-active');
  }
}

const heroSection=$('.hero');
if(heroSection&&'IntersectionObserver'in window){
  const heroObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>heroSection.classList.toggle('hero-active',entry.isIntersecting&&entry.intersectionRatio>.08));
  },{threshold:[0,.08,.2]});
  heroObserver.observe(heroSection);
}else{
  heroSection?.classList.add('hero-active');
}

/* FAQ: keep one answer open at a time. */
$$('.faq details').forEach(detail=>detail.addEventListener('toggle',()=>{
  if(detail.open)$$('.faq details').forEach(other=>{if(other!==detail)other.open=false});
}));

/* Product tour: static copy rendered into the interactive preview. */
const tourData={
  case:{
    kicker:'CLIENTE + CASO',
    title:'Cadastre uma vez e continue dali.',
    text:'Os dados centrais do cliente passam a alimentar processos, documentos, cálculos e financeiro sem exigir um novo começo em cada módulo.',
    items:['Cadastro central do cliente','Casos ligados ao mesmo histórico','Documentos disponíveis no contexto'],
    ui:[['Maria S. Oliveira','Benefício por incapacidade','Cadastro central'],['Documentos do caso','Procuração · RG/CPF · laudo','Tudo vinculado'],['Próximo passo','Conferir pendência documental','Em contexto']]
  },
  judicial:{
    kicker:'ADMINISTRATIVO → JUDICIAL',
    title:'O indeferimento muda a fase, não apaga o trabalho.',
    text:'A preparação judicial reaproveita o contexto administrativo e concentra a equipe no que ainda falta para protocolar.',
    items:['Origem administrativa preservada','Pendências antes do protocolo','Status de preparação visível'],
    ui:[['Origem','Requerimento administrativo','Preservado'],['Pendências','Documentos para conferência','2 itens'],['Judicial','Preparação concluída','Pronto para protocolo']]
  },
  word:{
    kicker:'MODELO WORD DO ESCRITÓRIO',
    title:'Seu documento continua sendo seu documento.',
    text:'O fluxo foi pensado para trabalhar com o modelo do próprio escritório, mapeando os dados nos locais corretos sem recriar a peça.',
    items:['Arquivo DOCX do escritório','Campos vinculados ao cliente','Conteúdo e identidade preservados'],
    ui:[['modelo-procuracao.docx','Modelo original do escritório','DOCX'],['Campos reconhecidos','Nome · CPF · endereço','Mapeados'],['Saída','Documento preenchido','Pronto para revisar']]
  },
  finance:{
    kicker:'FINANCEIRO COM PERMISSÕES',
    title:'Operação para a equipe. Análise para quem administra.',
    text:'Contratos, parcelas, pagamentos e despesas seguem ligados ao cliente, com visão gerencial reservada aos perfis autorizados.',
    items:['Pagamento parcial e quitação','Despesas vinculadas','Visão ampla por permissão'],
    ui:[['Contrato previdenciário','Honorários vinculados ao cliente','Ativo'],['Recebimento parcial','R$ 3.500,00','Registrado'],['Visão gerencial','Receitas · despesas · saldo','Acesso controlado']]
  }
};
function renderTour(key='case'){
  const data=tourData[key],stage=$('#tourStage');
  if(!data||!stage)return;
  stage.innerHTML='<div class="tour-card"><div class="tour-copy"><small>'+data.kicker+'</small><h3>'+data.title+'</h3><p>'+data.text+'</p><ul>'+data.items.map(x=>'<li>'+x+'</li>').join('')+'</ul></div><div class="tour-ui"><div class="mini-top"><span>FLUXO JURÍDICO</span><b>Fluxo conectado</b></div>'+data.ui.map((x,i)=>'<div class="mini-card"><strong>'+x[0]+'</strong><span>'+x[1]+'</span><small class="mini-badge '+(i===1?'amber':'')+'">'+x[2]+'</small></div>').join('')+'</div></div>';
  $$('[data-tour]').forEach(b=>b.classList.toggle('active',b.dataset.tour===key));
}
document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-tour]');
  if(tab)renderTour(tab.dataset.tour);
});

/* Optional lead form. Direct checkout works independently from this form. */
const form=$('#leadForm'),formStatus=$('#formStatus');
const leadPhone=form?.querySelector('[name=phone]');
function maskPhone(input){
  const d=input.value.replace(/\D/g,'').slice(0,11);
  input.value=d.length>10?'('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7):d.length>6?'('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6):d.length>2?'('+d.slice(0,2)+') '+d.slice(2):d.length?'('+d:'';
}
leadPhone?.addEventListener('input',()=>maskPhone(leadPhone));
form?.addEventListener('submit',async e=>{
  e.preventDefault();
  const button=form.querySelector('button[type=submit]'),original=button.innerHTML;
  button.disabled=true;button.textContent='Enviando…';formStatus.textContent='';
  try{
    const data={...Object.fromEntries(new FormData(form)),...attribution};
    const r=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body.error||'Não foi possível enviar sua dúvida.');
    form.reset();
    formStatus.textContent='Recebido. Vamos responder sua dúvida usando os dados informados.';
    formStatus.className='success';
  }catch(error){
    formStatus.textContent=error.message;
    formStatus.className='error';
  }finally{
    button.disabled=false;button.innerHTML=original;
  }
});

/* Billing UI defaults are only a resilience fallback.
   Live values from /api/billing-config always override them. */
let billingConfig={
  enabled:false,
  saasUrl:'',
  plans:{
    Solo:{price:99,seats:2,storageGb:5},
    Essencial:{price:197,seats:3,storageGb:15},
    Profissional:{price:297,seats:10,storageGb:25},
    Premium:{price:497,seats:20,storageGb:100}
  }
};
const checkoutDialog=$('#checkoutDialog');
const checkoutForm=$('#checkoutForm');
const checkoutStatus=$('#checkoutStatus');
const checkoutResult=$('#checkoutResult');
const brl=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(value)||0);
function safeSaasHref(){
  try{
    const url=new URL(String(billingConfig.saasUrl||''));
    return ['https:','http:'].includes(url.protocol)?url.href:'';
  }catch{
    return '';
  }
}

function applyPlanUI(config){
  const plans=config.plans||{};
  const saasBase=safeSaasHref();
  document.querySelectorAll('[data-saas-login]').forEach(link=>{
    if(!saasBase){
      link.setAttribute('href','#planos');
      return;
    }
    try{
      link.setAttribute('href',new URL('/login',saasBase).href);
    }catch{
      link.setAttribute('href','#planos');
    }
  });
  $$('[data-plan-price]').forEach(el=>{
    const p=plans[el.dataset.planPrice],price=Number(p?.price)||0;
    if(price>0)el.textContent=brl(price);
  });
  $$('[data-plan-seats]').forEach(el=>{
    const p=plans[el.dataset.planSeats];
    if(Number(p?.seats)>0)el.textContent=String(p.seats);
  });
  $$('[data-plan-storage]').forEach(el=>{
    const p=plans[el.dataset.planStorage];
    if(Number(p?.storageGb)>0)el.textContent=String(p.storageGb)+' GB';
  });
}
async function loadBillingConfig(){
  try{
    const r=await fetch('/api/billing-config',{cache:'no-store'});
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body.error||'Não foi possível carregar os planos.');
    billingConfig={...billingConfig,...body,plans:{...billingConfig.plans,...(body.plans||{})}};
    applyPlanUI(billingConfig);
    const disclaimer=$('#planDisclaimer');
    if(disclaimer&&billingConfig.enabled)disclaimer.textContent='Cobrança mensal recorrente. O pagamento é concluído no ambiente seguro do Mercado Pago e o acesso é processado após a confirmação.';
  }catch(error){
    console.warn('billing_config_unavailable',error);
    applyPlanUI(billingConfig);
  }
}

/* Hosted checkout: the browser collects identity/contact data only.
   Payment credentials are handled by Mercado Pago after redirection. */
function openCheckout(plan){
  const data=billingConfig.plans?.[plan];
  if(!data)return;
  checkoutForm?.reset();
  if(checkoutForm?.plan)checkoutForm.plan.value=plan;
  $('#checkoutPlanName').textContent=plan;
  $('#checkoutPlanPrice').textContent=brl(data.price)+'/mês';
  $('#checkoutPlanSeats').textContent=String(data.seats)+' usuário'+(Number(data.seats)===1?'':'s');
  $('#checkoutPlanStorage').textContent=String(data.storageGb)+' GB';
  checkoutStatus.textContent=billingConfig.enabled?'':'A contratação online está sendo ativada. Se esta mensagem persistir, tente novamente em instantes.';
  checkoutStatus.className=billingConfig.enabled?'':'error';
  checkoutDialog?.showModal();
}
function maskCPF(input){
  const d=input.value.replace(/\D/g,'').slice(0,11);
  input.value=d.length>9?d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9):d.length>6?d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6):d.length>3?d.slice(0,3)+'.'+d.slice(3):d;
}
checkoutForm?.cpf?.addEventListener('input',e=>maskCPF(e.target));
checkoutForm?.phone?.addEventListener('input',e=>maskPhone(e.target));

document.addEventListener('click',e=>{
  const planButton=e.target.closest('[data-checkout-plan]');
  if(planButton){
    e.preventDefault();
    openCheckout(planButton.dataset.checkoutPlan);
    return;
  }
  if(e.target.closest('[data-checkout-close]'))checkoutDialog?.close();
});
checkoutDialog?.addEventListener('click',e=>{
  if(e.target===checkoutDialog)checkoutDialog.close();
});

/* Create the internal order, then redirect to Mercado Pago. */
checkoutForm?.addEventListener('submit',async e=>{
  e.preventDefault();
  const button=checkoutForm.querySelector('button[type=submit]'),original=button.innerHTML;
  if(!billingConfig.enabled){
    checkoutStatus.textContent='O checkout ainda não está liberado para transações. Tente novamente após a ativação.';
    checkoutStatus.className='error';
    return;
  }
  button.disabled=true;button.textContent='Abrindo pagamento…';checkoutStatus.textContent='';checkoutStatus.className='';
  try{
    const payload=Object.fromEntries(new FormData(checkoutForm));
    const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body.error||'Não foi possível iniciar o pagamento.');
    sessionStorage.setItem('ed:last-order',body.orderId);
    location.href=body.checkoutUrl;
  }catch(error){
    checkoutStatus.textContent=error.message;
    checkoutStatus.className='error';
    button.disabled=false;button.innerHTML=original;
  }
});

/* Payment return: poll our order state; webhook processing is authoritative. */
function resultMessage(data){
  const status=data.status,provision=data.provisioningStatus;
  if(status==='approved'){
    if(provision==='activated'){
      return {cls:'approved',html:'<strong>Pagamento aprovado e acesso liberado.</strong> As instruções do primeiro acesso foram enviadas para o e-mail usado na contratação. Se esse e-mail já possuía uma conta, você pode entrar normalmente. <small>Não encontrou a mensagem? Na tela de acesso, use “Esqueci minha senha”.</small>'};
    }
    return {cls:'pending',html:'<strong>Pagamento aprovado.</strong> A criação segura do seu acesso está sendo concluída automaticamente. Você não precisa enviar comprovante nem solicitar liberação manual.'};
  }
  if(status==='pending'||status==='created'){
    return {cls:'pending',html:'<strong>Pagamento pendente.</strong> Aguardando a confirmação do Mercado Pago. Você não precisa enviar comprovante.'};
  }
  if(status==='rejected')return {cls:'problem',html:'<strong>Pagamento recusado.</strong> O acesso não foi liberado. Tente novamente pelo meio de pagamento disponível.'};
  if(status==='in_mediation')return {cls:'pending',html:'<strong>Pagamento em análise.</strong> A liberação fica suspensa até a definição do provedor.'};
  if(['refunded','charged_back','cancelled'].includes(status))return {cls:'problem',html:'<strong>Pagamento '+(status==='refunded'?'estornado':status==='charged_back'?'com chargeback':'cancelado')+'.</strong> O acesso associado fica bloqueado.'};
  return {cls:'pending',html:'<strong>Status do pagamento:</strong> '+String(status||'em processamento')+'.'};
}
async function showPaymentReturn(orderId){
  if(!orderId||!checkoutResult)return;
  checkoutResult.classList.remove('hidden');
  checkoutResult.className='checkout-result pending';
  checkoutResult.innerHTML='<strong>Verificando pagamento…</strong> Consultando a confirmação do Mercado Pago.';
  for(let attempt=0;attempt<10;attempt++){
    try{
      const r=await fetch('/api/payment-status?order='+encodeURIComponent(orderId),{cache:'no-store'});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||'Não foi possível consultar o pagamento.');
      const msg=resultMessage(data);
      checkoutResult.className='checkout-result '+msg.cls;
      const saasHref=safeSaasHref();
      let loginHref='';
      if(saasHref){
        try{loginHref=new URL('/login?first=1',saasHref).href}catch{}
      }
      checkoutResult.innerHTML=msg.html+(data.status==='approved'&&data.provisioningStatus==='activated'&&loginHref?'<div class="result-actions"><a href="'+loginHref+'">Fazer primeiro acesso →</a></div>':'');
      if(!['pending','created'].includes(data.status))break;
    }catch(error){
      checkoutResult.className='checkout-result problem';
      checkoutResult.textContent=error.message;
      break;
    }
    await new Promise(resolve=>setTimeout(resolve,4000));
  }
  checkoutResult.scrollIntoView({behavior:'smooth',block:'center'});
}

const checkoutReturn=params.get('checkout')==='return'?(params.get('order')||sessionStorage.getItem('ed:last-order')):'';
if(checkoutReturn){
  history.replaceState({},'',location.pathname);
}

/* Initial render. Runtime billing config is loaded before a payment-return
   message so the login destination always comes from SAAS_BASE_URL. */
renderTour();
loadBillingConfig().finally(()=>{
  if(checkoutReturn)showPaymentReturn(checkoutReturn);
});
})();