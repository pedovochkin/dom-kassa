export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxpYnLRml0rDjpz2m5VMwR10BUOENUm6HzbJBhPm-vC4JTBjxl7guzvQfgFB_hnc9cYTg/exec';
export const isAdminPage = /\/admin(?:\.html)?\/?$/.test(location.pathname);
export function adminKey(){return isAdminPage ? sessionStorage.getItem('dom-admin-key') || '' : '';}
export async function api(body?: Record<string,unknown>) {
  const key=adminKey();
  const options: RequestInit={redirect:'follow',signal:AbortSignal.timeout(60000),credentials:'omit'};
  if(body||key){options.method='POST';options.headers={'Content-Type':'text/plain;charset=utf-8'};options.body=JSON.stringify({...body,action:body?.action||'read',...(key?{adminKey:key}:{})});}
  else options.cache='no-store';
  const response=await fetch(SCRIPT_URL+(options.method?'':'?t='+Date.now()),options);
  if(!response.ok) throw Error('Нет ответа от журнала. Проверьте соединение и обновите страницу.');
  const result=await response.json();
  if(!result.ok)throw Error(result.error||'Не удалось сохранить. Обновите журнал перед повтором.');
  return result;
}
