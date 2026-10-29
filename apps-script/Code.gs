/** Дом. Google Sheets is the source of truth. No ChatGPT services required. */
const SHEET_ID = '1s2A55qgdIXGWw8YDy9T4tkcaHQdy3CR35_Nygzjt6M8';
const ADMIN_KEY_HASH = '11e251db8dd79ba73b894c1f0b3b32e56b2c18570564d5e5819f9972ee02df9c'; // SHA-256 only; the access key is never published.
const APARTMENTS = Array.from({length:32}, function(_,i){return String(65+i);});
function output_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function hash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function admin_(key){if(typeof key!=='string'||key.length<32||key.length>200)return false;const h=hash_(key);let diff=0;for(let i=0;i<h.length;i++)diff|=h.charCodeAt(i)^ADMIN_KEY_HASH.charCodeAt(i);return diff===0;}
function literal_(s){s=String(s);return /^[=+\-@]/.test(s)?"'"+s:s;}
function month_(v){if(v instanceof Date)return Utilities.formatDate(v,'Europe/Moscow','yyyy-MM');return String(v||'').slice(0,7);}
function iso_(v){return v instanceof Date?v.toISOString():String(v||'');}
function validMonth_(v){return typeof v==='string'&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(v);}
function date_(v){return new Date(v+'-01T00:00:00+03:00');}
function cents_(n,allowZero){if(!Number.isSafeInteger(n)||n<(allowZero?0:1)||n>100000000)throw Error('Проверьте сумму: от '+(allowZero?'0':'0,01')+' до 1 000 000 ₽.');return n;}
function sheet_(ss,name){const s=ss.getSheetByName(name);if(!s)throw Error('Не найден лист «'+name+'».');return s;}
function entries_(s,kind){if(s.getLastRow()<5)return [];return s.getRange(5,1,Math.min(s.getLastRow()-4,9000),9).getValues().map(function(r,i){
 if(!r[0]||r[6])return null;
 const p=kind==='payment'?{id:String(r[0]),apartment:String(r[1]),month:month_(r[2]),amountCents:Math.round(Number(r[3])*100),createdAt:iso_(r[4])}:{id:String(r[0]),month:month_(r[1]),category:r[2]==='Зарплата'?'salary':r[2]==='Комиссия банка'?'bank':'other',title:String(r[3]),amountCents:Math.round(Number(r[4])*100),createdAt:iso_(r[5])};
 p.version=hash_(JSON.stringify(p));p._row=i+5;return p;
 }).filter(Boolean);}
function config_(ss){const s=sheet_(ss,'Настройки'),v=s.getRange('B4:B10').getValues().map(function(r){return r[0];});const fees={};
 s.getRange('D18:E49').getValues().forEach(function(r){if(APARTMENTS.includes(String(r[0]))&&Number(r[1])>0)fees[String(r[0])]=Math.round(Number(r[1])*100);});
 const c={name:String(v[6]||'Наш дом'),apartments:APARTMENTS,startMonth:month_(v[4]),openingCents:Math.round(Number(v[3]||0)*100),salaryCents:Math.round(Number(v[2]===''?40000:v[2])*100),defaultFeeCents:Math.round(Number(v[1]||1300)*100),fees:fees};
 APARTMENTS.forEach(function(a){if(!fees[a])fees[a]=a==='91'?100000:a==='87'?110000:c.defaultFeeCents;});
 if(!validMonth_(c.startMonth))throw Error('Проверьте месяц начала учёта в Настройки!B8.');
 c.version=hash_(JSON.stringify(c));return c;}
function snapshot_(ss,isAdmin){const config=config_(ss);const clean=function(p){delete p._row;return p;};
 const r=ss.getSheetByName('Напоминания');
 return {ok:true,config:config,payments:entries_(sheet_(ss,'Платежи'),'payment').map(clean).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);}),expenses:entries_(sheet_(ss,'Расходы'),'expense').map(clean).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);}),reminders:r&&r.getLastRow()>1?r.getRange(2,1,r.getLastRow()-1,4).getValues().filter(function(v){return v[0];}).map(function(v){return {id:String(v[0]),apartment:String(v[1]),month:month_(v[2]),createdAt:iso_(v[3])};}):[],sheets:{connected:true,url:ss.getUrl()},canAdmin:!!isAdmin};}
