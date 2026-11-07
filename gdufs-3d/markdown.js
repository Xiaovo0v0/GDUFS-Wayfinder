(function(){
 'use strict';
 function inline(parent,text){
  var re=/(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*([^*]+)\*)/g,m,last=0;
  while((m=re.exec(text))){parent.appendChild(document.createTextNode(text.slice(last,m.index)));var e=document.createElement(m[2]?'strong':m[3]?'code':m[4]?'a':'em');e.textContent=m[2]||m[3]||m[4]||m[6];if(m[4]){e.href=m[5];e.target='_blank';e.rel='noopener noreferrer';}parent.appendChild(e);last=re.lastIndex;}parent.appendChild(document.createTextNode(text.slice(last)));
 }
 window.renderWayfinderMarkdown=function(target,text){
  target.replaceChildren();var lines=String(text||'').replace(/\r\n?/g,'\n').split('\n'),i=0;
  while(i<lines.length){var l=lines[i];if(!l.trim()){i++;continue;}var m;
   if(/^```/.test(l)){var code=document.createElement('code'),pre=document.createElement('pre'),a=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))a.push(lines[i++]);if(i<lines.length)i++;code.textContent=a.join('\n');pre.appendChild(code);target.appendChild(pre);continue;}
   if(i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){var wrap=document.createElement('div'),table=document.createElement('table');wrap.className='markdown-table';var rows=[lines[i]];i+=2;while(i<lines.length&&lines[i].includes('|')&&lines[i].trim())rows.push(lines[i++]);rows.forEach(function(row,j){var tr=document.createElement('tr');row.replace(/^\s*\||\|\s*$/g,'').split('|').forEach(function(cell){var td=document.createElement(j?'td':'th');inline(td,cell.trim());tr.appendChild(td);});table.appendChild(tr);});wrap.appendChild(table);target.appendChild(wrap);continue;}
   if((m=l.match(/^\s*(#{1,6})\s+(.+)/))){var h=document.createElement('h'+m[1].length);inline(h,m[2]);target.appendChild(h);i++;continue;}
   if(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(l)){var ordered=/^\s*\d/.test(l),list=document.createElement(ordered?'ol':'ul');while(i<lines.length&&(m=lines[i].match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)/))){var li=document.createElement('li');inline(li,m[1]);list.appendChild(li);i++;}target.appendChild(list);continue;}
   if(/^\s*>/.test(l)){var quote=document.createElement('blockquote');inline(quote,l.replace(/^\s*>\s?/,''));target.appendChild(quote);i++;continue;}
   var p=document.createElement('p');inline(p,l);target.appendChild(p);i++;
  }
 };
})();
