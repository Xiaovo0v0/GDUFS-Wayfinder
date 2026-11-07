(function(){
 'use strict';
 var root=document.documentElement,nav=window.__navDebug,THREE=window.THREE,button=document.createElement('button');
 var english=window.GDUFS_LANG&&window.GDUFS_LANG.get()==='en';
 button.id='themeToggle';button.type='button';document.getElementById('langSwitch').before(button);
 var savedBackground=nav.scene.background.clone(),materials=[],seen=new Set();
 function excluded(o){for(var p=o;p;p=p.parent)if(p===nav.pathGroup||p===nav.markerGroup)return true;return false;}
 function collect(){nav.scene.traverse(function(o){if(!o.isMesh||excluded(o))return;(Array.isArray(o.material)?o.material:[o.material]).forEach(function(m){if(!m||!m.color||seen.has(m))return;seen.add(m);materials.push({material:m,original:m.color.clone()});});});}
 function apply(mode){collect();var day=mode==='day';root.dataset.theme=day?'day':'night';button.textContent=day?'☾':'☀';button.title=day?(english?'Switch to night':'切换夜间模式'):(english?'Switch to day':'切换日间模式');button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(day));
  nav.scene.background=day?new THREE.Color(0xe9eee2):savedBackground.clone();
  materials.forEach(function(item){var c=item.material.color;if(!day){c.copy(item.original);return;}var role=item.material.userData&&item.material.userData.themeRole,palette={roof:0x668e72,wall:0x436b53,land:0xd2decf,water:0x76aeb1,road:0xa4b5a8,park:0xb8d1b5,selected:0x218c76};if(palette[role]){c.setHex(palette[role]).convertSRGBToLinear();return;}var h={};item.original.clone().convertLinearToSRGB().getHSL(h);if(role==='building'){c.setHSL(.37,.23,Math.max(.30,Math.min(.49,.30+h.l*.46))).convertSRGBToLinear();}else if(h.h>.43&&h.h<.60){c.setHex(0x76aeb1).convertSRGBToLinear();}else{c.setHSL(.32,.16,Math.max(.38,Math.min(.72,.40+h.l*.42))).convertSRGBToLinear();}});
  try{localStorage.setItem('gdufs_theme',mode);}catch(e){}nav.requestRender();
 }
 button.addEventListener('click',function(){apply(root.dataset.theme==='day'?'night':'day');});
 window.addEventListener('wayfinder:map-materials',function(){apply(root.dataset.theme==='day'?'day':'night');});
 apply(root.dataset.theme==='day'?'day':'night');
})();