function doGet(){let lock;try{lock=LockService.getScriptLock();lock.waitLock(25000);return output_(snapshot_(SpreadsheetApp.openById(SHEET_ID),false));}catch(e){return output_({ok:false,error:e.message});}finally{if(lock&&lock.hasLock())lock.releaseLock();}}
function audit_(ss,action,before,after){let s=ss.getSheetByName('История изменений');if(!s){s=ss.insertSheet('История изменений');s.appendRow(['Время','Действие','До','После']);s.setFrozenRows(1);s.hideSheet();}s.appendRow([new Date(),action,JSON.stringify(before||null),JSON.stringify(after||null)]);}
function validated_(body,kind,config,createdAt){if(!validMonth_(body.month)||body.month<config.startMonth)throw Error('Выберите месяц не раньше начала учёта.');cents_(body.amountCents,false);
 const when=body.createdAt?new Date(body.createdAt):new Date(createdAt);if(!Number.isFinite(when.getTime()))throw Error('Проверьте дату записи.');
 if(kind==='payment'){if(!APARTMENTS.includes(body.apartment))throw Error('Выберите квартиру 65–96.');return {id:body.id,apartment:body.apartment,month:body.month,amountCents:body.amountCents,createdAt:when.toISOString()};}
 if(!['salary','bank','other'].includes(body.category)||typeof body.title!=='string'||!body.title.trim()||body.title.length>120)throw Error('Проверьте категорию и название расхода.');
 return {id:body.id,month:body.month,category:body.category,title:body.title.trim(),amountCents:body.amountCents,createdAt:when.toISOString()};}
function writeEntry_(s,row,p,kind,deleted){const category=p.category==='salary'?'Зарплата':p.category==='bank'?'Комиссия банка':'Прочее';
 const v=kind==='payment'?[p.id,p.apartment,date_(p.month),deleted?0:p.amountCents/100,new Date(p.createdAt),'Сайт GitHub',deleted?new Date():'',new Date(),deleted?p.amountCents/100:'']:[p.id,date_(p.month),category,literal_(p.title),deleted?0:p.amountCents/100,new Date(p.createdAt),deleted?new Date():'',new Date(),deleted?p.amountCents/100:''];
 s.getRange(row,1,1,9).setValues([v]);
 if(kind==='payment'){s.getRange(row,2).setNumberFormat('@');s.getRange(row,3).setNumberFormat('mmm yyyy');s.getRange(row,4).setNumberFormat('#,##0.00" ₽"');s.getRange(row,5).setNumberFormat('dd.MM.yyyy HH:mm');}
 else{s.getRange(row,2).setNumberFormat('mmm yyyy');s.getRange(row,5).setNumberFormat('#,##0.00" ₽"');s.getRange(row,6).setNumberFormat('dd.MM.yyyy HH:mm');}}
