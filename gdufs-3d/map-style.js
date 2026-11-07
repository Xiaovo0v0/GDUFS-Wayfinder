(function(){
 'use strict';
 var n=window.__navDebug,T=window.THREE,D=/[?&]campus=north/.test(location.search)?window.GDUFS_NORTH:window.GDUFS_DATA;
 function color(hex){return new T.Color(hex).convertSRGBToLinear();}
 var scene=n.scene;
 scene.children.forEach(function(o){if(!o.isLight&&o!==n.pathGroup&&o!==n.markerGroup)o.visible=false;});
 scene.background=new T.Color(0x14211c);scene.fog=null;n.renderer.shadowMap.enabled=false;
 var group=new T.Group();scene.add(group);
 var roof=new T.MeshBasicMaterial({color:color(0x42664d),toneMapped:false}),wall=new T.MeshBasicMaterial({color:color(0x345747),toneMapped:false}),land=new T.MeshBasicMaterial({color:color(0x21352a)}),water=new T.MeshBasicMaterial({color:color(0x27565a)}),roadMat=new T.MeshBasicMaterial({color:color(0x3d5243)}),park=new T.MeshBasicMaterial({color:color(0x34543b)});
 var selectedRoof=roof.clone(),selectedWall=wall.clone();selectedRoof.color.lerp(color(0x4e876d),.22);selectedWall.color.lerp(color(0x4e876d),.22);
 function shape(rings){var s=new T.Shape();rings[0].forEach(function(p,i){s[i?'lineTo':'moveTo'](p[0],-p[1]);});(rings.slice(1)||[]).forEach(function(r){var h=new T.Path();r.forEach(function(p,i){h[i?'lineTo':'moveTo'](p[0],-p[1]);});s.holes.push(h);});return s;}
 function flat(rings,mat,y){var m=new T.Mesh(new T.ShapeGeometry(shape(rings)),mat);m.rotation.x=-Math.PI/2;m.position.y=y;group.add(m);return m;}
 D.boundary.forEach(function(r){flat([r],land,-.5);});
 (D.waterPolygons||[]).forEach(function(w){flat(w.rings,water,.02);});
 (D.landscape||[]).forEach(function(l){if(l.rings)flat(l.rings,park,.05);});
 var verts=[];
 (D.roads||[]).forEach(function(r){(r.lines||[]).forEach(function(line){var w=Math.min(r.width||5,13)/2;for(var i=1;i<line.length;i++){var a=line[i-1],b=line[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(!len)continue;var ox=-dz/len*w,oz=dx/len*w;verts.push(a[0]+ox,.2,a[1]+oz,a[0]-ox,.2,a[1]-oz,b[0]+ox,.2,b[1]+oz,b[0]+ox,.2,b[1]+oz,a[0]-ox,.2,a[1]-oz,b[0]-ox,.2,b[1]-oz);}line.forEach(function(p){for(var k=0;k<8;k++){var a=k*Math.PI/4,b=(k+1)*Math.PI/4;verts.push(p[0],.2,p[1],p[0]+Math.cos(a)*w,.2,p[1]+Math.sin(a)*w,p[0]+Math.cos(b)*w,.2,p[1]+Math.sin(b)*w);}});});});
 var rg=new T.BufferGeometry();rg.setAttribute('position',new T.Float32BufferAttribute(verts,3));rg.computeVertexNormals();roadMat.side=T.DoubleSide;var roads=new T.Mesh(rg,roadMat);group.add(roads);
 var originals=n.buildingMeshes.slice(), specialIds={'B002':1,'B031':1,'B041':1,'B033':1,'B034':1,'B036':1,'B037':1,'B038E':1,'B038F':1,'B038G':1,'B045A':1,'B045B':1,'B045C':1,'B045D':1,'B045E':1,'B005':1,'B006':1,'B007':1,'B008':1,'B009':1,'B010':1,'B011':1,'B013':1,'B014':1,'B015':1,'B016':1,'B017':1,'B018':1};
 var specialGroups=[];if(!/[?&]campus=north/.test(location.search)) originals.forEach(function(m){if(!m.userData.building||!specialIds[m.userData.building.id])return;var top=m;while(top.parent&&top.parent!==scene)top=top.parent;if(top.parent===scene&&top.type==='Group'&&specialGroups.indexOf(top)<0)specialGroups.push(top);});
 n.buildingMeshes.length=0;var buildings=[];
 var materialCache=new WeakMap();
 function styledMaterial(src,buildingId){
  if(!src)return {base:roof,selected:selectedRoof};
  if(materialCache.has(src))return materialCache.get(src);
  var glass=src.roughness<.31,texture=src.map||null,original=src.color&&src.color.getHex(),dark=original!=null&&original<0x555555;
  var gymRoof=buildingId==='B031'&&!texture&&src.roughness>.58&&src.roughness<.68;
  var tone=glass?0x254c43:dark?0x1b3b34:texture?(src.roughness>.8?0x3d6149:0x345747):src.roughness>.72?0x42664d:0x4a6a52;
  var options={color:color(gymRoof?0x456a51:tone),map:src.isMeshBasicMaterial?texture:null,side:src.side,transparent:!!src.transparent,opacity:src.opacity==null?1:src.opacity,alphaTest:src.alphaTest||0,toneMapped:false};
  var base=new T.MeshBasicMaterial(options);
  var selected=base.clone();selected.color.lerp(color(gymRoof?0x4e8467:0x4e876d),.22);
  var pair={base:base,selected:selected};materialCache.set(src,pair);return pair;
 }
 specialGroups.forEach(function(g){g.visible=true;g.traverse(function(m){if(!m.isMesh)return;var original=m.material,pairs=(Array.isArray(original)?original:[original]).map(function(mat){return styledMaterial(mat,m.userData.building&&m.userData.building.id);});m.userData.styleBase=Array.isArray(original)?pairs.map(function(p){return p.base;}):pairs[0].base;m.userData.styleSelected=Array.isArray(original)?pairs.map(function(p){return p.selected;}):pairs[0].selected;m.material=m.userData.styleBase;m.castShadow=false;m.receiveShadow=false;if(m.userData.building){n.buildingMeshes.push(m);buildings.push(m);}});});
 D.buildings.forEach(function(b){if(specialGroups.some(function(g){var found=false;g.traverse(function(m){if(m.userData.building&&m.userData.building.id===b.id)found=true;});return found;}))return;var geo=new T.ExtrudeGeometry(shape(b.rings),{depth:Math.min(b.height||12,28)*.75,bevelEnabled:false,steps:1});geo.rotateX(-Math.PI/2);var mesh=new T.Mesh(geo,[roof,wall]);mesh.userData.building=b;group.add(mesh);n.buildingMeshes.push(mesh);buildings.push(mesh);});
 function highlight(){var p=n.currentPlaces(),dest=p.to&&n.findPlace(p.to);buildings.forEach(function(m){var selected=dest&&m.userData.building.id===dest.ref;m.material=m.userData.styleBase?(selected?m.userData.styleSelected:m.userData.styleBase):(selected?[selectedRoof,selectedWall]:[roof,wall]);});n.requestRender();}
 new MutationObserver(highlight).observe(document.getElementById('status'),{childList:true,subtree:true});
 document.getElementById('btnRoads').addEventListener('click',function(){roads.visible=this.classList.contains('on');n.requestRender();});
 var mobile=matchMedia('(max-width:760px)');
 function offset(){var w=innerWidth,h=innerHeight;n.camera.setViewOffset(w,h,mobile.matches?0:-155,mobile.matches?-35:0,w,h);n.camera.updateProjectionMatrix();n.requestRender();}
 window.addEventListener('resize',offset);offset();
 n.controls.minPolarAngle=.08;n.controls.maxPolarAngle=Math.PI/2-.04;
 var center={x:(D.meta.bounds_m.x[0]+D.meta.bounds_m.x[1])/2,z:(D.meta.bounds_m.z[0]+D.meta.bounds_m.z[1])/2};
 var span=Math.max(D.meta.bounds_m.x[1]-D.meta.bounds_m.x[0],D.meta.bounds_m.z[1]-D.meta.bounds_m.z[0]);
 function overview(){n.controls.target.set(center.x,0,center.z);var zoom=mobile.matches?.86:.72;n.camera.position.set(center.x-span*.56*zoom,span*.95*zoom,center.z-span*.90*zoom);n.controls.update();n.requestRender();}
 overview();document.getElementById('btnReset').addEventListener('click',overview);
 document.getElementById('viewButton').addEventListener('click',function(){var flat=this.textContent==='2D';this.textContent=flat?'3D':'2D';var p=n.controls.target;n.flyTo(p.x,p.z,flat?span:span*.66,flat?1:span*.65);});
 n.mapStyle='minimal';highlight();
})();
