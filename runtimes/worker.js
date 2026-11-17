/* Trusted runtime dispatcher. User programs execute only in this disposable worker. */
'use strict';
const V = new URL('./vendor/', self.location.href).href;
let emitted = 0;
function text(v) { if (typeof v === 'string') return v; try { return JSON.stringify(v, (_, x) => typeof x === 'bigint' ? String(x) + 'n' : x); } catch { return String(v); } }
function out(...args) { const s = args.map(text).join(' '); emitted += s.length; if (emitted > 100000) throw Error('Output limit exceeded (100,000 characters).'); postMessage({type:'log', text:s}); }
function need(ok, message) { if (!ok) throw Error(message); }
function brackets(code, open='[', close=']') { const s=[], map=new Map(); for(let i=0;i<code.length;i++){if(code[i]===open)s.push(i);if(code[i]===close){need(s.length,'Unmatched closing bracket');let j=s.pop();map.set(j,i);map.set(i,j);}} need(!s.length,'Unmatched opening bracket');return map; }
function brain(code,input,bits=false) {
 const map=brackets(code), mem=new Uint8Array(65536); let p=0, ip=0, n=0, read=0, ob=0, oc=0;
 const output=[];
 for(;ip<code.length;ip++) { if(++n>10000000)throw Error('Instruction limit exceeded'); const c=code[ip];
 if(c==='>')p=(p+1)%mem.length;else if(c==='<')p=(p+mem.length-1)%mem.length;
 else if(c==='+')mem[p]=bits?mem[p]^1:(mem[p]+1)&255;else if(c==='-')mem[p]=(mem[p]-1)&255;
 else if(c===','){if(bits){mem[p]=((input.charCodeAt(read>>3)||0)>>(read%8))&1;read++;}else mem[p]=input.charCodeAt(read++)||0;}
 else if(c==='.'||c===';'){if(bits){oc|=mem[p]<<ob;if(++ob===8){output.push(String.fromCharCode(oc));oc=ob=0;}}else output.push(String.fromCharCode(mem[p]));}
 else if(c==='['&&!mem[p])ip=map.get(ip);else if(c===']'&&mem[p])ip=map.get(ip);
 } if(bits&&ob)output.push(String.fromCharCode(oc));out(output.join(''));
}
function whitespace(source,input) {
 const s=source.replace(/[^ \t\n]/g,''), instructions=[], labels=new Map();let i=0;
 const bit=()=>{let v='';while(i<s.length&&s[i]!=='\n')v+=s[i++]==='\t'?'1':'0';need(i<s.length,'Unterminated number/label');i++;return v;};
 const number=()=>{need(i<s.length,'Missing number');const sign=s[i++]==='\t'?-1:1;return sign*parseInt(bit()||'0',2);};
 while(i<s.length){let a=s[i++],b=s[i++],c; if(a===' '){if(b===' ')instructions.push(['push',number()]);else if(b==='\n'){c=s[i++];instructions.push([({' ':'dup','\t':'swap','\n':'drop'})[c]]);}else{c=s[i++];need(c===' '||c==='\n','Invalid stack instruction');instructions.push([c===' '?'copy':'slide',number()]);}}
 else if(a==='\t'){if(b===' '){c=s.slice(i,i+2);i+=2;instructions.push([({'  ':'add',' \t':'sub',' \n':'mul','\t ':'div','\t\t':'mod'})[c]]);}else if(b==='\t'){c=s[i++];instructions.push([c===' '?'store':c==='\t'?'load':null]);}else{need(b==='\n','Invalid I/O');c=s.slice(i,i+2);i+=2;instructions.push([({'  ':'char',' \t':'num','\t ':'readchar','\t\t':'readnum'})[c]]);}}
 else if(a==='\n'){c=s[i++];const op=({'  ':'label',' \t':'call',' \n':'jump','\t ':'zero','\t\t':'negative','\t\n':'return','\n\n':'end'})[b+c];need(op,'Invalid flow instruction');let label=['label','call','jump','zero','negative'].includes(op)?bit():null;if(op==='label')labels.set(label,instructions.length);instructions.push([op,label]);}
 need(instructions.at(-1)?.[0],'Invalid Whitespace instruction');}
 const stack=[],heap=new Map(),calls=[];let pc=0,steps=0,read=0,buffer='';const pop=()=>{need(stack.length,'Stack underflow');return stack.pop();};
 while(pc<instructions.length){need(++steps<1000000,'Instruction limit exceeded');const [op,v]=instructions[pc++];let a,b;const jump=()=>{need(labels.has(v),'Unknown label');pc=labels.get(v);};
 switch(op){case'push':stack.push(v);break;case'dup':a=pop();stack.push(a,a);break;case'swap':a=pop();b=pop();stack.push(a,b);break;case'drop':pop();break;case'copy':need(v>=0&&v<stack.length,'Invalid copy depth');stack.push(stack[stack.length-1-v]);break;case'slide':a=pop();need(v>=0&&v<=stack.length,'Invalid slide depth');stack.splice(stack.length-v,v);stack.push(a);break;
 case'add':a=pop();stack.push(pop()+a);break;case'sub':a=pop();stack.push(pop()-a);break;case'mul':a=pop();stack.push(pop()*a);break;case'div':case'mod':a=pop();b=pop();need(a!==0,'Division by zero');stack.push(op==='div'?Math.floor(b/a):((b%a)+a)%a);break;
 case'store':a=pop();heap.set(pop(),a);break;case'load':a=pop();need(heap.has(a),'Uninitialized heap address');stack.push(heap.get(a));break;case'char':buffer+=String.fromCodePoint(pop());break;case'num':buffer+=pop();break;case'readchar':heap.set(pop(),read<input.length?input.charCodeAt(read++):-1);break;case'readnum':{const m=input.slice(read).match(/^\s*([+-]?\d+)/);need(m,'Expected integer input');read+=m[0].length;heap.set(pop(),Number(m[1]));break;}
 case'call':calls.push(pc);jump();break;case'jump':jump();break;case'zero':if(pop()===0)jump();break;case'negative':if(pop()<0)jump();break;case'return':need(calls.length,'Empty call stack');pc=calls.pop();break;case'end':pc=instructions.length;break;}
 need(buffer.length<=100000,'Output limit exceeded');}out(buffer);
}
function befunge(code,input){const rows=code.split('\n');need(rows.length<=25&&rows.every(r=>r.length<=80),'Befunge-93 supports an 80×25 grid');const grid=Array.from({length:25},(_,y)=>Array.from({length:80},(_,x)=>rows[y]?.charCodeAt(x)||32));const stack=[],pop=()=>stack.pop()||0;let x=0,y=0,dx=1,dy=0,str=false,read=0,result='';
 for(let step=0;step<1000000;step++){let c=String.fromCharCode(grid[y][x]),a,b;if(str&&c!=='"')stack.push(grid[y][x]);else if(/\d/.test(c))stack.push(+c);else switch(c){case'"':str=!str;break;case'>':dx=1;dy=0;break;case'<':dx=-1;dy=0;break;case'^':dy=-1;dx=0;break;case'v':dy=1;dx=0;break;case'?':{let d=Math.floor(Math.random()*4);dx=[1,-1,0,0][d];dy=[0,0,1,-1][d];break;}case'_':dx=pop()?-1:1;dy=0;break;case'|':dy=pop()?-1:1;dx=0;break;case'+':stack.push(pop()+pop());break;case'-':a=pop();stack.push(pop()-a);break;case'*':stack.push(pop()*pop());break;case'/':case'%':a=pop();b=pop();need(a!==0,'Division by zero');stack.push(c==='/'?Math.trunc(b/a):b%a);break;case'!':stack.push(+!pop());break;case'`':a=pop();stack.push(+(pop()>a));break;case':':a=pop();stack.push(a,a);break;case'\\':a=pop();b=pop();stack.push(a,b);break;case'$':pop();break;case'.':result+=pop()+' ';break;case',':result+=String.fromCharCode(pop()&255);break;case'#':x=(x+dx+80)%80;y=(y+dy+25)%25;break;case'p':b=pop();a=pop();{const v=pop();need(b>=0&&b<25&&a>=0&&a<80,'Grid address out of bounds');grid[b][a]=v&255;}break;case'g':b=pop();a=pop();need(b>=0&&b<25&&a>=0&&a<80,'Grid address out of bounds');stack.push(grid[b][a]);break;case'&':{const m=input.slice(read).match(/^\s*([+-]?\d+)/);need(m,'Expected integer input');read+=m[0].length;stack.push(+m[1]);break;}case'~':stack.push(read<input.length?input.charCodeAt(read++):-1);break;case'@':out(result);return;case' ':break;default:throw Error('Unknown Befunge-93 instruction: '+c);}
 need(result.length<=100000,'Output limit exceeded');x=(x+dx+80)%80;y=(y+dy+25)%25;}throw Error('Instruction limit exceeded');}
