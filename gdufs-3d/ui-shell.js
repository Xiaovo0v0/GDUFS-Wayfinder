(function(){
 'use strict';
 var $=function(id){return document.getElementById(id);},nav=window.__navDebug;
 var en=window.GDUFS_LANG.get()==='en',north=/[?&]campus=north/.test(location.search),D=north?window.GDUFS_NORTH:window.GDUFS_DATA;
 var input=$('mainSearch'),results=$('searchResults'),panel=$('panel'),places=nav.placeLabels.map(function(n){return nav.findPlace(n);}).filter(Boolean),chosen=null;
 function tr(zh,eng){return en?eng:zh;}
 var sidebar=document.createElement('aside');sidebar.id='sidebar';sidebar.setAttribute('aria-label',tr('校园导航','Campus navigation'));
 var heading=document.createElement('h2');heading.textContent=tr('去哪儿？','Where to?');sidebar.appendChild(heading);document.body.appendChild(sidebar);sidebar.appendChild($('searchArea'));
 var cats=document.createElement('div');cats.id='quickPlaces';sidebar.appendChild(cats);
 [['图书馆','Library',/图书馆/,'▤'],['教学楼','Classes',north?/第六教学楼/:/教学楼A/,'⌂'],['食堂','Dining',north?/第一学生食堂/:/文采园/,'♧']].forEach(function(a){var b=document.createElement('button');b.type='button';b.textContent=a[3]+' '+tr(a[0],a[1]);b.addEventListener('click',function(){var p=places.find(function(p){return a[2].test(p.label);});if(p){choose(p);cats.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b);});}});cats.appendChild(b);});
 sidebar.appendChild(panel);
 function name(p){return window.tName(p.label);}
 function show(){panel.classList.remove('hidden','collapsed');document.body.classList.add('has-panel');}
 function hideResults(){results.hidden=true;input.setAttribute('aria-expanded','false');}
 function toast(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(function(){$('toast').hidden=true;},3500);}
 function showPlace(p,fly){
  chosen=p;document.body.classList.remove('answer-mode');$('placeTitle').textContent=name(p);$('placeLocation').textContent=tr(north?'白云山校区':'大学城校区',north?'Baiyunshan Campus':'University Town Campus');
  var b=D.buildings.find(function(b){return b.id===p.ref;}),info=b&&(window.GDUFS_INFO||{})[b.id];
  $('bcard').classList.toggle('hidden',!b);$('bcard-meta').textContent=b?tr((info&&info.type)||'校园建筑','Campus building'):'';
  $('bcard-func').textContent=en?'':(info&&info.func)||'';$('bcard-foot').replaceChildren();
  if(info){['hours','loc'].forEach(function(k){if(!info[k]||en)return;var el=document.createElement('span');el.textContent=info[k];$('bcard-foot').appendChild(el);});if(info.src&&/^https?:/.test(info.src)){var a=document.createElement('a');a.href=info.src;a.target='_blank';a.rel='noopener';a.textContent=tr('官方来源 ↗','Official source ↗');$('bcard-foot').appendChild(a);}}
  $('buildingDetails').open=!!fly;$('buildingDetails').hidden=!info||(!info.func&&!info.hours&&!info.src);
  $('routeForm').hidden=true;$('btnDirections').hidden=false;$('status').hidden=true;$('btnWalk').hidden=true;show();hideResults();input.blur();
  window.dispatchEvent(new CustomEvent('wayfinder:place',{detail:p.label}));
  if(fly)nav.flyTo(p.x,p.z,160,350);
 }
 function choose(p){nav.selectDestination(p.label);showPlace(p,true);}
 function ask(q){if(window.WayfinderModules){window.WayfinderModules.openAssistant(q);hideResults();return;}if(!q)return;if(window.GDUFS_ASSISTANT&&window.GDUFS_ASSISTANT.busy()){toast(tr('正在查询','Still searching'));return;}document.body.classList.add('answer-mode');$('placeTitle').textContent=tr('语心','Yuxin');show();hideResults();input.blur();$('ai-body').replaceChildren();window.GDUFS_ASSISTANT.query(q);}
 function row(title,sub,icon,action){var b=document.createElement('button');b.type='button';b.className='search-item';var mark=document.createElement('span');mark.className='result-icon';mark.textContent=icon;var copy=document.createElement('span'),s=document.createElement('strong');s.textContent=title;copy.appendChild(s);if(sub){var sm=document.createElement('small');sm.textContent=sub;copy.appendChild(sm);}var arr=document.createElement('span');arr.className='result-arrow';arr.textContent='↗';b.append(mark,copy,arr);b.addEventListener('click',action);results.appendChild(b);}
 function search(){var q=input.value.trim().toLowerCase();results.replaceChildren();var hits=places.filter(function(p){return !q||p.label.toLowerCase().includes(q)||name(p).toLowerCase().includes(q);});if(!q)hits=hits.filter(function(p){return /图书馆|正门|北门|文采园|第六教学楼/.test(p.label);});hits.slice(0,6).forEach(function(p){row(name(p),tr(north?'白云山校区':'大学城校区',north?'Baiyunshan':'University Town'),'↗',function(){choose(p);});});
  if(q){var services=(window.GDUFS_SERVICE||[]).filter(function(s){return (s.title||'').includes(q);});services.slice(0,3).forEach(function(s){row(s.title,tr('办事','Service'),'≡',function(){ask(s.title);});});row(tr('问语心：','Ask Yuxin: ')+input.value.trim(),'', '✧',function(){ask(input.value.trim());});}
  results.hidden=false;input.setAttribute('aria-expanded','true');
 }
 input.addEventListener('input',search);input.addEventListener('focus',search);
 input.addEventListener('keydown',function(e){if(e.key==='Escape'){hideResults();input.blur();}if(e.key==='ArrowDown'){e.preventDefault();var b=results.querySelector('button');if(b)b.focus();}});
 results.addEventListener('keydown',function(e){var all=Array.from(results.querySelectorAll('button')),i=all.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();all[(i+(e.key==='ArrowDown'?1:all.length-1))%all.length].focus();}if(e.key==='Escape'){hideResults();input.focus();hideResults();}});
 $('searchForm').addEventListener('submit',function(e){e.preventDefault();var q=input.value.trim();if(!q)return;var exact=places.find(function(p){return p.label===q||name(p).toLowerCase()===q.toLowerCase();});if(exact)choose(exact);else ask(q);});
 document.addEventListener('click',function(e){if(!$('searchArea').contains(e.target))hideResults();if(!$('index').contains(e.target)&&!$('layersButton').contains(e.target)){$('index').hidden=true;$('layersButton').setAttribute('aria-expanded','false');}});
 $('btnDirections').addEventListener('click',function(){if(!chosen)return;$('routeForm').hidden=false;this.hidden=true;$('status').hidden=false;if(nav.getMyPosition&&nav.getMyPosition())nav.setPlaces('我的位置',chosen.label);else $('startSelect').focus();});
 $('panelClose').addEventListener('click',function(){panel.classList.add('hidden');document.body.classList.remove('has-panel','answer-mode');nav.clearSelection();chosen=null;});
 $('layersButton').addEventListener('click',function(){$('index').hidden=!$('index').hidden;this.setAttribute('aria-expanded',String(!$('index').hidden));});
 ['btnLabels','btnRoads'].forEach(function(id){$(id).addEventListener('click',function(){this.setAttribute('aria-pressed',String(this.classList.contains('on')));});});
 function syncRoute(){var current=nav.currentPlaces();if(!current.to)return;var p=nav.findPlace(current.to);if(!p)return;if(document.body.classList.contains('answer-mode'))return;if(!chosen||chosen.label!==p.label)showPlace(p,false);var has=!!current.from;$('routeForm').hidden=!has;$('btnDirections').hidden=has;$('status').hidden=!has;$('btnWalk').hidden=!has||!$('status').dataset.dist;$('miniSummary').textContent=has?(window.tName(current.from)+' → '+name(p)):tr('到这里','Directions');show();}
 new MutationObserver(syncRoute).observe($('status'),{childList:true,subtree:true});
 window.__onBuildingClick=function(b){var p=places.find(function(p){return p.ref===b.id;});if(p)showPlace(p,false);};
 window.addEventListener('wayfinder:destination',function(e){var p=nav.findPlace(e.detail);if(p){showPlace(p,true);$('routeForm').hidden=false;$('btnDirections').hidden=true;}});
 $('campusSelect').value=north?'north':'south';
 function go(c,l){var u=new URL(location.href);u.searchParams.set('campus',c);u.searchParams.set('lang',l);u.searchParams.delete('q');location.href=u.href;}
 $('campusSelect').addEventListener('change',function(){go(this.value,en?'en':'zh');});
 var picker=document.querySelector('.campus-picker'),select=$('campusSelect'),trigger=document.createElement('button'),menu=document.createElement('div');
 trigger.type='button';trigger.className='campus-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.textContent=tr(north?'白云山校区':'大学城校区',north?'Baiyunshan':'University Town')+'  ﹀';menu.className='campus-menu';menu.hidden=true;menu.setAttribute('role','listbox');
 [['south','大学城校区','University Town'],['north','白云山校区','Baiyunshan']].forEach(function(item){var option=document.createElement('button');option.type='button';option.setAttribute('role','option');option.setAttribute('aria-selected',String(item[0]===select.value));option.textContent=tr(item[1],item[2])+(item[0]===select.value?'  ✓':'');option.addEventListener('click',function(){if(item[0]!==select.value)go(item[0],en?'en':'zh');else{menu.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus();}});menu.appendChild(option);});
 select.hidden=true;picker.append(trigger,menu);trigger.addEventListener('click',function(){menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));});picker.addEventListener('keydown',function(e){if(e.key==='Escape'){menu.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus();}if(e.key==='ArrowDown'){e.preventDefault();menu.hidden=false;trigger.setAttribute('aria-expanded','true');menu.querySelector('button').focus();}});document.addEventListener('click',function(e){if(!picker.contains(e.target)){menu.hidden=true;trigger.setAttribute('aria-expanded','false');}});
 document.querySelectorAll('#langSwitch button').forEach(function(b){b.classList.toggle('on',b.dataset.lang===(en?'en':'zh'));b.addEventListener('click',function(){go(north?'north':'south',b.dataset.lang);});});
 $('mainSearch').placeholder=tr('搜索地点或办事','Search places or services');$('mainSearch').setAttribute('aria-label',$('mainSearch').placeholder);$('searchSubmit').setAttribute('aria-label',tr('搜索','Search'));
 $('btnDirections').firstChild.textContent=tr('到这里 ','Directions ');$('btnWalk').firstChild.textContent=tr('出发 ','Go ');$('buildingSummary').textContent=tr('地点详情','Place details');$('layersTitle').textContent=tr('图层','Layers');$('btnLabels').textContent=tr('全部地名','All labels');$('btnRoads').textContent=tr('道路','Roads');$('compassN').textContent=en?'N':'北';
 [['btnLocate','我的位置','My location'],['layersButton','图层','Layers'],['btnReset','重置视角','Reset view'],['panelClose','关闭','Close']].forEach(function(a){$(a[0]).setAttribute('aria-label',tr(a[1],a[2]));$(a[0]).title=tr(a[1],a[2]);});
 if(en){$('campusSelect').options[0].textContent='University Town';$('campusSelect').options[1].textContent='Baiyunshan';}
  $('panelCollapse').setAttribute('aria-label',tr('收起','Hide'));$('campusLabel').textContent=tr('校区','Campus');
 var initial=places.find(function(p){return /图书馆/.test(p.label);});if(initial){nav.selectDestination(initial.label);showPlace(initial,false);}
 try{if(!localStorage.getItem('gdufs_hint_minimal')){$('firstHint').textContent=tr('拖动旋转 · 滚轮缩放 · 点选建筑','Drag to rotate · Scroll to zoom · Select a building');$('firstHint').hidden=false;setTimeout(function(){$('firstHint').hidden=true;},5000);localStorage.setItem('gdufs_hint_minimal','1');}}catch(e){}
})();