function doPost(event){let lock;try{
 const raw=event&&event.postData&&event.postData.contents;if(!raw||raw.length>24000)throw Error('Недопустимый запрос.');const b=JSON.parse(raw);
 if(b.payload)throw Error('Учёт перенесён: откройте https://pedovochkin.github.io/dom-kassa/');
 const isAdmin=admin_(b.adminKey);if(b.action!=='payment'&&!isAdmin)throw Error('Для управления нужен ключ администратора.');
 lock=LockService.getScriptLock();lock.waitLock(25000);const ss=SpreadsheetApp.openById(SHEET_ID),config=config_(ss);
 if(b.action==='read')return output_(snapshot_(ss,true));
 if(b.action==='settings'){
  if(b.expectedVersion!==config.version)throw Error('Настройки уже изменились. Обновите страницу.');
  if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80)throw Error('Укажите название дома до 80 символов.');
  if(!validMonth_(b.startMonth))throw Error('Проверьте начало учёта.');
  if(!Number.isSafeInteger(b.openingCents)||Math.abs(b.openingCents)>100000000)throw Error('Проверьте начальный остаток.');
  cents_(b.salaryCents,true);cents_(b.defaultFeeCents,false);
  if(!b.fees||APARTMENTS.some(function(a){return !Number.isSafeInteger(b.fees[a])||b.fees[a]<=0||b.fees[a]>100000000;}))throw Error('Укажите взнос для каждой квартиры.');
  if(entries_(sheet_(ss,'Платежи'),'payment').concat(entries_(sheet_(ss,'Расходы'),'expense')).some(function(p){return p.month<b.startMonth;}))throw Error('Начало учёта не может быть позже существующих операций.');
  audit_(ss,'settings',config,{name:b.name,startMonth:b.startMonth,openingCents:b.openingCents,salaryCents:b.salaryCents,fees:b.fees});
  const s=sheet_(ss,'Настройки');s.getRange('B5:B10').setValues([[b.defaultFeeCents/100],[b.salaryCents/100],[b.openingCents/100],[date_(b.startMonth)],[32],[literal_(b.name.trim())]]);s.getRange('D18:E49').setValues(APARTMENTS.map(function(a){return [a,b.fees[a]/100];}));
 }else if(b.action==='reminder'){
  if(!APARTMENTS.includes(b.apartment)||!validMonth_(b.month))throw Error('Проверьте квартиру и месяц.');
  let s=ss.getSheetByName('Напоминания');if(!s){s=ss.insertSheet('Напоминания');s.appendRow(['ID','Квартира','Месяц','Отправлено']);s.setFrozenRows(1);s.hideSheet();}s.appendRow([Utilities.getUuid(),b.apartment,date_(b.month),new Date()]);
 }else if(b.action!=='sync'){
  if(!['payment','expense','updatePayment','updateExpense','deletePayment','deleteExpense'].includes(b.action))throw Error('Неизвестная операция.');
  if(typeof b.id!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(b.id))throw Error('Некорректный ID операции.');
  const kind=/[Pp]ayment/.test(b.action)?'payment':'expense',s=sheet_(ss,kind==='payment'?'Платежи':'Расходы'),list=entries_(s,kind),existing=list.find(function(p){return p.id===b.id;});
  if(b.action.startsWith('update')||b.action.startsWith('delete')){
   if(!existing)throw Error('Запись уже удалена. Обновите журнал.');if(b.expectedVersion!==existing.version)throw Error('Запись уже изменена. Обновите журнал и повторите.');
   const deleted=b.action.startsWith('delete'),p=deleted?existing:validated_(b,kind,config,existing.createdAt);audit_(ss,b.action,existing,deleted?null:p);writeEntry_(s,existing._row,p,kind,deleted);
  }else{
   const p=validated_(isAdmin?b:Object.assign({},b,{createdAt:undefined}),kind,config,new Date().toISOString());
   if(existing){if(existing.amountCents!==p.amountCents||existing.month!==p.month||(kind==='payment'?existing.apartment!==p.apartment:existing.category!==p.category||existing.title!==p.title))throw Error('Этот запрос уже записан с другими данными. Обновите журнал.');}
   else{const all=s.getLastRow()>=5?s.getRange(5,1,s.getLastRow()-4,1).getValues():[];if(all.some(function(r){return String(r[0])===b.id;}))throw Error('Этот запрос уже был использован. Обновите журнал.');
    const row=Math.max(5,s.getLastRow()+1);if(row>9004)throw Error('Журнал заполнен. Нужно расширить архив.');if(row>s.getMaxRows())s.insertRowsAfter(s.getMaxRows(),100);writeEntry_(s,row,p,kind,false);}
  }
 }
 if(validMonth_(b.month))sheet_(ss,'Настройки').getRange('B4').setValues([[date_(b.month)]]);
 sheet_(ss,'Настройки').getRange('B11:B12').setValues([['Google Таблица · общий журнал'],[new Date()]]);SpreadsheetApp.flush();return output_(snapshot_(ss,isAdmin));
 }catch(e){return output_({ok:false,error:e&&e.message?e.message:'Не удалось сохранить. Обновите журнал перед повтором.'});}finally{if(lock&&lock.hasLock())lock.releaseLock();}}