// Arithmetic parser for BASIC: no JavaScript evaluation or substitution.
function basicExpr(source,vars){const re=/\s*(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|"(?:[^"\\]|\\.)*"|[A-Za-z_]\w*\$?|<>|<=|>=|[()+*/^=<>,-])/gy,t=[];let m,p=0;while(p<source.length){re.lastIndex=p;m=re.exec(source);need(m,'Invalid expression near '+source.slice(p));t.push(m[1]);p=re.lastIndex;}let i=0;
 const prec={'OR':1,'AND':2,'=':3,'<>':3,'<':3,'>':3,'<=':3,'>=':3,'+':4,'-':4,'*':5,'/':5,'^':6};
 function expr(min=0){let token=t[i++],v;need(token!==undefined,'Expected expression');if(token==='('){v=expr();need(t[i++]===')','Expected )');}else if(token==='-'||token==='+')v=(token==='-'?-1:1)*expr(6);else if(token[0]==='"')v=JSON.parse(token);else if(/^\d/.test(token))v=+token;else{const name=token.toUpperCase();if(t[i]==='('){i++;const args=[];if(t[i]!==')'){do{args.push(expr());}while(t[i]===','&&i++);}need(t[i++]===')','Expected )');const f={ABS:Math.abs,INT:Math.floor,SQR:Math.sqrt,LEN:s=>String(s).length,CHR$:String.fromCharCode,ASC:s=>String(s).charCodeAt(0),STR$:String};need(f[name],'Unknown function '+name);v=f[name](...args);}else v=vars.get(name)??(name.endsWith('$')?'':0);}
 while(i<t.length){const op=t[i].toUpperCase(),level=prec[op];if(level===undefined||level<min)break;i++;const r=expr(level+(op==='^'?0:1));switch(op){case'+':v+=r;break;case'-':v-=r;break;case'*':v*=r;break;case'/':need(r!==0,'Division by zero');v/=r;break;case'^':v**=r;break;case'=':v=+(v===r);break;case'<>':v=+(v!==r);break;case'<':v=+(v<r);break;case'>':v=+(v>r);break;case'<=':v=+(v<=r);break;case'>=':v=+(v>=r);break;case'AND':v=+(!!v&&!!r);break;case'OR':v=+(!!v||!!r);break;}}return v;}
 const result=expr();need(i===t.length,'Unexpected expression token '+t[i]);return result;}
