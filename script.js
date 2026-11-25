//CORE
const SAMPLE=`# Sample CSE course catalogue

## CSE101
Type: Course
Title: Programming Fundamentals
Credits: 4
Instructor: Dr. Rao
Department: Computer Science
Semester: 1

## MAT101
Type: Course
Title: Discrete Mathematics
Credits: 3
Instructor: Dr. Iyer
Department: Mathematics
Semester: 1

## CSE201
Type: Course
Title: Data Structures
Credits: 4
Instructor: Dr. Rao
Prerequisites: CSE101
Department: Computer Science
Semester: 3

## AID201
Type: Course
Title: Artificial Intelligence
Credits: 4
Instructor: Dr. Menon
Prerequisites: CSE201, MAT101
Department: Computer Science
Semester: 3

## AID301
Type: Course
Title: Machine Learning
Credits: 4
Prerequisites: AID201
Department: Computer Science
Semester: 5

## AID401
Type: Course
Title: Deep Learning
Credits: 3
Instructor: Dr. Kapoor
Department: Computer Science
Semester: 7

## Computer Science
Type: Department
Head: Dr. Nair
Building: Block A

## Mathematics
Type: Department
Head: Dr. Bose
Building: Block C

## Notes
AID301 is taught by Dr. Menon.
AID401 requires AID301.
AID201 is a core course.
`;
const SYN={instructor:"taught by|teach\\w*|instructor|professor|lecturer|faculty",credits:"credit\\w*",prerequisites:"prereq\\w*|requires?|required|needs?|needed|before|depend\\w*",head:"head\\w*|chair\\w*|in charge",department:"department|dept|belong\\w*|offered by",semester:"semester|sem",building:"building|located",title:"title|called",category:"category|kind"};
const TRANS=new Set(["prerequisites"]);
const SR=[[/^(.+?) is taught by (.+?)\.$/,"instructor","R3 sentence: X is taught by Y"],[/^(.+?) requires (.+?)\.$/,"prerequisites","R4 sentence: X requires Y"],[/^(.+?) is an? (.+?)\.$/,"category","R5 sentence: X is a Y"]];
let KB=null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const rx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

