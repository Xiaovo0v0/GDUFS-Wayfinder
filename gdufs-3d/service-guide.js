(function(){
 'use strict';
 var services=window.GDUFS_SERVICE||[],campus=/[?&]campus=north/.test(location.search)?'north':'south';
 function en(){return window.GDUFS_LANG&&window.GDUFS_LANG.get()==='en';}
 function t(a,b){return en()?b:a;}
 function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
 function knownPlaces(s,c){return (s[c]||[]).filter(function(p){return p.name||p.building_id;});}
 function norm(s){return String(s||'').replace(/[\s（）()·]/g,'').toLowerCase();}
 function at(place){if(!place)return[];return services.filter(function(s){return knownPlaces(s,campus).some(function(p){return p.building_id===place.ref||norm(p.name)===norm(place.label);});});}
 function hours(text,c,now){
  text=String(text||'');var parts=text.split(/[；;]/),rx=c==='north'?/北校|白云山|（北）/:/南校|大学城|（南）/;
  var selected=parts.filter(function(s){return rx.test(s);});var src=(selected.length?selected:parts).join('；');
  if(!src||/未查到|未公布|维护|按学期|预约|另行通知/.test(src))return{known:false,note:src,state:'unknown'};
  var daymap={'日':0,'天':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6},days=[],ranges=[],m;
  var re=/周([一二三四五六日天])\s*[至到—－-]\s*(?:周)?([一二三四五六日天])/g;
  while((m=re.exec(src))){var a=daymap[m[1]],b=daymap[m[2]];for(var j=0;j<7;j++){days.push((a+j)%7);if((a+j)%7===b)break;}}
  re=/周([一二三四五六日天])/g;while((m=re.exec(src)))days.push(daymap[m[1]]);
  re=/(\d{1,2})[:：](\d{2})\s*[-–—－~至到]\s*(\d{1,2})[:：](\d{2})/g;
  while((m=re.exec(src))){var st=+m[1]*60+(+m[2]),end=+m[3]*60+(+m[4]);if(st<end&&end<=1440)ranges.push([st,end]);}
  if(!ranges.length)return{known:false,note:src,state:'unknown'};
  var date=now?new Date(now):new Date();var china=new Date(date.getTime()+8*3600000),dow=china.getUTCDay(),minutes=china.getUTCHours()*60+china.getUTCMinutes();
  var today=!days.length||days.includes(dow),open=ranges.find(function(r){return today&&minutes>=r[0]&&minutes<r[1];});
  function hm(v){return String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');}
  if(open)return{known:true,state:'open',note:src,closeAt:hm(open[1])};
  ranges.sort(function(a,b){return a[0]-b[0];});
  for(var offset=0;offset<8;offset++){if(days.length&&!days.includes((dow+offset)%7))continue;var next=ranges.find(function(r){return offset>0||r[0]>minutes;});if(next)return{known:true,state:'closed',note:src,nextOpen:hm(next[0]),dayOffset:offset};}
  return{known:false,state:'unknown',note:src};
 }
 function safeLink(url){try{var u=new URL(url);return /^https?:$/.test(u.protocol)?u.href:null;}catch(e){return null;}}
 function button(label,fn,cls){var b=el('button',cls||'act',label);b.type='button';b.addEventListener('click',fn);return b;}
 function sourceLinks(s,parent){var urls=s.sources&&s.sources.length?s.sources:[s.src].filter(Boolean);urls.forEach(function(u,i){u=safeLink(u);if(u){var a=el('a','source-link',t('官方来源','Official source')+(urls.length>1?' '+(i+1):'')+' ↗');a.href=u;a.target='_blank';a.rel='noopener';parent.appendChild(a);}});}
 function render(s){
  var card=el('article','card service-card');card.dataset.sid=s.sid;var header=el('div','card-head');header.appendChild(el('b',null,s.title));card.appendChild(header);
  window.dispatchEvent(new CustomEvent('wayfinder:service-context',{detail:s.sid}));
  if(s.confidence==='low'){card.appendChild(el('p','service-notice',t('信息待核实，请查看官方来源。','Unverified. Consult the official source.')));sourceLinks(s,card);return card;}
  var here=knownPlaces(s,campus),otherCampus=campus==='north'?'south':'north',other=knownPlaces(s,otherCampus),points=here.length?here:other;
  header.appendChild(el('span','badge',here.length?t('本校可办','Available on this campus'):s.online?t('线上办理','Online'):other.length?t('需到另一校区','Other campus'):t('地点：官网未公布','Location not published')));
  card.appendChild(el('div','meta',t('部门：','Department: ')+(s.dept||t('官网未公布','Not published'))));
  points.forEach(function(p){card.appendChild(el('div','meta',t(here.length?(campus==='north'?'白云山':'大学城'):(otherCampus==='north'?'白云山':'大学城'),here.length?campus:otherCampus)+' · '+p.name+(p.room?' · '+p.room+t(' 室',' room'):'')));});
  if(other.length&&!here.length){card.appendChild(button(t('切换校区','Switch campus'),function(){var u=new URL(location.href);u.searchParams.set('campus',otherCampus);u.searchParams.set('q',s.title);location.href=u.href;},'act campus-action'));}
  var h=hours(s.hours,campus),state=t('时段：官网未公布','Hours not published');if(h.known){if(h.state==='open')state=t('常规开放 · ','Regular hours · ')+h.closeAt+t(' 结束',' closes');else state=t('常规时段外 · ','Outside regular hours · ')+(h.dayOffset===0?t('今天 ','Today '):h.dayOffset===1?t('明天 ','Tomorrow '):t('周','Day ')+['日','一','二','三','四','五','六'][(new Date(Date.now()+8*3600000).getUTCDay()+h.dayOffset)%7]+' ')+h.nextOpen;}
  card.appendChild(el('div','service-hours '+h.state,state));
  var details=el('details');details.appendChild(el('summary',null,t('办理须知','Service details')));
  details.appendChild(el('p','meta',s.hours||t('办公时段：官网未公布','Office hours not published')));
  details.appendChild(el('p','service-notice',t('按常规时段推算；节假日、寒暑假以公告为准。','Based on regular hours; holiday arrangements may differ.')));
  function list(label,values){details.appendChild(el('h3',null,label));if(!values||!values.length){details.appendChild(el('p','meta',t('官网未公布','Not published')));return;}var ul=el('ol');values.forEach(function(v){ul.appendChild(el('li',null,v));});details.appendChild(ul);}
  list(t('材料','Materials'),s.materials);list(t('流程','Steps'),s.steps);
  if(s.materials&&s.materials.length)details.appendChild(button(t('复制材料','Copy materials'),function(){var text=s.materials.join('\n');if(navigator.clipboard)navigator.clipboard.writeText(text).then(function(){window.dispatchEvent(new CustomEvent('wayfinder:notice',{detail:t('材料已复制','Materials copied')}));}).catch(function(){window.dispatchEvent(new CustomEvent('wayfinder:notice',{detail:t('复制失败，请手动选择材料','Copy failed; select the materials manually')}));});}));
  if(s.phone){details.appendChild(el('h3',null,t('电话','Phone')));String(s.phone).split(/[、；;]/).filter(Boolean).forEach(function(part){var ext=/转\s*(\d+)/.exec(part),main=part.split(/转/)[0],n=main.replace(/[（(].*?[）)]/g,'').replace(/[^\d+-]/g,'');if(n){if(/^\d{8}$/.test(n))n='020-'+n;var a=el('a','act',part);a.href='tel:'+n+(ext?';ext='+ext[1]:'');details.appendChild(a);}});}
  var online=safeLink(s.url);if(online){var a=el('a','act',t('办理入口 ↗','Online portal ↗'));a.href=online;a.target='_blank';a.rel='noopener';details.appendChild(a);}
  details.appendChild(el('h3',null,t('信息来源','Sources')));sourceLinks(s,details);card.appendChild(details);
  here.forEach(function(p){var target=window.__navDebug.findPlace(p.name);if(!target)return;card.appendChild(button(t('到这里','Directions')+(here.length>1?' · '+p.name:''),function(){window.__navDebug.selectDestination(p.name);window.dispatchEvent(new CustomEvent('wayfinder:destination',{detail:p.name}));window.dispatchEvent(new Event('wayfinder:close-modules'));},'primary'));});
  return card;
 }
 window.WayfinderServices={items:services,at:at,hours:hours,render:render};
})();