function basic(source,input){const lines=source.split('\n').map(s=>s.trim()).filter(Boolean).map((s,i)=>{const m=s.match(/^(\d+)\s+(.*)$/);return{label:m?+m[1]:null,code:m?m[2]:s,index:i};});if(lines.every(l=>l.label!==null))lines.sort((a,b)=>a.label-b.label);const labels=new Map(lines.map((l,i)=>[l.label,i])),vars=new Map(),calls=[],loops=[],inputs=input.split(/\r?\n/);let pc=0,steps=0,buffer='';const ex=s=>basicExpr(s.trim(),vars);const jump=s=>{const n=+s;need(labels.has(n),'Unknown BASIC line '+s);pc=labels.get(n);};
 function statement(s){let m;if(!s||/^REM(?:\s|$)|^'/.test(s))return;if((m=s.match(/^PRINT(?:\s+(.*))?$/i))){const parts=(m[1]||'').match(/(?:"(?:[^"\\]|\\.)*"|[^;])+|;/g)||[];let suppress=false;for(const part of parts){if(part===';'){suppress=true;continue;}buffer+=ex(part);suppress=false;}if(!suppress)buffer+='\n';}
 else if((m=s.match(/^(?:LET\s+)?([A-Za-z_]\w*\$?)\s*=\s*(.+)$/i)))vars.set(m[1].toUpperCase(),ex(m[2]));
 else if((m=s.match(/^INPUT\s+([A-Za-z_]\w*\$?)$/i))){need(inputs.length,'Input exhausted');const v=inputs.shift(),name=m[1].toUpperCase();need(name.endsWith('$')||v.trim()!==''&&Number.isFinite(+v),'Expected numeric INPUT');vars.set(name,name.endsWith('$')?v:+v);}
 else if((m=s.match(/^IF\s+(.+?)\s+THEN\s+(.+)$/i))){if(ex(m[1]))/^\d+$/.test(m[2])?jump(m[2]):statement(m[2]);}
 else if((m=s.match(/^GOTO\s+(\d+)$/i)))jump(m[1]);else if((m=s.match(/^GOSUB\s+(\d+)$/i))){calls.push(pc);jump(m[1]);}else if(/^RETURN$/i.test(s)){need(calls.length,'RETURN without GOSUB');pc=calls.pop();}
 else if((m=s.match(/^FOR\s+(\w+)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/i))){const name=m[1].toUpperCase(),start=ex(m[2]),end=ex(m[3]),step=m[4]?ex(m[4]):1;need(step!==0,'FOR STEP cannot be zero');vars.set(name,start);if(step>0?start>end:start<end){let depth=1;while(pc<lines.length&&depth){if(/^FOR\b/i.test(lines[pc].code))depth++;if(/^NEXT\b/i.test(lines[pc].code))depth--;pc++;}need(!depth,'FOR without NEXT');}else loops.push({name,end,step,pc});}
 else if((m=s.match(/^NEXT(?:\s+(\w+))?$/i))){const l=loops.at(-1);need(l&&(!m[1]||l.name===m[1].toUpperCase()),'NEXT without matching FOR');const n=vars.get(l.name)+l.step;vars.set(l.name,n);if(l.step>0?n<=l.end:n>=l.end)pc=l.pc;else loops.pop();}
 else if(/^(END|STOP)$/i.test(s))pc=lines.length;else throw Error('Unsupported BASIC statement: '+s);need(buffer.length<=100000,'Output limit exceeded');}
 while(pc<lines.length){need(++steps<1000000,'Instruction limit exceeded');const l=lines[pc++];try{statement(l.code);}catch(e){throw Error('Line '+(l.label??l.index+1)+': '+e.message);}}out(buffer);}
function forth(source){const tokens=source.replace(/\\[^\n]*/g,'').replace(/\([^)]*\)/g,'').match(/\."[^\"]*"|[^\s]+/g)||[],dict=new Map(),stack=[],returns=[];let steps=0;const pop=()=>{need(stack.length,'Stack underflow');return stack.pop();};let output='';
 function run(code,depth=0){need(depth<128,'Call depth exceeded');for(let i=0;i<code.length;i++){need(++steps<1000000,'Instruction limit exceeded');const raw=code[i],w=raw.toLowerCase();let a,b;if(/^[-+]?\d+(\.\d+)?$/.test(w)){stack.push(+w);continue;}if(dict.has(w)){run(dict.get(w),depth+1);continue;}switch(w){case':':{const name=code[++i]?.toLowerCase(),body=[];need(name,'Missing word name');while(++i<code.length&&code[i]!==';')body.push(code[i]);need(i<code.length,'Missing ;');dict.set(name,body);break;}case'dup':a=pop();stack.push(a,a);break;case'drop':pop();break;case'swap':a=pop();b=pop();stack.push(a,b);break;case'over':need(stack.length>=2,'Stack underflow');stack.push(stack.at(-2));break;case'rot':need(stack.length>=3,'Stack underflow');stack.push(stack.splice(stack.length-3,1)[0]);break;case'depth':stack.push(stack.length);break;case'+':stack.push(pop()+pop());break;case'-':a=pop();stack.push(pop()-a);break;case'*':stack.push(pop()*pop());break;case'/':case'mod':a=pop();b=pop();need(a!==0,'Division by zero');stack.push(w==='/'?Math.trunc(b/a):b%a);break;case'1+':stack.push(pop()+1);break;case'1-':stack.push(pop()-1);break;case'negate':stack.push(-pop());break;case'abs':stack.push(Math.abs(pop()));break;case'=':a=pop();stack.push(pop()===a?-1:0);break;case'<':a=pop();stack.push(pop()<a?-1:0);break;case'>':a=pop();stack.push(pop()>a?-1:0);break;case'0=':stack.push(pop()===0?-1:0);break;case'and':stack.push(pop()&pop());break;case'or':stack.push(pop()|pop());break;case'xor':stack.push(pop()^pop());break;case'invert':stack.push(~pop());break;case'.':output+=pop()+' ';break;case'.s':output+='<'+stack.length+'> '+stack.join(' ')+' ';break;case'emit':output+=String.fromCodePoint(pop());break;case'cr':output+='\n';break;case'space':output+=' ';break;case'>r':returns.push(pop());break;case'r>':need(returns.length,'Return stack underflow');stack.push(returns.pop());break;
 case'if':{let nesting=1,j=i+1,split=-1;for(;j<code.length;j++){let v=code[j].toLowerCase();if(v==='if')nesting++;if(v==='then'&&!--nesting)break;if(v==='else'&&nesting===1)split=j;}need(j<code.length,'IF without THEN');const yes=pop();run(yes?code.slice(i+1,split<0?j:split):split<0?[]:code.slice(split+1,j),depth+1);i=j;break;}
 case'begin':{let nesting=1,j=i+1;for(;j<code.length;j++){if(code[j].toLowerCase()==='begin')nesting++;if(code[j].toLowerCase()==='until'&&!--nesting)break;}need(j<code.length,'BEGIN without UNTIL');do{run(code.slice(i+1,j),depth+1);}while(!pop());i=j;break;}
 default:if(raw.startsWith('."'))output+=raw.slice(2,-1).replace(/^ /,'');else throw Error('Unknown Forth word: '+raw);}
 need(output.length<=100000,'Output limit exceeded');}}
 run(tokens);out(output);}
