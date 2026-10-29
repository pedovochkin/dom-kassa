import { createRoot } from 'react-dom/client';
import { useState, type FormEvent } from 'react';
import Dashboard from './dashboard';
import Entry from './entry';
import { api, isAdminPage } from './api';
import './styles.css';
import './mobile.css';
import './standalone.css';
function Admin(){
 const fromLink=new URLSearchParams(location.hash.slice(1)).get('key');
 if(fromLink){sessionStorage.setItem('dom-admin-key',fromLink);history.replaceState(null,'',location.pathname);}
 const [unlocked,setUnlocked]=useState(!!sessionStorage.getItem('dom-admin-key'));
 const [key,setKey]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function unlock(e:FormEvent){e.preventDefault();setBusy(true);setError('');sessionStorage.setItem('dom-admin-key',key.trim());try{const d=await api();if(!d.canAdmin)throw Error('Неверный ключ.');setUnlocked(true);}catch(e){sessionStorage.removeItem('dom-admin-key');setError(e instanceof Error?e.message:'Не удалось войти.');}finally{setBusy(false);}}
 if(unlocked)return <Dashboard/>;
 return <div className="entry-page"><header className="entry-header"><span className="entry-logo">дом<span>.</span></span><span>Управление домом</span></header><main className="entry-main"><div className="eyebrow">ТОЛЬКО ДЛЯ АДМИНИСТРАТОРА</div><h1>Всё под контролем</h1><p className="entry-lead">Ключ открывает платежи, тарифы и расходы.</p><section className="payment-card"><form className="modal-form" onSubmit={unlock}><label>Ключ доступа<input type="password" autoComplete="current-password" value={key} onChange={e=>setKey(e.target.value)} required/></label>{error&&<p role="alert" className="negative">{error}</p>}<button className="primary-button" disabled={busy}>{busy?'Проверяем…':'Открыть управление'}</button></form></section><p className="entry-note">Вход в Google, GitHub или ChatGPT не требуется.</p></main></div>;
}
createRoot(document.getElementById('root')!).render(isAdminPage?<Admin/>:<Entry/>);