function build(text){
 const T=[],seen=new Set(),rules={};let cur=null;
 const add=(s,p,o,line,rule)=>{s=s.trim();o=o.trim();p=p.trim().toLowerCase();const k=(s+"|"+p+"|"+o).toLowerCase();if(!s||!o||seen.has(k))return;seen.add(k);T.push({s,p,o,line,rule});rules[rule]=(rules[rule]||0)+1};
 text.split(/\r?\n/).forEach((raw,i)=>{
  const l=raw.trim();if(!l||/^#(?!#)/.test(l))return;
  let m=l.match(/^##\s*(.+)$/);if(m){cur=m[1].trim();return}
  m=l.match(/^([A-Za-z ]{2,24}):\s*(.+)$/);
  if(m&&cur){m[2].split(/\s*[,;]\s*/).forEach(v=>add(cur,m[1],v,i+1,"R1 record header + R2 attribute line"));return}
  for(const[re,p,name]of SR){const x=l.match(re);if(x){x[2].split(/\s+and\s+|\s*,\s*/).forEach(v=>add(x[1],p,v,i+1,name));break}}
 });
 const sp=new Map(),po=new Map(),subj=new Set(T.map(t=>t.s));
 const push=(m,k,v)=>{if(!m.has(k))m.set(k,[]);m.get(k).push(v)};
 T.forEach(t=>{push(sp,t.s.toLowerCase()+"|"+t.p,t.o);push(po,t.p+"|"+t.o.toLowerCase(),t.s)});
 const types=[...new Set(T.filter(t=>t.p==="type").map(t=>t.o))];
 const alias=new Map();subj.forEach(s=>alias.set(s.toLowerCase(),s));
 T.forEach(t=>{const o=t.o.toLowerCase();if(t.p==="title")alias.set(o,t.s);else if(!["type","category"].includes(t.p)&&!/^\d+$/.test(o)&&o.length>2&&!alias.has(o))alias.set(o,t.o)});
 KB={T,sp,po,subj,types,alias,preds:[...new Set(T.map(t=>t.p))].filter(p=>p!=="type"),rules};
 return KB;
}
const get=(s,p)=>KB.sp.get(s.toLowerCase()+"|"+p)||[];
const rev=(o,p)=>KB.po.get(p+"|"+String(o).toLowerCase())||[];
const typeOf=s=>get(s,"type")[0];
const edge=(a,p,b)=>`${a} —${p}→ ${b}`;
const sameL=(a,b)=>a.toLowerCase()===b.toLowerCase();

function closure(e,p,back){
 const out=[],via=new Map(),seen=new Set([e.toLowerCase()]),q=[e];
 while(q.length){const x=q.shift();for(const y of(back?rev(x,p):get(x,p))){if(seen.has(y.toLowerCase()))continue;seen.add(y.toLowerCase());out.push(y);via.set(y.toLowerCase(),x);q.push(y)}}
 return{out,via};
}
function pathTo(e,y,p,via,back){const a=[];let c=y;while(!sameL(c,e)){const v=via.get(c.toLowerCase());a.unshift(back?edge(c,p,v):edge(v,p,c));c=v}return a}
function mentions(L){
 let s=L;const found=[];
 [...KB.alias.keys()].sort((a,b)=>b.length-a.length).forEach(k=>{
  const re=new RegExp("(?<!\\w)"+rx(k)+"(?!\\w)");let x;
  while((x=re.exec(s))){found.push({i:x.index,e:KB.alias.get(k)});s=s.slice(0,x.index)+" ".repeat(k.length)+s.slice(x.index+k.length)}
 });
 found.sort((a,b)=>a.i-b.i);
 const list=[];found.forEach(f=>{if(!list.some(e=>sameL(e,f.e)))list.push(f.e)});
 return{list,masked:s};
}
function findPreds(s){
 return KB.preds.map(p=>({p,i:s.search(new RegExp("\\b(?:"+(SYN[p]?p+"|"+SYN[p]:rx(p))+")\\b"))})).filter(x=>x.i>=0).sort((a,b)=>a.i-b.i);
}
function typeWord(s){
 return KB.types.find(t=>{const l=t.toLowerCase();return new RegExp("\\b("+rx(l)+"s?|"+rx(l.replace(/y$/,"ies"))+")\\b").test(s)});
}
function answer(q){
 const L=q.toLowerCase().replace(/[?!.]+$/,"").trim(),tr=[];
 if(!KB||!L)return{values:[],tr:["Build the knowledge base and enter a question."]};
 const M=mentions(L),ents=M.list,P=findPreds(M.masked),tw=typeWord(M.masked),nums=M.masked.match(/\b\d+\b/g)||[];
 const bool=/^(is|are|does|do|did|can|has|have|will)\b/.test(L);
 const cue=/^(which|what|list|name|show|give)\b/.test(L)&&!!tw;
 const allw=/\b(all|indirect\w*|every|entire|chain|eventually|transitive\w*)\b/.test(L);
 const many=/\bhow many\b/.test(L);
 tr.push(`Recognised — entities: ${ents.join(", ")||"none"}; relations: ${P.map(x=>x.p).join(", ")||"none"}; type: ${tw||"none"}; numbers: ${nums.join(", ")||"none"}`);
 if(bool&&ents.length>=2){
  const inv=/(prerequisite|required|needed|need|necessary|before)/.test(L)&&/\b(for|of|before)\b/.test(L);
  for(const p of(P.length?P.map(x=>x.p):KB.preds)){
   const[a,b]=TRANS.has(p)&&inv?[ents[1],ents[0]]:[ents[0],ents[1]];
   const dirs=TRANS.has(p)?[[a,b]]:[[a,b],[b,a]];
   for(const[x,y]of dirs){
    if(get(x,p).some(v=>sameL(v,y))){tr.push("Rule: direct fact check");tr.push(edge(x,p,y));return{values:["Yes"],tr}}
    if(TRANS.has(p)){const c=closure(x,p);if(c.out.some(v=>sameL(v,y))){tr.push("Rule: transitive closure (a prerequisite of a prerequisite counts)");tr.push(...pathTo(x,y,p,c.via));return{values:["Yes"],tr}}}
   }
  }
  tr.push("No stored fact and no derivable chain supports the claim.");return{values:["No"],tr};
 }
 const filt=s=>!tw||typeOf(s)===tw;const e=ents[0];let vals=[],listy=false;
 if(P.length){
  for(const{p}of P){
   const modes=cue&&e?["rev","fwd","hop"]:["fwd","hop","rev"];
   for(const m of modes){
    if(m==="fwd"&&e){
     if(allw&&TRANS.has(p)){const c=closure(e,p);vals=c.out;if(vals.length){tr.push("Rule: transitive closure by breadth-first search");vals.forEach(v=>tr.push(...pathTo(e,v,p,c.via)))}}
     else{vals=get(e,p);if(vals.length){tr.push("Rule: direct lookup");vals.forEach(v=>tr.push(edge(e,p,v)))}}
    }else if(m==="rev"&&(e||nums.length)){
     const key=e||nums[0];
     if(e&&allw&&TRANS.has(p)){const c=closure(e,p,true);vals=c.out.filter(filt);if(vals.length){tr.push("Rule: inverse transitive closure");vals.forEach(v=>tr.push(...pathTo(e,v,p,c.via,true)))}}
     else{vals=rev(key,p).filter(filt);if(vals.length){tr.push("Rule: inverse lookup"+(tw?` filtered by type ${tw}`:""));vals.forEach(v=>tr.push(edge(v,p,key)))}}
     listy=true;
    }else if(m==="hop"&&e){
     const o=[];KB.T.filter(t=>sameL(t.s,e)&&t.p!=="type"&&KB.subj.has(t.o)&&!TRANS.has(t.p)).forEach(t=>get(t.o,p).forEach(v=>{if(!o.includes(v))o.push(v);tr.push("Rule: multi-hop search → "+edge(e,t.p,t.o)+" ; "+edge(t.o,p,v))}));
     vals=o;
    }
    if(vals.length)break;
   }
   if(vals.length)break;
  }
 }else if(e){
  vals=KB.T.filter(t=>sameL(t.s,e)&&t.p!=="type").map(t=>`${t.p}: ${t.o}`);tr.push("Rule: describe entity (all frame facts)");
 }else if(tw){
  vals=[...KB.subj].filter(filt);listy=true;tr.push(`Rule: list all entities of type ${tw}`);
 }
 if(!vals.length)tr.push("No matching fact in the knowledge base, so the system declines to answer.");
 if(many&&listy&&vals.length){tr.push(`Rule: count of ${vals.length} items`);vals=[String(vals.length)]}
 return{values:[...new Set(vals)],tr};
}
const TESTS=[
{q:"Who teaches AID201?",a:["Dr. Menon"],c:"lookup"},
{q:"What is the title of CSE201?",a:["Data Structures"],c:"lookup"},
{q:"How many credits does AID301 have?",a:["4"],c:"lookup"},
{q:"What are the prerequisites of AID201?",a:["CSE201","MAT101"],c:"lookup"},
{q:"Which courses are taught by Dr. Rao?",a:["CSE101","CSE201"],c:"inverse"},
{q:"Which courses are offered in semester 3?",a:["CSE201","AID201"],c:"inverse"},
{q:"Which courses have 3 credits?",a:["MAT101","AID401"],c:"inverse"},
{q:"How many courses are taught by Dr. Menon?",a:["2"],c:"count"},
{q:"List all departments",a:["Computer Science","Mathematics"],c:"count"},
{q:"What are all the prerequisites of AID401?",a:["AID301","AID201","CSE201","MAT101","CSE101"],c:"inference"},
{q:"Which courses depend on CSE101 directly or indirectly?",a:["CSE201","AID201","AID301","AID401"],c:"inference"},
{q:"Who is the head of the department of AID201?",a:["Dr. Nair"],c:"multi-hop"},
{q:"Which department does MAT101 belong to?",a:["Mathematics"],c:"multi-hop"},
{q:"Does AID301 require CSE101?",a:["Yes"],c:"yes/no"},
{q:"Is CSE101 a prerequisite of AID301?",a:["Yes"],c:"yes/no"},
{q:"Is Dr. Menon the instructor of CSE101?",a:["No"],c:"yes/no"},
{q:"Who is the head of the Biology department?",a:[],c:"unanswerable"},
{q:"Who teaches Quantum Computing?",a:[],c:"unanswerable"}
];
function runTests(tests){
 const rows=tests.map(t=>{
  const got=answer(t.q).values,g=new Set(got.map(x=>x.toLowerCase())),e=new Set(t.a.map(x=>x.toLowerCase()));
  const tp=[...g].filter(x=>e.has(x)).length;
  const pr=g.size?tp/g.size:(e.size?1:1),rc=e.size?tp/e.size:1;
  const exact=g.size===e.size&&tp===e.size;
  return{...t,got,exact,pr:e.size===0&&g.size>0?0:pr,rc,f1:(pr+rc)?2*pr*rc/(pr+rc):0};
 });
 const mean=k=>rows.reduce((s,r)=>s+r[k],0)/rows.length;
 const cats={};rows.forEach(r=>{(cats[r.c]=cats[r.c]||{n:0,ok:0}).n++;if(r.exact)cats[r.c].ok++});
 return{rows,acc:rows.filter(r=>r.exact).length/rows.length,pr:mean("pr"),rc:mean("rc"),f1:mean("f1"),cats};
}
//ENDCORE

const $=id=>document.getElementById(id);
const pct=x=>(x*100).toFixed(1)+"%";
function show(){
 const r=KB;
 $("stats").innerHTML=`<div><b>${r.subj.size}</b><span>entities</span></div><div><b>${r.T.length}</b><span>facts</span></div><div><b>${r.preds.length}</b><span>predicates</span></div><div><b>${r.types.length}</b><span>entity types</span></div>`+
 Object.entries(r.rules).map(([k,v])=>`<div><b>${v}</b><span>from ${esc(k)}</span></div>`).join("");
 $("tri").innerHTML="<tr><th>Subject</th><th>Predicate</th><th>Object</th><th>Line</th><th>Rule</th></tr>"+r.T.map(t=>`<tr><td>${esc(t.s)}</td><td>${esc(t.p)}</td><td>${esc(t.o)}</td><td>${t.line}</td><td class="mut">${esc(t.rule.split(" ")[0])}</td></tr>`).join("");
}
function ask(q){
 $("qi").value=q;const r=answer(q);
 $("out").innerHTML=`<h2>${esc(q)}</h2>`+(r.values.length?r.values.map(v=>`<span class="chip">${esc(v)}</span>`).join(""):`<span class="fail">No answer found in the knowledge base.</span>`)+`<ol class="trace">${r.tr.map(t=>`<li>${esc(t)}</li>`).join("")}</ol>`;
}
function evaluate(){
 let tests;try{tests=JSON.parse($("tests").value)}catch(e){$("evo").innerHTML=`<span class="fail">The test set is not valid JSON: ${esc(e.message)}</span>`;return}
 const r=runTests(tests);
 $("evo").innerHTML=`<div class="stats"><div><b>${pct(r.acc)}</b><span>exact-match accuracy</span></div><div><b>${pct(r.pr)}</b><span>precision</span></div><div><b>${pct(r.rc)}</b><span>recall</span></div><div><b>${pct(r.f1)}</b><span>F1</span></div></div>
 <h2 style="margin-top:18px">By category</h2><table><tr><th>Category</th><th>Correct</th><th>Accuracy</th></tr>${Object.entries(r.cats).map(([c,v])=>`<tr><td>${esc(c)}</td><td>${v.ok} / ${v.n}</td><td>${pct(v.ok/v.n)}</td></tr>`).join("")}</table>
 <h2 style="margin-top:18px">Each question</h2><div class="scroll"><table><tr><th>Question</th><th>Expected</th><th>System answer</th><th>Result</th></tr>${r.rows.map(x=>`<tr><td>${esc(x.q)}</td><td>${esc(x.a.join(", ")||"(no answer)")}</td><td>${esc(x.got.join(", ")||"(no answer)")}</td><td class="${x.exact?"pass":"fail"}">${x.exact?"Pass":"Fail"}</td></tr>`).join("")}</table></div>`;
}
function rebuild(){build($("doc").value);show()}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{
 document.querySelectorAll("nav button").forEach(x=>x.setAttribute("aria-selected",x===b));
 document.querySelectorAll("section").forEach(s=>s.classList.toggle("on",s.id===b.dataset.t));
});
$("doc").value=SAMPLE;$("tests").value=JSON.stringify(TESTS,null,1);
$("build").onclick=rebuild;
$("sample").onclick=()=>{$("doc").value=SAMPLE;rebuild()};
$("file").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$("doc").value=r.result;rebuild()};r.readAsText(f)};
$("go").onclick=()=>ask($("qi").value);
$("qi").onkeydown=e=>{if(e.key==="Enter")ask($("qi").value)};
$("run").onclick=evaluate;
["Who teaches AID201?","Which courses are taught by Dr. Rao?","What are all the prerequisites of AID401?","Does AID301 require CSE101?","Who is the head of the department of AID201?","How many courses are taught by Dr. Menon?"].forEach(q=>{const b=document.createElement("button");b.className="q";b.textContent=q;b.onclick=()=>ask(q);$("ex").appendChild(b)});
rebuild();