function lisp(source){const matches=source.match(/;[^\n]*|"(?:\\.|[^"\\])*"|[()']|[^\s()']+/g)||[],tokens=matches.filter(t=>!t.startsWith(';'));let at=0,steps=0,printed=false;
 const symbol=name=>({symbol:name}),isSym=x=>x&&typeof x==='object'&&!Array.isArray(x)&&'symbol'in x;
 function read(){const t=tokens[at++];need(t!==undefined,'Unexpected end of input');if(t==='('){const a=[];while(tokens[at]!==')'){need(at<tokens.length,'Unclosed list');a.push(read());}at++;return a;}if(t===')')throw Error('Unexpected )');if(t==="'")return[symbol('quote'),read()];if(t[0]==='"')return JSON.parse(t);if(/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(t))return+t;if(t==='#t')return true;if(t==='#f')return false;return symbol(t);}
 const env=(parent=null)=>({values:new Map(),parent}),global=env(),get=(e,k)=>e.values.has(k)?e.values.get(k):e.parent?get(e.parent,k):(()=>{throw Error('Unbound symbol '+k);})();
 const repr=x=>Array.isArray(x)?'('+x.map(repr).join(' ')+')':isSym(x)?x.symbol:x===true?'#t':x===false?'#f':String(x);
 const builtins={'+':(...a)=>a.reduce((x,y)=>x+y,0),'-':(a,...b)=>b.length?b.reduce((x,y)=>x-y,a):-a,'*':(...a)=>a.reduce((x,y)=>x*y,1),'/':(a,...b)=>b.reduce((x,y)=>{need(y!==0,'Division by zero');return x/y;},a),'=':(a,b)=>a===b,'<':(a,b)=>a<b,'>':(a,b)=>a>b,'<=':(a,b)=>a<=b,'>=':(a,b)=>a>=b,'not':a=>a===false,'list':(...a)=>a,'car':a=>{need(Array.isArray(a)&&a.length,'car needs a nonempty list');return a[0];},'cdr':a=>{need(Array.isArray(a),'cdr needs a list');return a.slice(1);},'cons':(a,b)=>{need(Array.isArray(b),'cons supports proper lists only');return[a,...b];},'length':a=>a.length,'null?':a=>Array.isArray(a)&&!a.length,'number?':a=>typeof a==='number','symbol?':isSym,'list?':Array.isArray,'append':(...a)=>a.flat(),'display':a=>{out(typeof a==='string'?a:repr(a));printed=true;return undefined;},'print':a=>{out(repr(a));printed=true;return undefined;},'newline':()=>{out('');printed=true;},'abs':Math.abs,'sqrt':Math.sqrt,'modulo':(a,b)=>a%b};for(const[k,v]of Object.entries(builtins))global.values.set(k,v);
 function evaluate(x,e,depth=0){need(++steps<1000000&&depth<200,'Evaluation/depth limit exceeded');if(isSym(x))return get(e,x.symbol);if(!Array.isArray(x))return x;if(!x.length)return[];const op=isSym(x[0])?x[0].symbol:'';const ev=a=>evaluate(a,e,depth+1),seq=(a,en=e)=>{let v;for(const n of a)v=evaluate(n,en,depth+1);return v;};
 if(op==='quote'){need(x.length===2,'quote takes one argument');return x[1];}if(op==='if'){need(x.length===3||x.length===4,'if takes 2 or 3 arguments');return ev(x[1])!==false?ev(x[2]):x.length===4?ev(x[3]):undefined;}if(op==='begin')return seq(x.slice(1));
 const closure=(params,body,scope)=>(...args)=>{need(args.length===params.length,'Wrong number of arguments');const local=env(scope);params.forEach((p,i)=>{need(isSym(p),'Invalid parameter');local.values.set(p.symbol,args[i]);});return seq(body,local);};
 if(op==='lambda'){need(Array.isArray(x[1]),'Expected parameter list');return closure(x[1],x.slice(2),e);}if(op==='define'||op==='defun'){if(Array.isArray(x[1])){const[name,...params]=x[1];e.values.set(name.symbol,closure(params,x.slice(2),e));}else if(op==='defun'){e.values.set(x[1].symbol,closure(x[2],x.slice(3),e));}else{need(isSym(x[1]),'Invalid definition');e.values.set(x[1].symbol,ev(x[2]));}return undefined;}
 if(op==='let'){need(Array.isArray(x[1]),'Expected bindings');const local=env(e);for(const pair of x[1])local.values.set(pair[0].symbol,ev(pair[1]));return seq(x.slice(2),local);}if(op==='set!'){let scope=e,key=x[1].symbol;while(scope&&!scope.values.has(key))scope=scope.parent;need(scope,'Unbound variable '+key);scope.values.set(key,ev(x[2]));return undefined;}
 if(op==='and'){let v=true;for(const a of x.slice(1)){v=ev(a);if(v===false)break;}return v;}if(op==='or'){for(const a of x.slice(1)){const v=ev(a);if(v!==false)return v;}return false;}
 const fn=ev(x[0]);need(typeof fn==='function','Not a function');return fn(...x.slice(1).map(ev));}
 let result;while(at<tokens.length)result=evaluate(read(),global);if(result!==undefined)out(repr(result));else if(!printed)out('(no value)');}
function validateCssLexically(source) {
 const stack=[];let quote='',comment=false;
 for(let i=0;i<source.length;i++){const c=source[i],next=source[i+1];
  if(comment){if(c==='*'&&next==='/'){comment=false;i++;}continue;}
  if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote='';else need(c!=='\n'&&c!=='\r','Unescaped newline in CSS string');continue;}
  if(c==='/'&&next==='*'){comment=true;i++;continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='\\'){i++;continue;}
  if('({['.includes(c))stack.push(c);else if(')}]'.includes(c))need(stack.pop()==={')':'(','}':'{',']':'['}[c],'Unbalanced CSS delimiters');
 }need(!quote&&!comment&&!stack.length,'Unterminated CSS string, comment, or delimiter');
}

async function runHaskell(code) {
  self.window = self;
  if (typeof self.JSHC === 'undefined') importScripts(V + 'haskell/jshc.js');
  const res = self.JSHC.runHaskell(code);
  if (res !== '') out(res);
}

self.onmessage=async({data:d})=>{emitted=0;try{const {op,code='',input='',options={}}=d;need(code.length<=1000000,'Input limit exceeded (1 MB)');let value;
 switch(op){
 case'javascript':case'nodejs':case'typescript':case'coffeescript':{
   let js=code;
   if(op==='typescript'){importScripts(V+'typescript.js');const result=ts.transpileModule(code,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}});const errors=result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error);need(!errors?.length,errors?.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));js=result.outputText;}
   if(op==='coffeescript'){const coffee=await import(V+'coffeescript.js');js=coffee.default.compile(code,{bare:true});}
   const original=console;self.console={...original,log:out,info:out,warn:(...a)=>out('Warning:',...a),error:(...a)=>out('Error:',...a),debug:out,clear:()=>{}};
   const hadProcess='process'in self;
   if(op==='nodejs'){self.process={argv:['node','main.js'],env:{},version:'v22.0.0',platform:'browser',stdout:{write:s=>out(String(s).replace(/\n$/,''))}};}
   try{const fn=new Function('input','"use strict";\n'+js+'\n//# sourceURL=codehub-user.js');value=await fn(input);if(value!==undefined)out(value);}
   finally{self.console=original;if(op==='nodejs'&&!hadProcess)delete self.process;}
   break;
 }
 case'luau':{
   const {LuauState}=await import(V+'luau/index.js');
   const state=await LuauState.createAsync({print:(...a)=>out(...a),warn:(...a)=>out('Warning:',...a),input});
   try{const fn=state.loadstring(code,'main.luau',true);if(typeof fn==='function')await fn();else if(fn!==undefined)out(fn);}finally{state.destroy();}
   break;
 }
 case'haskell':{await runHaskell(code);break;}
 case'ruby':case'erb':{
   self.window=self;
   if(typeof self.Opal==='undefined')importScripts(V+'ruby/opal.js',V+'ruby/pathname.js',V+'ruby/stringio.js',V+'ruby/opal-builder.js');
   Opal.require('opal-builder');
   let rbCode=code;
   if(op==='erb'){
     const ctxJson=input.trim()?JSON.parse(input):{};
     const parts=['data = '+JSON.stringify(ctxJson),'__erb = []'];
     let last=0;
     for(const m of code.matchAll(/<%([=-]?)([\s\S]*?)%>/g)){
       const lit=code.slice(last,m.index);
       if(lit)parts.push('__erb << '+JSON.stringify(lit));
       if(m[1]==='=')parts.push('__erb << ('+m[2].trim()+').to_s');
       else parts.push(m[2]);
       last=m.index+m[0].length;
     }
     const tail=code.slice(last);
     if(tail)parts.push('__erb << '+JSON.stringify(tail));
     parts.push('puts __erb.join("")');
     rbCode=parts.join('\n');
   }
   const Builder=Opal.const_get_qualified(Opal.const_get_relative([],'Opal'),'Builder');
   const built=Builder.$new().$build_str(rbCode,'main.rb').$to_s();
   let rbuf='';
   Opal.gvars.stdout['$write_proc='](s=>{rbuf+=String(s);});
   const origLog=console.log;self.console={...console,log:(...a)=>out(...a)};
   try{(0,eval)(built);}finally{self.console.log=origLog;}
   if(rbuf)out(rbuf.replace(/\n$/,''));
   break;
 }
 case'php':{
   self.window=self;
   if(typeof self.document==='undefined')self.document={querySelector:()=>null,getElementById:()=>null,createElement:()=>({style:{}}),currentScript:null};
   const {default:PHP}=await import(V+'php/php8.3-web.mjs');
   const outBytes=[],errBytes=[];
   const php=await PHP({
     locateFile:p=>V+'php/'+p,
     stdin:()=>null,
     stdout:b=>{if(b!==null&&b!==undefined)outBytes.push(b);},
     stderr:b=>{if(b!==null&&b!==undefined)errBytes.push(b);}
   });
   await php.ccall('pib_storage_init','number',[],[],{async:true});
   await php.ccall('pib_init','number',['string'],['embed'],{async:true});
   const src=/^\s*<\?php(?=[ \t\r\n]|$)/i.test(code)?'     '+code.trimStart().slice(5):'?>'+code;
   await php.ccall('pib_run','number',['string'],[src],{async:true});
   await php.ccall('pib_flush','number',[],[],{async:true});
   const dec=new TextDecoder();
   const pOut=dec.decode(new Uint8Array(outBytes)).replace(/\n$/,'');
   const pErr=dec.decode(new Uint8Array(errBytes)).replace(/\n$/,'');
   if(pOut)out(pOut);
   if(pErr)out('stderr: '+pErr);
   break;
 }
 case'c':case'cpp':{
   if(typeof self.JSCPP==='undefined')importScripts(V+'jscpp.js');
   let cbuf='';
   const exitCode=JSCPP.run(code,input,{stdio:{write:s=>{cbuf+=s;}}});
   if(cbuf)out(cbuf.replace(/\n$/,''));
   value=exitCode;
   break;
 }
 case'clojure':case'clojurescript':{
   self.window=self;self.document={querySelectorAll:()=>[],addEventListener:()=>{},getElementById:()=>null,currentScript:null};
   if(typeof self.scittle==='undefined')importScripts(V+'scittle.js');
   scittle.core.eval_string('(def __bite_out (atom ""))');
   const val=scittle.core.eval_string(`(binding [*print-fn* (fn [s] (swap! __bite_out str s))] ${code})`);
   const printed=scittle.core.eval_string('@__bite_out');
   if(printed)out(printed.replace(/\n$/,''));
   if(val!==undefined&&val!==null&&!printed)out(String(val));
   break;
 }
 case'prolog':{
   self.global=self;self.window=self;self.document={getElementById:()=>null,currentScript:null};
   if(typeof self.TauProlog==='undefined')importScripts(V+'tau-prolog.js');
   const lines=code.split('\n');
   const qLines=lines.filter(l=>/^\s*\?-/.test(l));
   const kb=lines.filter(l=>!/^\s*\?-/.test(l)).join('\n')+'\n';
   const queryText=(input.trim()||qLines.map(l=>l.replace(/^\s*\?-\s*/,'')).join(' ')||'true.').trim();
   const session=TauProlog.create(10000);
   await new Promise((resolve,reject)=>{
     session.consult(kb,{
       success(){
         session.query(queryText.endsWith('.')?queryText:queryText+'.',{
           success(){session.answers(ans=>{if(ans===false)resolve();else out(TauProlog.format_answer(ans));},50,()=>resolve());},
           error(e){reject(Error(typeof e==='string'?e:e?.message||TauProlog.format_answer(e)||String(e)));}
         });
       },
       error(e){reject(Error(typeof e==='string'?e:e?.message||TauProlog.format_answer(e)||String(e)));}
     });
   });
   break;
 }
 case'wasm':case'wat':{
   if(typeof self.WabtModule==='undefined')importScripts(V+'wabt.js');
   const wabt=await WabtModule();
   const mod=wabt.parseWat('main.wat',code);
   const {buffer}=mod.toBinary({write_debug_names:true});
   const {instance}=await WebAssembly.instantiate(buffer,{env:{print:v=>out(v),log:v=>out(v)}});
   const fns=Object.entries(instance.exports).filter(([,v])=>typeof v==='function');
   if(fns.length){
     const args=input.trim()?input.trim().split(/[\s,]+/).map(Number):[];
     const mainFn=instance.exports.main||instance.exports.add||fns[0][1];
     const name=instance.exports.main?'main':instance.exports.add?'add':fns[0][0];
     out(`${name}(${args.join(', ')}) => ${mainFn(...args)}`);
   } else out('Compiled WASM module ('+buffer.byteLength+' bytes).');
   break;
 }
 case'jq':{
   self.document={currentScript:{src:V+'jq/jq.js'}};
   if(typeof self.jq==='undefined')importScripts(V+'jq/jq.js');
   const jqInst=typeof jq==='function'?await jq():await jq;
   const jsonIn=input.trim()?JSON.parse(input):{hello:'world',nums:[1,2,3,4,5]};
   const res=await jqInst.raw(JSON.stringify(jsonIn),code,['-c']);
   out(res);
   break;
 }
 case'tcl':{
   if(typeof self.TclJS==='undefined')importScripts(V+'tcl.js');
   const interp=new TclJS.Tcl();
   let tbuf='';
   interp.getIO().write=(ch,s)=>{tbuf+=s;};
   await interp.run(code);
   if(tbuf)out(tbuf.replace(/\n$/,''));
   break;
 }
 case'sass':case'scss':{
   if(typeof self.DartSass==='undefined')importScripts(V+'sass.js');
   const res=DartSass.compileString(code);
   out(res.css);
   break;
 }
 case'yaml':{importScripts(V+'markup-bundle.js');out(JSON.stringify(MarkupTools.yaml.load(code),null,2));break;}
 case'toml':{importScripts(V+'markup-bundle.js');out(JSON.stringify(MarkupTools.toml.parse(code),null,2));break;}
 case'markdown':{importScripts(V+'markup-bundle.js');out(MarkupTools.marked.parse(code));break;}
 case'xml':{importScripts(V+'markup-bundle.js');const v=MarkupTools.XMLValidator.validate(code);need(v===true,v.err?.msg||'Invalid XML');out(JSON.stringify(new MarkupTools.XMLParser({ignoreAttributes:false}).parse(code),null,2));break;}
 case'handlebars':{importScripts(V+'markup-bundle.js');const data=input.trim()?JSON.parse(input):{};out(MarkupTools.Handlebars.compile(code)(data));break;}
 case'ejs':{importScripts(V+'markup-bundle.js');const data=input.trim()?JSON.parse(input):{};out(MarkupTools.ejs.render(code,data));break;}
 case'css':{importScripts(V+'csstree.js');validateCssLexically(code);const ast=csstree.parse(code);out(csstree.generate(ast));break;}
 case'bash':case'sh':{const base=V+'bashkit/';const glue=await import(base+'bashkit_wasm.js');const init=glue.default;await init({module_or_path:base+'bashkit_wasm_bg.wasm'});const {Bash}=await import(base+'index.js');const shell=new Bash();try{const result=await shell.execute(code,{capture:100000});if(result.stderr)out('stderr: '+result.stderr);if(result.stdout)out(result.stdout.replace(/\n?$/,'\n'));value=result.exitCode;if(result.exitCode!==0)throw Error(`Bash exited with code ${result.exitCode}`);}finally{shell.cancel();}break;}
 case'python':{value=await new Promise((resolve,reject)=>{const child=new Worker(new URL('./python-worker.js',self.location.href),{type:'module'});child.onmessage=({data:d})=>{if(d.type==='log')out(d.text);else{child.terminate();d.type==='error'?reject(Error(d.text)):resolve(d.value);}};child.onerror=e=>{child.terminate();reject(Error(e.message));};child.postMessage({code,input});});break;}
 case'lua':{importScripts(V+'fengari.js');const {lua,lauxlib,lualib,to_luastring,to_jsstring}=fengari;const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);lua.lua_pushcfunction(L,L=>{const a=[];for(let i=1;i<=lua.lua_gettop(L);i++){const s=lauxlib.luaL_tolstring(L,i);a.push(to_jsstring(s));lua.lua_pop(L,1);}out(...a);return 0;});lua.lua_setglobal(L,to_luastring('print'));lua.lua_pushstring(L,to_luastring(input));lua.lua_setglobal(L,to_luastring('input'));let status=lauxlib.luaL_loadstring(L,to_luastring(code));if(status===lua.LUA_OK)status=lua.lua_pcall(L,0,lua.LUA_MULTRET,0);need(status===lua.LUA_OK,lua.lua_tojsstring(L,-1)||'Lua error');break;}
 case'sql':{importScripts(V+'sql-wasm.js');const SQL=await initSqlJs({locateFile:n=>V+n});const db=new SQL.Database();try{value=db.exec(code);out(JSON.stringify(value,null,2));}finally{db.close();}break;}
 case'json':value=JSON.parse(code);out(JSON.stringify(value,null,2));break;
 case'brainfuck':brain(code,input);break;case'boolfuck':brain(code.replace(/[^<>+,;\[\]]/g,''),input,true);break;
 case'ook':{const tokens=code.match(/Ook[.!?]/g)||[];need(tokens.length%2===0,'Ook needs pairs of Ook tokens');const map={'Ook.Ook?':'>','Ook?Ook.':'<','Ook.Ook.':'+','Ook!Ook!':'-','Ook!Ook.':'.','Ook.Ook!':',','Ook!Ook?':'[','Ook?Ook!':']'};let bf='';for(let i=0;i<tokens.length;i+=2){const c=map[tokens[i]+tokens[i+1]];need(c,'Invalid Ook pair');bf+=c;}brain(bf,input);break;}
 case'whitespace':whitespace(code,input);break;case'befunge':befunge(code,input);break;case'basic':basic(code,input);break;case'forth':forth(code);break;case'lisp':case'scheme':case'racket':lisp(code);break;
 case'regex':{need(code.length<=100000,'Regex text limit: 100,000 characters');const flags=options.flags||'',pattern=options.pattern||'';need(pattern.length<=10000,'Pattern limit exceeded');const re=new RegExp(pattern,flags);const matches=[];let m;while((m=re.exec(code))){matches.push({index:m.index,match:m[0],groups:m.slice(1),named:m.groups??null});if(matches.length>=1000)break;if(!re.global&&!re.sticky)break;if(m[0]===''){const p=re.lastIndex;re.lastIndex+=re.unicode&&code.codePointAt(p)>65535?2:1;}}value={matches,capped:matches.length===1000};if(options.replace)value.replaced=code.replace(new RegExp(pattern,flags),options.replacement||'');break;}
 case'js-format':importScripts(V+'prettier.js',V+'prettier-babel.js',V+'prettier-estree.js',V+'prettier-typescript.js');value=await prettier.format(code,{parser:options.typescript?'typescript':'babel',plugins:prettierPlugins,tabWidth:2,semi:true});break;
 case'css-minify':{importScripts(V+'csstree.js');const errors=[];validateCssLexically(code);const ast=csstree.parse(code,{onParseError:e=>errors.push(e.formattedMessage||e.message)});need(!errors.length,errors.join('\n'));value=csstree.generate(ast);break;}
 case'sql-format':importScripts(V+'sql-formatter.js');value=sqlFormatter.format(code,{language:options.dialect||'sql',keywordCase:'upper',tabWidth:2});break;
 default:throw Error('Runtime unavailable: '+op);
 }postMessage({type:'done',value});}catch(e){postMessage({type:'error',text:e?.stack||String(e)});}};
