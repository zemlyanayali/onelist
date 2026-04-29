import { useState, useEffect, useRef, useCallback } from "react";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SB_URL = 'https://fkffanvwmkswjukjjenp.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZmZhbnZ3bWtzd2p1a2pqZW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjM0MjEsImV4cCI6MjA5Mjg5OTQyMX0.Vu2t3TuJ3U7ts9DDIoH3mV42oAGwRm-xaSXp_nP6aiw';

const sbHdr = (token, extra={}) => ({ apikey: SB_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra });

// ── Auth ──────────────────────────────────────────────────────────────────────
async function sbSignIn(email, password) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method:'POST', headers:{ apikey:SB_KEY, 'Content-Type':'application/json' },
    body: JSON.stringify({ email, password })
  });
  const d = await r.json();
  if (d.error || d.error_description) throw new Error(d.error_description || d.error);
  return { access_token:d.access_token, refresh_token:d.refresh_token, user_id:d.user.id, email:d.user.email };
}

async function sbSignUp(email, password) {
  const r = await fetch(`${SB_URL}/auth/v1/signup`, {
    method:'POST', headers:{ apikey:SB_KEY, 'Content-Type':'application/json' },
    body: JSON.stringify({ email, password })
  });
  const d = await r.json();
  if (d.error || d.error_description) throw new Error(d.error_description || d.error);
  if (!d.access_token) throw new Error('Check your email to confirm your account, then sign in.');
  return { access_token:d.access_token, refresh_token:d.refresh_token, user_id:d.user.id, email:d.user.email };
}

async function sbSignOut(token) {
  try { await fetch(`${SB_URL}/auth/v1/logout`, { method:'POST', headers: sbHdr(token) }); } catch {}
}

async function sbRefresh(refresh_token) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
    method:'POST', headers:{ apikey:SB_KEY, 'Content-Type':'application/json' },
    body: JSON.stringify({ refresh_token })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error_description || d.error);
  return { access_token:d.access_token, refresh_token:d.refresh_token, user_id:d.user.id, email:d.user.email };
}

// ── Data ──────────────────────────────────────────────────────────────────────
async function sbLoad(token, userId) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/user_data?user_id=eq.${userId}&select=id,payload&limit=1`, { headers: sbHdr(token) });
    const rows = await r.json();
    return rows[0] || null;
  } catch { return null; }
}

async function sbSave(token, userId, rowId, payload) {
  try {
    if (rowId) {
      await fetch(`${SB_URL}/rest/v1/user_data?id=eq.${rowId}`, {
        method:'PATCH', headers: sbHdr(token),
        body: JSON.stringify({ payload, updated_at: new Date().toISOString() })
      });
      return rowId;
    } else {
      const r = await fetch(`${SB_URL}/rest/v1/user_data`, {
        method:'POST', headers: sbHdr(token, { Prefer:'return=representation' }),
        body: JSON.stringify({ user_id:userId, payload, updated_at: new Date().toISOString() })
      });
      const rows = await r.json();
      return rows[0]?.id || null;
    }
  } catch { return rowId; }
}

const COLORS = ['#3B82F6','#EC4899','#059669','#D97706','#7C3AED','#EA580C','#0891B2','#E11D48','#65A30D','#9333EA','#0EA5E9','#F59E0B'];
const EMOJIS = ['💼','🏠','🚀','📚','🎯','💡','🛒','🏋️','🎨','📱','💰','🌿','✈️','🔬','🎵','🍕','🧘','💻','🎮','🏆'];
const RECUR  = [{v:'',l:'No repeat'},{v:'daily',l:'Daily'},{v:'weekly',l:'Weekly'},{v:'monthly',l:'Monthly'},{v:'custom',l:'Custom…'}];
const genId  = () => '_' + Math.random().toString(36).slice(2,9);
const hl     = h => h + '18';
const hm     = h => h + '30';
const fmtD   = d => d.toLocaleDateString('en-AU',{weekday:'short',month:'short',day:'numeric'});

const DEFAULTS = {
  projects:[
    {id:'p1',name:'Work',color:'#3B82F6',emoji:'💼'},
    {id:'p2',name:'Life',color:'#059669',emoji:'🏠'},
    {id:'p3',name:'My Projects',color:'#7C3AED',emoji:'🚀'},
  ],
  tasks:[
    {id:'t1',title:'Review Q4 reports',projectId:'p1',subtasks:[{id:'s1',title:'Finance report',done:false},{id:'s2',title:'Sales figures',done:false}],done:false,inToday:true,pinned:false,pinTop:false,archived:false,completedAt:null,createdAt:1000,notes:'',recur:''},
    {id:'t2',title:'Prepare client proposal',projectId:'p1',subtasks:[],done:false,inToday:false,pinned:false,pinTop:false,archived:false,completedAt:null,createdAt:900,notes:'',recur:''},
    {id:'t3',title:'Morning run 5km',projectId:'p2',subtasks:[],done:true,inToday:true,pinned:false,pinTop:false,archived:false,completedAt:Date.now()-3600000,createdAt:800,notes:'',recur:'daily'},
    {id:'t4',title:'Build MVP landing page',projectId:'p3',subtasks:[{id:'s3',title:'Design layout',done:true},{id:'s4',title:'Write copy',done:false},{id:'s5',title:'Add contact form',done:false}],done:false,inToday:true,pinned:false,pinTop:false,archived:false,completedAt:null,createdAt:700,notes:'',recur:''},
    {id:'t5',title:'Grocery shopping',projectId:null,subtasks:[{id:'s6',title:'Milk & eggs',done:false},{id:'s7',title:'Vegetables',done:false}],done:false,inToday:false,pinned:false,pinTop:false,archived:false,completedAt:null,createdAt:600,notes:'',recur:''},
    {id:'t6',title:'Pay electricity bill',projectId:null,subtasks:[],done:false,inToday:false,pinned:false,pinTop:false,archived:false,completedAt:null,createdAt:500,notes:'',recur:'monthly'},
  ],
  archived:[],
  lastReset:new Date().toDateString(),
  todayOrder:['t1','t3','t4'],
  dashboardLayout:['projects','alltasks','calendar'],
  settings:{resetHour:3,displayName:''},
};
const BLANK = {title:'',projectId:'',notes:'',subtasks:[],inToday:false,pinned:false,pinTop:false,recur:'',customRecur:''};

function Chk({done,color,onClick,size=22}){
  return (
    <div onClick={onClick} style={{width:size,height:size,borderRadius:'50%',border:done?'none':'2px solid #ccc',background:done?(color||'#34C759'):'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'all .18s',fontSize:size*.5,color:'white',userSelect:'none'}}>
      {done ? '✓' : null}
    </div>
  );
}

function Lbl({children}){
  return <label style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',display:'block',marginBottom:6,color:'#888'}}>{children}</label>;
}

function TaskCard({task,T,dm,getProj,projects,expTask,setExpTask,toggleDone,toggleSub,addToToday,delTask,openEdit,moveTask,onRename,toggleTaskProject,togglePinTop}){
  const proj=task.projectId?getProj(task.projectId):null;
  const exp=expTask[task.id];
  const hasSubs=(task.subtasks||[]).length>0;
  const [editing,setEditing]=useState(false);
  const [editVal,setEditVal]=useState(task.title);
  const inputRef=useRef(null);

  const startEdit=e=>{
    e.stopPropagation();
    if(task.done)return;
    setEditVal(task.title);
    setEditing(true);
    setTimeout(()=>inputRef.current?.focus(),0);
  };

  const commitEdit=()=>{
    if(editVal.trim()&&editVal.trim()!==task.title)onRename(task.id,editVal.trim());
    setEditing(false);
  };

  return (
    <div
      draggable={!editing}
      onDragStart={e=>{if(editing){e.preventDefault();return;}e.dataTransfer.setData('taskId',task.id);e.dataTransfer.setData('fromProject',task.projectId||'misc');}}
      style={{background:T.sur,border:`1px solid ${T.brd}`,borderRadius:12,padding:'11px 14px',marginBottom:8,borderLeft:`3px solid ${proj?.color||T.brd}`,transition:'box-shadow .15s',cursor:editing?'text':'grab'}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow=dm?'0 2px 16px rgba(0,0,0,.4)':'0 2px 16px rgba(0,0,0,.06)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
        <Chk done={task.done} color={proj?.color} onClick={e=>{e.stopPropagation();toggleDone(task.id);}}/>
        <div style={{flex:1,minWidth:0}}>
          {editing?(
            <input
              ref={inputRef}
              value={editVal}
              onChange={e=>setEditVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e=>{if(e.key==='Enter')commitEdit();if(e.key==='Escape'){setEditing(false);}}}
              style={{width:'100%',background:'transparent',border:'none',borderBottom:`1.5px solid ${proj?.color||'#FF6B35'}`,fontSize:14,fontWeight:500,color:T.txt,fontFamily:'inherit',outline:'none',padding:'1px 0',lineHeight:1.4}}
            />
          ):(
            <div style={{display:'flex',alignItems:'baseline',gap:6,minWidth:0}}>
              <span
                onClick={startEdit}
                title="Click to rename"
                style={{fontSize:14,fontWeight:500,color:task.done?T.txt3:T.txt,textDecoration:task.done?'line-through':'none',lineHeight:1.4,cursor:task.done?'default':'text',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
              >{task.title}</span>
              {hasSubs&&<span onClick={e=>{e.stopPropagation();setExpTask(p=>({...p,[task.id]:!p[task.id]}));}} style={{fontSize:11,color:T.txt3,fontWeight:400,flexShrink:0,cursor:'pointer'}}>{task.subtasks.filter(s=>s.done).length}/{task.subtasks.length} {exp?'▲':'▼'}</span>}
              {task.recur&&<span style={{fontSize:10,color:T.txt3,flexShrink:0}}>🔁 {task.recur}</span>}
            </div>
          )}
          {exp&&hasSubs&&(
            <div style={{marginTop:8,paddingLeft:2}}>
              {task.subtasks.map(s=>(
                <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0'}}>
                  <div onClick={()=>toggleSub(task.id,s.id)} style={{width:16,height:16,borderRadius:4,border:s.done?'none':`1.5px solid ${T.brd}`,background:s.done?(proj?.color||'#34C759'):'transparent',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'white'}}>{s.done&&'✓'}</div>
                  <span style={{fontSize:12,color:s.done?T.txt3:T.txt2,textDecoration:s.done?'line-through':'none'}}>{s.title}</span>
                </div>
              ))}
            </div>
          )}
          {task.notes&&!exp&&<div style={{fontSize:11,color:T.txt3,marginTop:3,fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{task.notes}</div>}
        </div>
        <div style={{display:'flex',gap:4,flexShrink:0,opacity:.6}} onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='.6'}>
          {/* Project dots */}
          {projects&&projects.map(p=>{
            const active=task.projectId===p.id;
            return(
              <div key={p.id} onClick={()=>toggleTaskProject&&toggleTaskProject(task.id,p.id)} title={p.name} style={{width:14,height:14,borderRadius:'50%',background:active?p.color:'transparent',border:`2px solid ${p.color}`,cursor:'pointer',flexShrink:0,transition:'all .15s'}}/>
            );
          })}
          {projects&&projects.length>0&&<div style={{width:1,background:T.brd,margin:'0 2px'}}/>}
          {/* Section pin — pins to top of this section, not Today */}
          {togglePinTop&&<button onClick={()=>togglePinTop(task.id)} title={task.pinTop?'Unpin from section top':'Pin to top of section'} style={{width:26,height:26,borderRadius:6,border:`1px solid ${task.pinTop?'#FF6B35':T.brd}`,background:task.pinTop?'#FF6B3512':T.sur2,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',color:task.pinTop?'#FF6B35':T.txt3}}>📌</button>}
          <button onClick={()=>openEdit(task)} title="Edit details" style={{width:26,height:26,borderRadius:6,border:`1px solid ${T.brd}`,background:T.sur2,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',color:T.txt2}}>✎</button>
          {!task.inToday&&<button onClick={()=>addToToday(task.id)} title="Add to Today" style={{width:26,height:26,borderRadius:6,border:`1px solid ${T.brd}`,background:T.sur2,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>☆</button>}
          <button onClick={()=>delTask(task.id)} title="Delete" style={{width:26,height:26,borderRadius:6,border:`1px solid ${T.brd}`,background:T.sur2,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',color:'#FF3B30'}}>✕</button>
        </div>
      </div>
    </div>
  );
}


export default function OneList(){
  const TODAY=new Date();
  const [data,setData]=useState(null);
  const [session,setSession]=useState(null);
  const [authView,setAuthView]=useState('login');
  const [authForm,setAuthForm]=useState({email:'',password:''});
  const [authErr,setAuthErr]=useState('');
  const [authLoad,setAuthLoad]=useState(false);
  const [loading,setLoading]=useState(true);
  const [dm,setDm]=useState(false);
  const [view,setView]=useState('dashboard');
  const [modal,setModal]=useState(null);
  const [sbOpen,setSbOpen]=useState(true);
  const [calMin,setCalMin]=useState(false);  // calendar open by default
  const [expProj,setExpProj]=useState({});
  const [expTask,setExpTask]=useState({});
  const [expToday,setExpToday]=useState({});
  const [hovPin,setHovPin]=useState(null);
  const [calMo,setCalMo]=useState(TODAY.getMonth());
  const [calYr,setCalYr]=useState(TODAY.getFullYear());
  const [calView,setCalView]=useState('month');
  const [quickAdd,setQuickAdd]=useState('');
  const [taskForm,setTaskForm]=useState(BLANK);
  const [subIn,setSubIn]=useState('');
  const [editTid,setEditTid]=useState(null);
  const [projForm,setProjForm]=useState({name:'',emoji:'📁',color:'#3B82F6'});
  const [editPid,setEditPid]=useState(null);
  const [listening,setListening]=useState(false);
  const [transcript,setTranscript]=useState('');
  const [parsed,setParsed]=useState(null);
  const [vLoad,setVLoad]=useState(false);
  const [srchQ,setSrchQ]=useState('');
  const [dragId,setDragId]=useState(null);
  const [dragOv,setDragOv]=useState(null);
  const [dragTask,setDragTask]=useState(null);
  const [dragProjId,setDragProjId]=useState(null);
  const [dragProjOver,setDragProjOver]=useState(null);
  const [showPwd,setShowPwd]=useState(false);
  const [inlineAdd,setInlineAdd]=useState({});
  const [showMobileToday,setShowMobileToday]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [showAccount,setShowAccount]=useState(false);
  const [confetti,setConfetti]=useState(false);
  const [dragSection,setDragSection]=useState(null);
  const [dragSectionOver,setDragSectionOver]=useState(null);
  const prevActiveRef=useRef(null);
  const recRef  = useRef(null);
  const dbRowId = useRef(null); // tracks Supabase row id

  // load — check saved session first, then load data
  useEffect(()=>{
    (async()=>{
      // ── Handle email confirmation redirect (Supabase puts tokens in URL hash)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.slice(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token) {
          try {
            const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${access_token}` } });
            const user = await r.json();
            const sess = { access_token, refresh_token, user_id: user.id, email: user.email };
            localStorage.setItem('onelist_session', JSON.stringify(sess));
            window.history.replaceState(null, '', window.location.pathname); // clean URL
            setSession(sess);
            const row = await sbLoad(sess.access_token, sess.user_id);
            if (row?.payload) { dbRowId.current=row.id; setData(row.payload); } else setData(DEFAULTS);
            setLoading(false); return;
          } catch {}
        }
      }
      try {
        const saved = JSON.parse(localStorage.getItem('onelist_session')||'null');
        if (saved?.access_token) {
          let sess = saved;
          // try loading data; if it fails, refresh token
          let row = await sbLoad(sess.access_token, sess.user_id);
          if (!row) {
            try { sess = await sbRefresh(saved.refresh_token); localStorage.setItem('onelist_session',JSON.stringify(sess)); row = await sbLoad(sess.access_token, sess.user_id); } catch { localStorage.removeItem('onelist_session'); setLoading(false); return; }
          }
          setSession(sess);
          if (row?.payload) { dbRowId.current=row.id; setData(row.payload); }
          else setData(DEFAULTS);
          setLoading(false); return;
        }
      } catch {}
      setLoading(false); // no session → show login
    })();
  },[]);

  // save — only when logged in
  useEffect(()=>{
    if(!data||!session)return;
    (async()=>{
      try { localStorage.setItem('onelist_v3',JSON.stringify(data)); } catch {}
      try { dbRowId.current=await sbSave(session.access_token,session.user_id,dbRowId.current,data); } catch {}
    })();
  },[data]);

  useEffect(()=>{
    if(!data)return;
    const ts=TODAY.toDateString();
    const resetHour=data.settings?.resetHour??3;
    if(data.lastReset===ts||TODAY.getHours()<resetHour)return;
    setData(prev=>{
      const arch=[...prev.archived];
      const tasks=prev.tasks.map(t=>{
        if(!t.inToday)return t;
        if(t.pinned)return t;
        if(t.done){arch.push({...t,archivedAt:Date.now()});return null;}
        return{...t,inToday:false};
      }).filter(Boolean);
      return{...prev,tasks,archived:arch,lastReset:ts};
    });
  },[data?.lastReset]);

  // Confetti when all today tasks go from >0 active to 0 active
  useEffect(()=>{
    if(!data)return;
    const active=(data.tasks||[]).filter(t=>t.inToday&&!t.archived&&!t.done).length;
    const total=(data.tasks||[]).filter(t=>t.inToday&&!t.archived).length;
    if(prevActiveRef.current!==null&&prevActiveRef.current>0&&active===0&&total>0){
      setConfetti(true);
      setTimeout(()=>setConfetti(false),4000);
    }
    prevActiveRef.current=active;
  },[data]);

  useEffect(()=>{
    const h=e=>{
      if(e.target.matches('input,textarea,select'))return;
      if(e.key==='v'&&!e.metaKey&&!e.ctrlKey&&modal===null)startVoice();
      if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setModal('search');}
    };
    window.addEventListener('keydown',h);
    return()=>window.removeEventListener('keydown',h);
  },[modal]);

  const upd=fn=>setData(prev=>({...fn({...prev})}));
  const getProj=id=>data?.projects.find(p=>p.id===id);

  const todayTasks=(data?.tasks||[]).filter(t=>t.inToday&&!t.archived).sort((a,b)=>{
    if(a.done!==b.done)return a.done?1:-1;
    if(a.pinned!==b.pinned)return a.pinned?-1:1;
    const ord=data?.todayOrder||[];
    const ai=ord.indexOf(a.id),bi=ord.indexOf(b.id);
    if(ai===-1&&bi===-1)return b.createdAt-a.createdAt;
    if(ai===-1)return 1; if(bi===-1)return -1;
    return ai-bi;
  });
  const todayActive=todayTasks.filter(t=>!t.done).length;
  const currentProj=view.startsWith('project-')?getProj(view.slice(8)):null;

  const toggleDone=id=>upd(prev=>({...prev,tasks:prev.tasks.map(t=>{
    if(t.id!==id)return t;
    const done=!t.done;
    return{...t,done,inToday:done?true:t.inToday,completedAt:done?Date.now():null};
  })}));

  const toggleSub=(tid,sid)=>upd(prev=>({...prev,tasks:prev.tasks.map(t=>{
    if(t.id!==tid)return t;
    const subs=t.subtasks.map(s=>s.id===sid?{...s,done:!s.done}:s);
    const allDone=subs.length>0&&subs.every(s=>s.done);
    return{...t,subtasks:subs,done:allDone||t.done,inToday:allDone&&!t.inToday?true:t.inToday,completedAt:(allDone||t.done)?(t.completedAt||Date.now()):null};
  })}));

  const togglePin=id=>upd(prev=>({...prev,tasks:prev.tasks.map(t=>t.id===id?{...t,pinned:!t.pinned}:t)}));
  const togglePinTop=id=>upd(prev=>({...prev,tasks:prev.tasks.map(t=>t.id===id?{...t,pinTop:!t.pinTop}:t)}));
  const renameTask=(id,title)=>upd(prev=>({...prev,tasks:prev.tasks.map(t=>t.id===id?{...t,title}:t)}));
  const addToToday=id=>upd(prev=>({...prev,tasks:prev.tasks.map(t=>t.id===id?{...t,inToday:true}:t)}));
  const remFromToday=id=>upd(prev=>({...prev,tasks:prev.tasks.map(t=>t.id===id?{...t,inToday:false,pinned:false}:t)}));
  const delTask=id=>upd(prev=>({...prev,tasks:prev.tasks.filter(t=>t.id!==id)}));

  // Section-level pin sort helper
  const sortByPinTop=arr=>[...arr].sort((a,b)=>(b.pinTop?1:0)-(a.pinTop?1:0)||b.createdAt-a.createdAt);

  // All tasks (not in Today, not archived) — includes project tasks
  const allTasks=sortByPinTop((data?.tasks||[]).filter(t=>!t.archived&&!t.inToday));

  // Dashboard layout
  const dashLayout=data?.dashboardLayout||['projects','alltasks','calendar'];
  const reorderDashboard=(from,to)=>{
    upd(prev=>{
      const lay=[...(prev.dashboardLayout||['projects','alltasks','calendar'])];
      const fi=lay.indexOf(from),ti=lay.indexOf(to);
      if(fi===-1||ti===-1)return prev;
      lay.splice(fi,1);lay.splice(ti,0,from);
      return{...prev,dashboardLayout:lay};
    });
  };

  const saveTask=()=>{
    if(!taskForm.title.trim())return;
    const base={title:taskForm.title.trim(),projectId:taskForm.projectId||null,notes:taskForm.notes,subtasks:taskForm.subtasks,done:false,inToday:taskForm.inToday,pinned:taskForm.pinned,archived:false,completedAt:null,recur:taskForm.recur==='custom'?(taskForm.customRecur||'custom'):taskForm.recur};
    if(editTid){upd(prev=>({...prev,tasks:prev.tasks.map(t=>t.id===editTid?{...t,...base}:t)}));}
    else{upd(prev=>({...prev,tasks:[...prev.tasks,{id:genId(),...base,createdAt:Date.now()}]}));}
    setTaskForm(BLANK);setSubIn('');setEditTid(null);setModal(null);
  };

  const openEdit=t=>{setTaskForm({title:t.title,projectId:t.projectId||'',notes:t.notes||'',subtasks:t.subtasks||[],inToday:t.inToday,pinned:t.pinned,recur:t.recur||'',customRecur:''});setEditTid(t.id);setModal('edit-task');};
  const addSub=()=>{if(!subIn.trim())return;setTaskForm(p=>({...p,subtasks:[...p.subtasks,{id:genId(),title:subIn.trim(),done:false}]}));setSubIn('');};

  const quickAddFn=()=>{
    if(!quickAdd.trim())return;
    let pid=null;
    for(const p of(data?.projects||[]))if(quickAdd.toLowerCase().includes(p.name.toLowerCase())){pid=p.id;break;}
    upd(prev=>({...prev,tasks:[...prev.tasks,{id:genId(),title:quickAdd.trim(),projectId:pid,subtasks:[],notes:'',done:false,inToday:true,pinned:false,archived:false,completedAt:null,createdAt:Date.now(),recur:''}]}));
    setQuickAdd('');
  };

  // Inline add: section = 'misc' | projectId
  const inlineAddTask=(section,title)=>{
    if(!title.trim())return;
    const projectId=section==='misc'?null:section;
    upd(prev=>({...prev,tasks:[{id:genId(),title:title.trim(),projectId,subtasks:[],notes:'',done:false,inToday:false,pinned:false,archived:false,completedAt:null,createdAt:Date.now(),recur:''},...prev.tasks]}));
    setInlineAdd(p=>({...p,[section]:''}));
  };

  // Cross-project drag: move task to a different project
  const moveTask=(taskId, toProjectId)=>{
    upd(prev=>({...prev,tasks:prev.tasks.map(t=>t.id===taskId?{...t,projectId:toProjectId||null}:t)}));
  };

  // Reorder projects by drag
  const reorderProjects=(fromId, toId)=>{
    if(fromId===toId)return;
    upd(prev=>{
      const projs=[...prev.projects];
      const fi=projs.findIndex(p=>p.id===fromId);
      const ti=projs.findIndex(p=>p.id===toId);
      if(fi===-1||ti===-1)return prev;
      const [moved]=projs.splice(fi,1);
      projs.splice(ti,0,moved);
      return{...prev,projects:projs};
    });
  };

  // Toggle task membership in a project (for the dot UI)
  const toggleTaskProject=(taskId, projId)=>{
    upd(prev=>({...prev,tasks:prev.tasks.map(t=>{
      if(t.id!==taskId)return t;
      return{...t,projectId:t.projectId===projId?null:projId};
    })}));
  };

  // Update reset hour setting
  const setResetHour=hour=>{
    upd(prev=>({...prev,settings:{...(prev.settings||{}),resetHour:hour}}));
  };

  const saveProj=()=>{
    if(!projForm.name.trim())return;
    if(editPid){upd(prev=>({...prev,projects:prev.projects.map(p=>p.id===editPid?{...p,...projForm}:p)}));}
    else{upd(prev=>({...prev,projects:[...prev.projects,{id:genId(),...projForm,name:projForm.name.trim()}]}));}
    setProjForm({name:'',emoji:'📁',color:'#3B82F6'});setEditPid(null);setModal(null);
  };

  const delProj=id=>{
    upd(prev=>({...prev,projects:prev.projects.filter(p=>p.id!==id),tasks:prev.tasks.map(t=>t.projectId===id?{...t,projectId:null}:t)}));
    setModal(null);setEditPid(null);
    if(view===`project-${id}`)setView('dashboard');
  };

  const startVoice=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert('Voice needs Chrome or Edge.');return;}
    recRef.current=new SR();
    recRef.current.continuous=false;recRef.current.interimResults=true;recRef.current.lang='en-AU';
    recRef.current.onresult=e=>setTranscript(Array.from(e.results).map(r=>r[0].transcript).join(''));
    recRef.current.onend=()=>setListening(false);
    recRef.current.start();
    setListening(true);setTranscript('');setParsed(null);setModal('voice');
  };
  const stopVoice=()=>{recRef.current?.stop();setListening(false);};

  const parseAI=async()=>{
    if(!transcript.trim())return;
    setVLoad(true);
    const names=(data?.projects||[]).map(p=>p.name);
    try{
      const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:400,messages:[{role:'user',content:`Extract task from: "${transcript}". Projects: ${names.join(', ')}. JSON only: {"title":"...","projectName":"or null","subtasks":["..."],"inToday":true}`}]})});
      const d=await r.json();
      const txt=d.content?.find(b=>b.type==='text')?.text||'{}';
      const p=JSON.parse(txt.replace(/```json|```/g,'').trim());
      const proj=(data?.projects||[]).find(pr=>pr.name.toLowerCase()===(p.projectName||'').toLowerCase());
      setParsed({title:p.title||transcript,projectId:proj?.id||'',subtasks:(p.subtasks||[]).map(s=>({id:genId(),title:s,done:false})),inToday:!!p.inToday});
    }catch{
      let pid='';
      for(const p of(data?.projects||[]))if(transcript.toLowerCase().includes(p.name.toLowerCase())){pid=p.id;break;}
      setParsed({title:transcript,projectId:pid,subtasks:[],inToday:transcript.toLowerCase().includes('today')});
    }
    setVLoad(false);
  };

  const confirmVoice=()=>{
    if(!parsed?.title?.trim())return;
    upd(prev=>({...prev,tasks:[...prev.tasks,{id:genId(),title:parsed.title.trim(),projectId:parsed.projectId||null,subtasks:parsed.subtasks||[],notes:'',done:false,inToday:parsed.inToday,pinned:false,archived:false,completedAt:null,createdAt:Date.now(),recur:''}]}));
    setTranscript('');setParsed(null);setModal(null);
  };

  const dStart=id=>setDragId(id);
  const dEnd=()=>{
    if(dragId&&dragOv&&dragId!==dragOv){
      upd(prev=>{
        const ids=prev.tasks.filter(t=>t.inToday).map(t=>t.id);
        const ord=[...(prev.todayOrder?.filter(x=>ids.includes(x))||ids)];
        const fi=ord.indexOf(dragId),ti=ord.indexOf(dragOv);
        if(fi!==-1&&ti!==-1){ord.splice(fi,1);ord.splice(ti,0,dragId);}
        return{...prev,todayOrder:ord};
      });
    }
    setDragId(null);setDragOv(null);
  };

  const srchRes=useCallback(()=>{
    if(!srchQ.trim()||!data)return[];
    const q=srchQ.toLowerCase();
    const seen=new Set(),out=[];
    for(const t of[...(data.tasks||[]),...(data.archived||[])]){
      if(seen.has(t.id))continue;seen.add(t.id);
      const proj=t.projectId?getProj(t.projectId):null;
      if(t.title.toLowerCase().includes(q)||t.subtasks?.some(s=>s.title.toLowerCase().includes(q))||proj?.name.toLowerCase().includes(q)){
        out.push({...t,_proj:proj,_arch:(data.archived||[]).some(a=>a.id===t.id)});
      }
    }
    return out.slice(0,30);
  },[srchQ,data]);

  // ── Auth handlers ────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    setAuthLoad(true); setAuthErr('');
    try {
      const sess = await sbSignIn(authForm.email, authForm.password);
      localStorage.setItem('onelist_session', JSON.stringify(sess));
      setSession(sess);
      const row = await sbLoad(sess.access_token, sess.user_id);
      if (row?.payload) { dbRowId.current=row.id; setData(row.payload); }
      else setData(DEFAULTS);
    } catch(e) { setAuthErr(e.message); }
    setAuthLoad(false);
  };

  const handleSignUp = async () => {
    if (!authForm.email||!authForm.password) { setAuthErr('Please enter email and password.'); return; }
    if (authForm.password.length < 6) { setAuthErr('Password must be at least 6 characters.'); return; }
    setAuthLoad(true); setAuthErr('');
    try {
      const sess = await sbSignUp(authForm.email, authForm.password);
      localStorage.setItem('onelist_session', JSON.stringify(sess));
      setSession(sess); setData(DEFAULTS);
    } catch(e) { setAuthErr(e.message); }
    setAuthLoad(false);
  };

  const handleSignOut = async () => {
    if (session) await sbSignOut(session.access_token);
    localStorage.removeItem('onelist_session');
    localStorage.removeItem('onelist_v3');
    setSession(null); setData(null); dbRowId.current=null;
  };

  if(loading || (session && !data)) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',fontSize:14,color:'#999',fontFamily:'system-ui'}}>Loading OneList…</div>;

  // ── Login / Signup screen ────────────────────────────────────────────────
  if (!session) return (
    <div style={{minHeight:'100vh',background:'#F7F6F3',display:'flex',alignItems:'center',justifyContent:'center',padding:20,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}`}</style>
      <div style={{width:'100%',maxWidth:400}}>
        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:36}}>
          <div style={{fontFamily:"'Lora',Georgia,serif",fontSize:32,fontWeight:700,color:'#1A1A18',letterSpacing:'-1px'}}>
            One<span style={{color:'#FF6B35'}}>List</span>
          </div>
          <div style={{fontSize:13,color:'#ABA9A3',marginTop:6}}>Many projects. One day. One list.</div>
        </div>

        {/* Card */}
        <div style={{background:'#fff',borderRadius:20,padding:32,boxShadow:'0 4px 40px rgba(0,0,0,.08)',border:'1px solid #E8E5E0'}}>
          {/* Tab toggle */}
          <div style={{display:'flex',background:'#F2F0EC',borderRadius:12,padding:4,marginBottom:28}}>
            {[['login','Sign In'],['signup','Create Account']].map(([v,l])=>(
              <button key={v} onClick={()=>{setAuthView(v);setAuthErr('');}} style={{flex:1,padding:'9px 0',borderRadius:9,border:'none',cursor:'pointer',fontSize:14,fontWeight:600,transition:'all .2s',background:authView===v?'#fff':'transparent',color:authView===v?'#1A1A18':'#ABA9A3',boxShadow:authView===v?'0 1px 4px rgba(0,0,0,.08)':'none'}}>{l}</button>
            ))}
          </div>

          {/* Fields */}
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',color:'#6A6860',display:'block',marginBottom:6}}>Email</label>
            <input type="email" value={authForm.email} onChange={e=>setAuthForm(p=>({...p,email:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&(authView==='login'?handleSignIn():handleSignUp())} placeholder="you@example.com" style={{width:'100%',background:'#F7F6F3',border:'1.5px solid #E8E5E0',borderRadius:10,padding:'11px 14px',fontSize:14,color:'#1A1A18',fontFamily:'inherit',outline:'none'}}
              onFocus={e=>e.target.style.borderColor='#FF6B35'} onBlur={e=>e.target.style.borderColor='#E8E5E0'}/>
          </div>
          <div style={{marginBottom:authErr?16:24}}>
            <label style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',color:'#6A6860',display:'block',marginBottom:6}}>Password</label>
            <div style={{position:'relative'}}>
              <input type={showPwd?'text':'password'} value={authForm.password} onChange={e=>setAuthForm(p=>({...p,password:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&(authView==='login'?handleSignIn():handleSignUp())} placeholder={authView==='signup'?'Min. 6 characters':'••••••••'} style={{width:'100%',background:'#F7F6F3',border:'1.5px solid #E8E5E0',borderRadius:10,padding:'11px 44px 11px 14px',fontSize:14,color:'#1A1A18',fontFamily:'inherit',outline:'none'}}
                onFocus={e=>e.target.style.borderColor='#FF6B35'} onBlur={e=>e.target.style.borderColor='#E8E5E0'}/>
              <button onClick={()=>setShowPwd(p=>!p)} type="button" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#ABA9A3',padding:2,lineHeight:1}}>{showPwd?'🙈':'👁'}</button>
            </div>
          </div>

          {/* Error */}
          {authErr && <div style={{background:'#FFF0ED',border:'1px solid #FFCFBF',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#CC3300',marginBottom:16}}>{authErr}</div>}

          {/* Submit */}
          <button onClick={authView==='login'?handleSignIn:handleSignUp} disabled={authLoad} style={{width:'100%',background:'#FF6B35',border:'none',borderRadius:100,padding:'13px 0',fontSize:15,fontWeight:700,color:'white',cursor:authLoad?'not-allowed':'pointer',opacity:authLoad?.7:1,transition:'opacity .2s'}}>
            {authLoad?(authView==='login'?'Signing in…':'Creating account…'):(authView==='login'?'Sign In →':'Create Account →')}
          </button>
        </div>

        <p style={{textAlign:'center',fontSize:12,color:'#ABA9A3',marginTop:20}}>
          Your data is private and encrypted. Each account is completely separate.
        </p>
      </div>
    </div>
  );

  const {projects,tasks,archived}=data;
  const T=dm
    ?{bg:'#0F0F0F',sur:'#1A1A1A',sur2:'#242424',brd:'#2E2E2E',txt:'#F0F0F0',txt2:'#A0A0A0',txt3:'#555'}
    :{bg:'#F7F6F3',sur:'#FFFFFF',sur2:'#F2F0EC',brd:'#E8E5E0',txt:'#1A1A18',txt2:'#6A6860',txt3:'#ABA9A3'};
  const SBG=dm?'#0C0C08':'#FFFEF5';
  const SBR=dm?'#2A2A14':'#EDE8C0';
  const inp={width:'100%',background:T.sur2,border:`1.5px solid ${T.brd}`,borderRadius:10,padding:'10px 14px',fontSize:14,color:T.txt,fontFamily:'inherit',outline:'none'};


  // calendar data
  const tD=TODAY.getDate(),tM=TODAY.getMonth(),tY=TODAY.getFullYear();
  const mainDays=new Date(calYr,calMo+1,0).getDate();
  const mainFirst=new Date(calYr,calMo,1).getDay();
  const mainCells=[...Array(mainFirst).fill(null),...Array.from({length:mainDays},(_,i)=>i+1)];
  const mainMName=new Date(calYr,calMo).toLocaleString('en-AU',{month:'long',year:'numeric'});
  const calIsNow=calMo===tM&&calYr===tY;
  const sow=new Date(TODAY);sow.setDate(TODAY.getDate()-TODAY.getDay());
  const weekDays=Array.from({length:7},(_,i)=>{const d=new Date(sow);d.setDate(d.getDate()+i);return d;});

  return (
    <div style={{minHeight:'100vh',background:T.bg,fontFamily:"'DM Sans',system-ui,sans-serif"}} onClick={()=>setShowAccount(false)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px;}
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(255,107,53,.4);}100%{box-shadow:0 0 0 20px rgba(255,107,53,0);}}
        @keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1;}100%{transform:translateY(100vh) rotate(720deg);opacity:0;}}
        @keyframes popIn{0%{transform:scale(.5);opacity:0;}60%{transform:scale(1.15);}100%{transform:scale(1);opacity:1;}}
        @media(max-width:768px){.sb{display:none!important;}.vfab{display:flex!important;}}
        @media(min-width:769px){.vfab{display:none!important;}}
      `}</style>

      {/* HEADER */}
      <div style={{position:'sticky',top:0,zIndex:100,background:T.sur,borderBottom:`1px solid ${T.brd}`,padding:'0 20px',height:57,display:'flex',alignItems:'center',gap:10}}>
        <button onClick={()=>setView('dashboard')} style={{background:'none',border:'none',cursor:'pointer',padding:0}}>
          <span style={{fontFamily:"'Lora',Georgia,serif",fontSize:20,fontWeight:700,color:T.txt,letterSpacing:'-0.5px'}}>One<span style={{color:'#FF6B35'}}>List</span></span>
        </button>
        <div style={{flex:1}}/>
        <button onClick={()=>setModal('search')} style={{display:'flex',alignItems:'center',gap:8,background:T.sur2,border:`1px solid ${T.brd}`,borderRadius:100,padding:'7px 14px',cursor:'pointer',fontSize:13,color:T.txt3}}>
          🔍 <span>Search</span> <span style={{fontSize:10,opacity:.6}}>⌘K</span>
        </button>
        {[{i:'📦',t:'Archive',a:()=>setView('archive'),on:view==='archive'},{i:'🎙️',t:'Voice',a:startVoice,on:false},{i:dm?'☀️':'🌙',t:'Dark mode',a:()=>setDm(p=>!p),on:false}].map(({i,t,a,on})=>(
          <button key={t} onClick={a} title={t} style={{width:34,height:34,borderRadius:8,border:`1px solid ${T.brd}`,background:on?'#FF6B35':T.sur2,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',color:on?'white':T.txt}}>{i}</button>
        ))}
        <button onClick={()=>{setTaskForm(BLANK);setEditTid(null);setModal('add-task');}} style={{background:'#FF6B35',border:'none',borderRadius:100,padding:'8px 16px',fontSize:13,fontWeight:700,color:'white',cursor:'pointer'}}>+ Task</button>
        {/* User + logout */}
        <div style={{position:'relative',marginLeft:4,paddingLeft:12,borderLeft:`1px solid ${T.brd}`}}>
          <button onClick={()=>setShowAccount(p=>!p)} style={{display:'flex',alignItems:'center',gap:6,background:T.sur2,border:`1px solid ${T.brd}`,borderRadius:100,padding:'5px 12px 5px 8px',cursor:'pointer'}}>
            <div style={{width:26,height:26,borderRadius:'50%',background:'#FF6B35',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white',flexShrink:0}}>
              {(data?.settings?.displayName||session?.email||'?')[0].toUpperCase()}
            </div>
            <span style={{fontSize:12,color:T.txt2,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{data?.settings?.displayName||session?.email}</span>
          </button>
          {showAccount&&(
            <div onClick={e=>e.stopPropagation()} style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:T.sur,border:`1px solid ${T.brd}`,borderRadius:14,padding:16,width:240,boxShadow:'0 8px 32px rgba(0,0,0,.12)',zIndex:200}}>
              <div style={{fontSize:11,fontWeight:700,color:T.txt3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Account</div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,fontWeight:700,color:T.txt2,display:'block',marginBottom:4}}>Display name</label>
                <input value={data?.settings?.displayName||''} onChange={e=>upd(prev=>({...prev,settings:{...(prev.settings||{}),displayName:e.target.value}}))} placeholder={session?.email} style={{width:'100%',background:T.sur2,border:`1.5px solid ${T.brd}`,borderRadius:8,padding:'7px 10px',fontSize:13,color:T.txt,fontFamily:'inherit',outline:'none'}}/>
              </div>
              <div style={{fontSize:12,color:T.txt3,marginBottom:12,wordBreak:'break-all'}}>{session?.email}</div>
              <div style={{borderTop:`1px solid ${T.brd}`,paddingTop:10,display:'flex',gap:8}}>
                <button onClick={()=>{setShowAccount(false);setShowSettings(true);}} style={{flex:1,background:T.sur2,border:`1px solid ${T.brd}`,borderRadius:8,padding:'7px 0',fontSize:12,fontWeight:600,color:T.txt,cursor:'pointer'}}>⚙ Settings</button>
                <button onClick={handleSignOut} style={{flex:1,background:'#FF3B3012',border:'1px solid #FF3B3030',borderRadius:8,padding:'7px 0',fontSize:12,fontWeight:600,color:'#FF3B30',cursor:'pointer'}}>Sign out</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BODY */}
      <div style={{display:'flex'}}>

        {/* SIDEBAR */}
        <div className="sb">
          {sbOpen ? (
            <div style={{width:280,flexShrink:0,background:SBG,borderRight:`1px solid ${SBR}`,position:'sticky',top:57,height:'calc(100vh - 57px)',display:'flex',flexDirection:'column'}}>
              {/* Sidebar header */}
              <div style={{flexShrink:0,padding:'16px 14px 8px'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontFamily:"'Lora',Georgia,serif",fontSize:17,fontWeight:700,color:T.txt}}>Today</span>
                  {todayActive>0&&<span style={{background:'#FF6B35',color:'white',borderRadius:100,fontSize:11,fontWeight:700,padding:'1px 7px'}}>{todayActive}</span>}
                  <button onClick={()=>setSbOpen(false)} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',fontSize:20,color:T.txt3,lineHeight:1,padding:'0 2px'}} title="Collapse">‹</button>
                </div>
                <p style={{fontSize:10,color:T.txt3,marginBottom:10,lineHeight:1.4}}>📌 pinned survive 3am · others auto-return</p>
                <div style={{display:'flex',gap:6}}>
                  <input value={quickAdd} onChange={e=>setQuickAdd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&quickAddFn()} placeholder="Quick add to Today…" style={{flex:1,background:T.sur,border:`1.5px solid ${T.brd}`,borderRadius:8,padding:'7px 10px',fontSize:12,color:T.txt,fontFamily:'inherit',outline:'none'}}/>
                  <button onClick={quickAddFn} style={{background:'#FF6B35',border:'none',borderRadius:8,padding:'7px 11px',cursor:'pointer',fontSize:16,color:'white',fontWeight:700}}>+</button>
                </div>
              </div>

              {/* Scrollable tasks */}
              <div style={{flex:1,overflowY:'auto',padding:'8px 14px 0',minHeight:0}}>
                {todayTasks.length===0
                  ? <div style={{textAlign:'center',padding:'28px 6px',color:T.txt3,fontSize:12}}><div style={{fontSize:28,marginBottom:8}}>☀️</div>Nothing yet.<br/>Use ☆ to add tasks.</div>
                  : todayTasks.map(t=>{
                    const proj=t.projectId?getProj(t.projectId):null;
                    const exp=expToday[t.id];
                    const hov=hovPin===t.id;
                    const hasSubs=(t.subtasks||[]).length>0;
                    return (
                      <div key={t.id}
                        draggable={!t.done}
                        onDragStart={()=>dStart(t.id)}
                        onDragOver={e=>{e.preventDefault();setDragOv(t.id);}}
                        onDragEnd={dEnd}
                        onMouseEnter={()=>setHovPin(t.id)}
                        onMouseLeave={()=>setHovPin(null)}
                        style={{background:dragOv===t.id?(dm?'#252520':'#F0F0E8'):T.sur,border:`1px solid ${dragOv===t.id?(proj?.color||'#FF6B35'):T.brd}`,borderRadius:10,padding:'8px 10px',marginBottom:6,
                          borderLeft:proj?`3px solid ${proj.color}`:`1px solid ${T.brd}`,
                          opacity:t.done?0.6:1,transition:'all .15s',cursor:t.done?'default':'grab'}}
                      >
                        <div style={{display:'flex',alignItems:'center',gap:7}}>
                          {!t.done&&<span style={{fontSize:12,color:T.txt3,flexShrink:0,userSelect:'none'}}>⠿</span>}
                          <Chk done={t.done} color={proj?.color} onClick={()=>toggleDone(t.id)} size={20}/>
                          <div style={{flex:1,minWidth:0,cursor:hasSubs?'pointer':'default'}} onClick={()=>hasSubs&&setExpToday(p=>({...p,[t.id]:!p[t.id]}))}>
                            <div style={{fontSize:12,fontWeight:500,color:t.done?T.txt3:T.txt,textDecoration:t.done?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>
                            {hasSubs&&<div style={{fontSize:10,color:T.txt3,marginTop:1}}>{t.subtasks.filter(s=>s.done).length}/{t.subtasks.length} subtasks {exp?'▲':'▼'}</div>}
                            {t.recur&&<div style={{fontSize:9,color:T.txt3}}>🔁 {t.recur}</div>}
                          </div>
                          <div style={{display:'flex',gap:2,flexShrink:0}}>
                            {t.pinned
                              ? <button onClick={()=>togglePin(t.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#FF6B35',padding:'1px 2px'}}>📌</button>
                              : hov
                                ? <button onClick={()=>togglePin(t.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:T.txt3,padding:'1px 2px',opacity:.5}}>📍</button>
                                : <span style={{width:18,display:'inline-block'}}/>
                            }
                            <button onClick={()=>remFromToday(t.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:T.txt3,padding:'1px 2px'}}>✕</button>
                          </div>
                        </div>
                        {exp&&hasSubs&&(
                          <div style={{marginTop:6,paddingLeft:t.done?18:26}}>
                            {t.subtasks.map(s=>(
                              <div key={s.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0',borderBottom:`1px solid ${T.brd}33`}}>
                                <div onClick={()=>toggleSub(t.id,s.id)} style={{width:14,height:14,borderRadius:3,border:s.done?'none':`1.5px solid ${T.brd}`,background:s.done?(proj?.color||'#34C759'):'transparent',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'white'}}>
                                  {s.done&&'✓'}
                                </div>
                                <span style={{fontSize:11,color:s.done?T.txt3:T.txt2,textDecoration:s.done?'line-through':'none',flex:1}}>{s.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                }
                {todayTasks.filter(t=>t.done).length>0&&(
                  <p style={{fontSize:10,color:T.txt3,textAlign:'center',marginTop:4,paddingBottom:10}}>{todayTasks.filter(t=>t.done).length} completed · archived at 3am</p>
                )}
              </div>

              {/* Full calendar — collapsible at bottom */}
              <div style={{flexShrink:0,borderTop:`1px solid ${SBR}`}}>
                <button onClick={()=>setCalMin(p=>!p)} style={{width:'100%',background:'none',border:'none',cursor:'pointer',padding:'10px 14px',display:'flex',alignItems:'center',gap:8,color:T.txt2,fontSize:12,fontWeight:600}}>
                  <span style={{fontSize:14}}>📅</span>
                  <span style={{flex:1,textAlign:'left'}}>{fmtD(TODAY)}</span>
                  <span style={{fontSize:11,color:T.txt3}}>{calMin?'▴':'▾'}</span>
                </button>
                {!calMin&&(
                  <div style={{padding:'0 12px 14px'}}>
                    {calView==='week'?(
                      <div>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                          <span style={{fontSize:12,fontWeight:700,color:T.txt}}>This Week</span>
                          <div style={{display:'flex',gap:4}}>
                            <button onClick={()=>setCalView('month')} style={{fontSize:10,padding:'3px 8px',borderRadius:100,border:`1px solid ${T.brd}`,background:T.sur2,cursor:'pointer',color:T.txt2}}>Month</button>
                            <button style={{fontSize:10,padding:'3px 8px',borderRadius:100,border:'none',background:'#FF6B35',cursor:'pointer',color:'white'}}>Week</button>
                          </div>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
                          {weekDays.map((d,i)=>{const isT=d.toDateString()===TODAY.toDateString();return(
                            <div key={i} style={{textAlign:'center'}}>
                              <div style={{fontSize:8,fontWeight:700,color:T.txt3,marginBottom:3}}>{d.toLocaleDateString('en-AU',{weekday:'short'})}</div>
                              <div style={{width:26,height:26,borderRadius:'50%',background:isT?'#FF6B35':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:isT?700:400,color:isT?'white':T.txt,margin:'0 auto'}}>{d.getDate()}</div>
                            </div>
                          );})}
                        </div>
                      </div>
                    ):(
                      <div>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                          <button onClick={()=>{const d=new Date(calYr,calMo-1);setCalMo(d.getMonth());setCalYr(d.getFullYear());}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:T.txt2,padding:'0 2px'}}>‹</button>
                          <div style={{display:'flex',alignItems:'center',gap:5}}>
                            <span style={{fontSize:11,fontWeight:700,color:T.txt}}>{mainMName}</span>
                            {!calIsNow&&<button onClick={()=>{setCalMo(tM);setCalYr(tY);}} style={{fontSize:9,fontWeight:700,color:'#FF6B35',background:'#FF6B3515',border:'1px solid #FF6B3540',borderRadius:100,padding:'1px 6px',cursor:'pointer'}}>Today</button>}
                          </div>
                          <button onClick={()=>{const d=new Date(calYr,calMo+1);setCalMo(d.getMonth());setCalYr(d.getFullYear());}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:T.txt2,padding:'0 2px'}}>›</button>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,marginBottom:8}}>
                          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><div key={d} style={{textAlign:'center',fontSize:8,fontWeight:700,color:T.txt3,padding:'2px 0'}}>{d}</div>)}
                          {mainCells.map((d,i)=>{const isT=d&&d===tD&&calMo===tM&&calYr===tY;return <div key={i} style={{aspectRatio:'1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:isT?700:400,borderRadius:5,background:isT?'#FF6B35':'transparent',color:isT?'white':d?T.txt:'transparent'}}>{d||''}</div>;})}
                        </div>
                        <div style={{display:'flex',gap:4}}>
                          <button style={{fontSize:10,padding:'3px 8px',borderRadius:100,border:'none',background:'#FF6B35',cursor:'pointer',color:'white'}}>Month</button>
                          <button onClick={()=>setCalView('week')} style={{fontSize:10,padding:'3px 8px',borderRadius:100,border:`1px solid ${T.brd}`,background:T.sur2,cursor:'pointer',color:T.txt2}}>Week</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Collapsed strip */
            <div style={{width:40,flexShrink:0,background:SBG,borderRight:`1px solid ${SBR}`,position:'sticky',top:57,height:'calc(100vh - 57px)',display:'flex',flexDirection:'column',alignItems:'center',paddingTop:14,gap:10}}>
              <button onClick={()=>setSbOpen(true)} title="Open Today" style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:T.txt2,lineHeight:1}}>›</button>
              {todayActive>0&&<span style={{background:'#FF6B35',color:'white',borderRadius:100,fontSize:10,fontWeight:700,padding:'2px 5px',minWidth:18,textAlign:'center'}}>{todayActive}</span>}
              <div style={{writingMode:'vertical-rl',transform:'rotate(180deg)',fontSize:10,fontWeight:700,color:T.txt3,letterSpacing:'1px',textTransform:'uppercase',userSelect:'none',marginTop:4}}>Today</div>
            </div>
          )}
        </div>

        {/* MAIN */}
        <div style={{flex:1,overflowY:'auto',minHeight:'calc(100vh - 57px)'}}>

          {view==='dashboard'&&(
            <div style={{padding:24}}>
              {dashLayout.map(sectionKey=>{
                const isLast=dashLayout.indexOf(sectionKey)===dashLayout.length-1;

                // Section drag handle wrapper
                const SectionWrap=({title,right,children})=>(
                  <div style={{marginBottom:isLast?0:32}}
                    draggable
                    onDragStart={e=>{e.dataTransfer.setData('section',sectionKey);setDragSection(sectionKey);}}
                    onDragEnd={()=>{setDragSection(null);setDragSectionOver(null);}}
                    onDragOver={e=>{e.preventDefault();if(dragSection&&dragSection!==sectionKey)setDragSectionOver(sectionKey);}}
                    onDragLeave={()=>setDragSectionOver(null)}
                    onDrop={e=>{e.preventDefault();const from=e.dataTransfer.getData('section');if(from&&from!==sectionKey)reorderDashboard(from,sectionKey);setDragSection(null);setDragSectionOver(null);}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,opacity:dragSection===sectionKey?.4:1,borderTop:dragSectionOver===sectionKey?'2px solid #FF6B35':'2px solid transparent',paddingTop:dragSectionOver===sectionKey?8:0,transition:'all .15s'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:12,color:T.txt3,cursor:'grab',userSelect:'none'}} title="Drag to reorder sections">⠿</span>
                        <span style={{fontSize:11,fontWeight:700,color:T.txt3,textTransform:'uppercase',letterSpacing:'0.8px'}}>{title}</span>
                      </div>
                      {right}
                    </div>
                    {children}
                  </div>
                );

                if(sectionKey==='projects') return (
                  <SectionWrap key="projects" title="Projects & Categories"
                    right={<button onClick={()=>{setProjForm({name:'',emoji:'📁',color:'#3B82F6'});setEditPid(null);setModal('add-project');}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:600,color:'#FF6B35'}}>+ New Project</button>}>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:14}}>
                      {projects.map(proj=>{
                        const active=tasks.filter(t=>t.projectId===proj.id&&!t.done&&!t.archived&&!t.inToday);
                        const exp=expProj[proj.id];
                        const shown=exp?active:active.slice(0,4);
                        const isTaskDrop=dragTask&&dragTask!==proj.id;
                        const isProjDrop=dragProjOver===proj.id&&dragProjId!==proj.id;
                        return (
                          <div key={proj.id}
                            draggable
                            onDragStart={e=>{if(e.dataTransfer.getData('taskId'))return;e.dataTransfer.setData('projId',proj.id);setDragProjId(proj.id);}}
                            onDragEnd={()=>{setDragProjId(null);setDragProjOver(null);}}
                            onDragOver={e=>{e.preventDefault();e.stopPropagation();if(dragProjId&&dragProjId!==proj.id){setDragProjOver(proj.id);}else{setDragTask(proj.id);}}}
                            onDragLeave={()=>{setDragTask(null);setDragProjOver(null);}}
                            onDrop={e=>{e.preventDefault();e.stopPropagation();const taskId=e.dataTransfer.getData('taskId');const fromProjId=e.dataTransfer.getData('projId');if(taskId){moveTask(taskId,proj.id);}else if(fromProjId&&fromProjId!==proj.id){reorderProjects(fromProjId,proj.id);}setDragTask(null);setDragProjId(null);setDragProjOver(null);}}
                            style={{background:hl(proj.color),borderRadius:16,padding:18,border:`1.5px solid ${isProjDrop?proj.color:isTaskDrop?proj.color:hm(proj.color)}`,position:'relative',transition:'all .2s',boxShadow:isProjDrop?`0 0 0 3px ${proj.color}66`:isTaskDrop?`0 0 0 3px ${proj.color}33`:'',display:'flex',flexDirection:'column',minHeight:180,opacity:dragProjId===proj.id?.5:1,cursor:dragProjId&&dragProjId!==proj.id?'copy':'default'}}
                            onMouseEnter={e=>{if(!dragTask&&!dragProjId&&!dragSection){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 32px rgba(0,0,0,.09)';}}}
                            onMouseLeave={e=>{e.currentTarget.style.transform='';if(!dragTask&&!dragProjId)e.currentTarget.style.boxShadow='';}}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                              <div style={{display:'flex',alignItems:'center',gap:8}}>
                                <span style={{fontSize:14,color:proj.color+'66',cursor:'grab',userSelect:'none',lineHeight:1}} title="Drag to reorder">⠿</span>
                                <span style={{fontSize:22}}>{proj.emoji}</span>
                              </div>
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <span style={{fontSize:11,fontWeight:700,padding:'2px 7px',borderRadius:100,background:proj.color+'22',color:proj.color}}>{active.length}</span>
                                <button onClick={()=>{setProjForm({name:proj.name,emoji:proj.emoji,color:proj.color});setEditPid(proj.id);setModal('edit-project');}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:proj.color,opacity:.6,padding:0,lineHeight:1}}>⚙</button>
                              </div>
                            </div>
                            <div style={{fontSize:16,fontWeight:800,color:proj.color,marginBottom:10,fontFamily:"'Lora',Georgia,serif"}}>{proj.name}</div>
                            <div style={{flex:1}}>
                              {shown.length===0&&<div style={{fontSize:12,color:proj.color+'77',fontStyle:'italic',marginBottom:6}}>All done! 🎉</div>}
                              {shown.map((t,i)=>(
                                <div key={t.id} style={{fontSize:12,color:proj.color+'BB',padding:'3px 0',borderTop:i===0?`1px solid ${proj.color}20`:'none',display:'flex',alignItems:'center',gap:5}}>
                                  {t.pinTop&&<span style={{fontSize:9,color:proj.color,flexShrink:0}}>📌</span>}
                                  <div style={{width:4,height:4,borderRadius:'50%',background:proj.color,flexShrink:0}}/>
                                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{t.title}</span>
                                  {t.subtasks.length>0&&<span style={{fontSize:10,opacity:.55,flexShrink:0}}>{t.subtasks.filter(s=>s.done).length}/{t.subtasks.length}</span>}
                                </div>
                              ))}
                              {active.length>4&&<button onClick={()=>setExpProj(p=>({...p,[proj.id]:!p[proj.id]}))} style={{background:'none',border:'none',cursor:'pointer',fontSize:10,fontWeight:700,color:proj.color,marginTop:4,padding:0}}>{exp?'▲ Less':`▼ +${active.length-4} more`}</button>}
                            </div>
                            <div style={{display:'flex',gap:6,marginTop:12}}>
                              <input value={inlineAdd[proj.id]||''} onChange={e=>setInlineAdd(p=>({...p,[proj.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&inlineAddTask(proj.id,inlineAdd[proj.id]||'')} placeholder="Add task…" style={{flex:1,background:proj.color+'12',border:`1px solid ${proj.color}30`,borderRadius:8,padding:'6px 9px',fontSize:12,color:proj.color,fontFamily:'inherit',outline:'none'}}/>
                              <button onClick={()=>setView(`project-${proj.id}`)} style={{background:proj.color+'22',border:'none',borderRadius:8,padding:'6px 10px',fontSize:12,fontWeight:700,color:proj.color,cursor:'pointer',whiteSpace:'nowrap'}}>Open →</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionWrap>
                );

                if(sectionKey==='alltasks') return (
                  <SectionWrap key="alltasks" title={`All Tasks · ${allTasks.filter(t=>!t.done).length} active`} right={null}>
                    {/* Quick-add */}
                    <div style={{display:'flex',gap:6,marginBottom:12}}
                      onDragOver={e=>e.preventDefault()}
                      onDrop={e=>{e.preventDefault();const tid=e.dataTransfer.getData('taskId');if(tid)moveTask(tid,null);setDragTask(null);}}>
                      <input value={inlineAdd['misc']||''} onChange={e=>setInlineAdd(p=>({...p,misc:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&inlineAddTask('misc',inlineAdd['misc']||'')} placeholder="Add task… (or drag here to remove from project)" style={{flex:1,background:T.sur,border:`1.5px solid ${T.brd}`,borderRadius:8,padding:'8px 12px',fontSize:13,color:T.txt,fontFamily:'inherit',outline:'none'}}/>
                      <button onClick={()=>inlineAddTask('misc',inlineAdd['misc']||'')} style={{background:'#FF6B35',border:'none',borderRadius:8,padding:'8px 12px',cursor:'pointer',fontSize:16,color:'white',fontWeight:700}}>+</button>
                    </div>
                    <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const tid=e.dataTransfer.getData('taskId');if(tid)moveTask(tid,null);setDragTask(null);}}>
                      {allTasks.length===0&&<div style={{fontSize:13,color:T.txt3,fontStyle:'italic',padding:'8px 0'}}>No tasks yet</div>}
                      {allTasks.map(t=><TaskCard key={t.id} task={t} T={T} dm={dm} getProj={getProj} projects={projects} expTask={expTask} setExpTask={setExpTask} toggleDone={toggleDone} toggleSub={toggleSub} addToToday={addToToday} delTask={delTask} openEdit={openEdit} moveTask={moveTask} onRename={renameTask} toggleTaskProject={toggleTaskProject} togglePinTop={togglePinTop}/>)}
                    </div>
                  </SectionWrap>
                );

                if(sectionKey==='calendar') return (
                  <SectionWrap key="calendar" title="Calendar" right={null}>
                    <div style={{background:T.sur,border:`1px solid ${T.brd}`,borderRadius:14,padding:18,maxWidth:420}}>
                      {calView==='week'?(
                        <div>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                            <span style={{fontSize:13,fontWeight:700,color:T.txt}}>This Week</span>
                            <div style={{display:'flex',gap:6}}>
                              <button onClick={()=>setCalView('month')} style={{fontSize:11,padding:'4px 10px',borderRadius:100,border:`1px solid ${T.brd}`,background:T.sur2,cursor:'pointer',color:T.txt2}}>Month</button>
                              <button style={{fontSize:11,padding:'4px 10px',borderRadius:100,border:'none',background:'#FF6B35',cursor:'pointer',color:'white'}}>Week</button>
                            </div>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:12}}>
                            {weekDays.map((d,i)=>{const isT=d.toDateString()===TODAY.toDateString();return(
                              <div key={i} style={{textAlign:'center'}}>
                                <div style={{fontSize:10,fontWeight:700,color:T.txt3,marginBottom:4}}>{d.toLocaleDateString('en-AU',{weekday:'short'})}</div>
                                <div style={{width:32,height:32,borderRadius:'50%',background:isT?'#FF6B35':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:isT?700:400,color:isT?'white':T.txt,margin:'0 auto'}}>{d.getDate()}</div>
                              </div>
                            );})}
                          </div>
                        </div>
                      ):(
                        <div>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                            <button onClick={()=>{const d=new Date(calYr,calMo-1);setCalMo(d.getMonth());setCalYr(d.getFullYear());}} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:T.txt2,padding:'0 4px'}}>‹</button>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <span style={{fontSize:13,fontWeight:700,color:T.txt}}>{mainMName}</span>
                              {!calIsNow&&<button onClick={()=>{setCalMo(tM);setCalYr(tY);}} style={{fontSize:10,fontWeight:700,color:'#FF6B35',background:'#FF6B3515',border:'1px solid #FF6B3540',borderRadius:100,padding:'2px 7px',cursor:'pointer'}}>Today</button>}
                            </div>
                            <button onClick={()=>{const d=new Date(calYr,calMo+1);setCalMo(d.getMonth());setCalYr(d.getFullYear());}} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:T.txt2,padding:'0 4px'}}>›</button>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:10}}>
                            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><div key={d} style={{textAlign:'center',fontSize:10,fontWeight:700,color:T.txt3,padding:'3px 0'}}>{d}</div>)}
                            {mainCells.map((d,i)=>{const isT=d&&d===tD&&calMo===tM&&calYr===tY;return <div key={i} style={{aspectRatio:'1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:isT?700:400,borderRadius:7,background:isT?'#FF6B35':'transparent',color:isT?'white':d?T.txt:'transparent'}}>{d||''}</div>;})}
                          </div>
                          <div style={{display:'flex',gap:6}}>
                            <button style={{fontSize:11,padding:'4px 10px',borderRadius:100,border:'none',background:'#FF6B35',cursor:'pointer',color:'white'}}>Month</button>
                            <button onClick={()=>setCalView('week')} style={{fontSize:11,padding:'4px 10px',borderRadius:100,border:`1px solid ${T.brd}`,background:T.sur2,cursor:'pointer',color:T.txt2}}>Week</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionWrap>
                );

                return null;
              })}
            </div>
          )}


          {view.startsWith('project-')&&currentProj&&(()=>{
            const active=sortByPinTop(tasks.filter(t=>t.projectId===currentProj.id&&!t.done&&!t.archived&&!t.inToday));
            const done=tasks.filter(t=>t.projectId===currentProj.id&&t.done&&!t.archived&&!t.inToday);
            return (
              <div style={{padding:24}}>
                <button onClick={()=>setView('dashboard')} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:T.txt2,marginBottom:20}}>← Back</button>
                <div style={{background:hl(currentProj.color),borderRadius:16,padding:'18px 22px',marginBottom:24,display:'flex',alignItems:'center',gap:16,border:`1.5px solid ${hm(currentProj.color)}`}}>
                  <span style={{fontSize:38}}>{currentProj.emoji}</span>
                  <div>
                    <div style={{fontSize:22,fontWeight:800,color:currentProj.color,fontFamily:"'Lora',Georgia,serif"}}>{currentProj.name}</div>
                    <div style={{fontSize:12,color:currentProj.color+'99',marginTop:2}}>{active.length} active · {tasks.filter(t=>t.projectId===currentProj.id&&t.inToday).length} in Today</div>
                  </div>
                  <div style={{marginLeft:'auto',display:'flex',gap:8}}>
                    <button onClick={()=>{setProjForm({name:currentProj.name,emoji:currentProj.emoji,color:currentProj.color});setEditPid(currentProj.id);setModal('edit-project');}} style={{background:currentProj.color+'22',border:'none',borderRadius:100,padding:'9px 14px',fontSize:12,fontWeight:700,color:currentProj.color,cursor:'pointer'}}>⚙ Edit</button>
                  </div>
                </div>
                {/* Inline quick-add — auto-assigned to this project */}
                <div style={{display:'flex',gap:8,marginBottom:16}}>
                  <input value={inlineAdd[currentProj.id]||''} onChange={e=>setInlineAdd(p=>({...p,[currentProj.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&inlineAddTask(currentProj.id,inlineAdd[currentProj.id]||'')} placeholder={`Add task to ${currentProj.name}…`} style={{flex:1,background:hl(currentProj.color),border:`1.5px solid ${hm(currentProj.color)}`,borderRadius:10,padding:'10px 14px',fontSize:14,color:currentProj.color,fontFamily:'inherit',outline:'none'}}/>
                  <button onClick={()=>inlineAddTask(currentProj.id,inlineAdd[currentProj.id]||'')} style={{background:currentProj.color,border:'none',borderRadius:10,padding:'10px 16px',cursor:'pointer',fontSize:18,color:'white',fontWeight:700}}>+</button>
                </div>
                {active.length===0&&<div style={{fontSize:13,color:T.txt3,fontStyle:'italic',padding:'12px 0'}}>No active tasks — type above to add one!</div>}
                {active.map(t=><TaskCard key={t.id} task={t} T={T} dm={dm} getProj={getProj} projects={projects} expTask={expTask} setExpTask={setExpTask} toggleDone={toggleDone} toggleSub={toggleSub} addToToday={addToToday} delTask={delTask} openEdit={openEdit} moveTask={moveTask} onRename={renameTask} toggleTaskProject={toggleTaskProject} togglePinTop={togglePinTop}/>)}
                {done.length>0&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:T.txt3,textTransform:'uppercase',letterSpacing:'0.8px',marginTop:20,marginBottom:12}}>Completed ({done.length})</div>
                    {done.map(t=><TaskCard key={t.id} task={t} T={T} dm={dm} getProj={getProj} projects={projects} expTask={expTask} setExpTask={setExpTask} toggleDone={toggleDone} toggleSub={toggleSub} addToToday={addToToday} delTask={delTask} openEdit={openEdit} moveTask={moveTask} onRename={renameTask} toggleTaskProject={toggleTaskProject} togglePinTop={togglePinTop}/>)}
                  </div>
                )}
              </div>
            );
          })()}

          {view==='archive'&&(
            <div style={{padding:24}}>
              <button onClick={()=>setView('dashboard')} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:T.txt2,marginBottom:20}}>← Back</button>
              <div style={{fontFamily:"'Lora',Georgia,serif",fontSize:22,fontWeight:700,marginBottom:20,color:T.txt}}>Archive</div>
              {archived.length===0
                ?<div style={{textAlign:'center',padding:'60px 0',color:T.txt3,fontSize:13}}><div style={{fontSize:40,marginBottom:12}}>📦</div>Nothing archived yet</div>
                :[...archived].reverse().map((t,i)=>{const proj=t.projectId?getProj(t.projectId):null;return(
                  <div key={i} style={{background:T.sur,border:`1px solid ${T.brd}`,borderRadius:12,padding:'12px 16px',marginBottom:8,borderLeft:`3px solid ${proj?.color||T.brd}`,opacity:.7}}>
                    <div style={{fontSize:14,fontWeight:500,color:T.txt,textDecoration:'line-through'}}>{t.title}</div>
                    <div style={{fontSize:11,color:T.txt3,marginTop:4}}>{proj?`${proj.emoji} ${proj.name} · `:''}Archived {new Date(t.archivedAt||Date.now()).toLocaleDateString('en-AU')}</div>
                  </div>
                );})}
            </div>
          )}

        </div>
      </div>

      {/* ── Mobile FABs ── */}
      {/* Today FAB — mobile only */}
      <button className="vfab" onClick={()=>setShowMobileToday(true)} style={{position:'fixed',bottom:24,right:24,zIndex:300,width:58,height:58,borderRadius:'50%',background:'#FF6B35',border:'none',boxShadow:'0 4px 24px rgba(255,107,53,.4)',cursor:'pointer',display:'none',alignItems:'center',justifyContent:'center',flexDirection:'column',color:'white'}}>
        <span style={{fontSize:18,lineHeight:1}}>☀️</span>
        {todayActive>0&&<span style={{fontSize:11,fontWeight:700,lineHeight:1,marginTop:2}}>{todayActive}</span>}
      </button>

      {/* ── Mobile Today overlay ── */}
      {showMobileToday&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:400,backdropFilter:'blur(6px)'}} onClick={()=>setShowMobileToday(false)}>
          <div onClick={e=>e.stopPropagation()} style={{position:'absolute',bottom:0,left:0,right:0,background:T.sur,borderRadius:'20px 20px 0 0',padding:20,maxHeight:'80vh',display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',alignItems:'center',marginBottom:14}}>
              <span style={{fontFamily:"'Lora',Georgia,serif",fontSize:18,fontWeight:700,color:T.txt}}>Today</span>
              {todayActive>0&&<span style={{background:'#FF6B35',color:'white',borderRadius:100,fontSize:11,fontWeight:700,padding:'1px 7px',marginLeft:8}}>{todayActive}</span>}
              <span style={{flex:1}}/>
              <button onClick={()=>setShowMobileToday(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:T.txt3}}>✕</button>
            </div>
            <div style={{display:'flex',gap:6,marginBottom:12}}>
              <input value={quickAdd} onChange={e=>setQuickAdd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&quickAddFn()} placeholder="Quick add to Today…" style={{flex:1,background:T.sur2,border:`1.5px solid ${T.brd}`,borderRadius:8,padding:'8px 12px',fontSize:13,color:T.txt,fontFamily:'inherit',outline:'none'}}/>
              <button onClick={quickAddFn} style={{background:'#FF6B35',border:'none',borderRadius:8,padding:'8px 12px',cursor:'pointer',fontSize:16,color:'white',fontWeight:700}}>+</button>
            </div>
            <div style={{overflowY:'auto',flex:1}}>
              {todayTasks.length===0?<div style={{textAlign:'center',padding:'32px 0',color:T.txt3,fontSize:13}}><div style={{fontSize:32,marginBottom:8}}>☀️</div>Nothing for today yet!</div>
              :todayTasks.map(t=>{
                const proj=t.projectId?getProj(t.projectId):null;
                return(
                  <div key={t.id} style={{background:T.sur2,border:`1px solid ${T.brd}`,borderRadius:10,padding:'10px 12px',marginBottom:8,borderLeft:proj?`3px solid ${proj.color}`:`1px solid ${T.brd}`,opacity:t.done?.6:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <Chk done={t.done} color={proj?.color} onClick={()=>toggleDone(t.id)} size={20}/>
                      <span style={{flex:1,fontSize:13,fontWeight:500,color:t.done?T.txt3:T.txt,textDecoration:t.done?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</span>
                      <button onClick={()=>remFromToday(t.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:T.txt3,padding:'2px 4px'}}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Confetti celebration ── */}
      {confetti&&(
        <div style={{position:'fixed',inset:0,zIndex:999,pointerEvents:'none',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{textAlign:'center',animation:'popIn .4s ease'}}>
            <div style={{fontSize:60,lineHeight:1,marginBottom:12}}>🎉</div>
            <div style={{fontFamily:"'Lora',Georgia,serif",fontSize:22,fontWeight:700,color:'#FF6B35',background:'white',padding:'12px 28px',borderRadius:100,boxShadow:'0 8px 40px rgba(0,0,0,.15)'}}>All done! You legend! 🏆</div>
          </div>
          {Array.from({length:24}).map((_,i)=>(
            <div key={i} style={{position:'absolute',top:`${Math.random()*80+10}%`,left:`${Math.random()*90+5}%`,width:10,height:10,borderRadius:'50%',background:['#FF6B35','#3B82F6','#059669','#D97706','#7C3AED','#EC4899'][i%6],animation:`confettiFall ${1+Math.random()*2}s ${Math.random()}s ease-out forwards`}}/>
          ))}
        </div>
      )}

      {/* ── Settings modal ── */}
      {showSettings&&(
        <div onClick={()=>setShowSettings(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(8px)'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:T.sur,borderRadius:20,padding:28,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
            <div style={{fontFamily:"'Lora',Georgia,serif",fontSize:20,fontWeight:700,marginBottom:6,color:T.txt}}>Settings</div>
            <div style={{fontSize:12,color:T.txt3,marginBottom:24}}>{session?.email}</div>

            <div style={{marginBottom:24}}>
              <Lbl>Daily reset time</Lbl>
              <p style={{fontSize:12,color:T.txt3,marginBottom:10}}>Completed tasks archive and incomplete tasks return to their projects at this hour every day.</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {[0,1,2,3,4,5,6,12].map(h=>{
                  const active=(data.settings?.resetHour??3)===h;
                  return(
                    <button key={h} onClick={()=>setResetHour(h)} style={{padding:'7px 14px',borderRadius:100,border:`1.5px solid ${active?'#FF6B35':T.brd}`,background:active?'#FF6B35':T.sur2,color:active?'white':T.txt,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                      {h===0?'Midnight':h===12?'Noon':`${h}:00 AM`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{marginBottom:24,padding:16,background:T.sur2,borderRadius:12}}>
              <div style={{fontSize:13,fontWeight:600,color:T.txt,marginBottom:4}}>Dark mode</div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div onClick={()=>setDm(p=>!p)} style={{width:44,height:24,borderRadius:12,cursor:'pointer',background:dm?'#FF6B35':T.brd,position:'relative',transition:'background .2s',flexShrink:0}}>
                  <div style={{position:'absolute',top:2,left:dm?22:2,width:20,height:20,borderRadius:'50%',background:'white',transition:'left .2s',boxShadow:'0 1px 4px rgba(0,0,0,.2)'}}/>
                </div>
                <span style={{fontSize:13,color:T.txt}}>{dm?'Dark':'Light'} mode</span>
              </div>
            </div>

            <button onClick={()=>setShowSettings(false)} style={{width:'100%',background:'#FF6B35',border:'none',borderRadius:100,padding:'11px 0',fontSize:14,fontWeight:700,color:'white',cursor:'pointer'}}>Done</button>
          </div>
        </div>
      )}

      {/* MODALS */}

      {(modal==='add-task'||modal==='edit-task')&&(
        <div onClick={e=>e.target===e.currentTarget&&setModal(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(8px)'}}>
          <div style={{background:T.sur,borderRadius:20,padding:24,width:'100%',maxWidth:480,maxHeight:'88vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
            <div style={{fontFamily:"'Lora',Georgia,serif",fontSize:20,fontWeight:700,marginBottom:20,color:T.txt}}>{modal==='edit-task'?'Edit Task':'New Task'}</div>
            <div style={{marginBottom:14}}><Lbl>Task</Lbl><input autoFocus value={taskForm.title} onChange={e=>setTaskForm(p=>({...p,title:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&saveTask()} placeholder="What needs to be done?" style={inp}/></div>
            <div style={{marginBottom:14}}><Lbl>Project</Lbl>
              <select value={taskForm.projectId} onChange={e=>setTaskForm(p=>({...p,projectId:e.target.value}))} style={inp}>
                <option value="">No project (Misc)</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
              </select>
            </div>
            <div style={{marginBottom:14}}><Lbl>Repeats</Lbl>
              <select value={taskForm.recur} onChange={e=>setTaskForm(p=>({...p,recur:e.target.value}))} style={inp}>
                {RECUR.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              {taskForm.recur==='custom'&&<input value={taskForm.customRecur} onChange={e=>setTaskForm(p=>({...p,customRecur:e.target.value}))} placeholder="e.g. every 3 days" style={{...inp,marginTop:8}}/>}
            </div>
            <div style={{marginBottom:14}}><Lbl>Notes</Lbl><textarea value={taskForm.notes} onChange={e=>setTaskForm(p=>({...p,notes:e.target.value}))} placeholder="Details…" rows={2} style={{...inp,resize:'vertical'}}/></div>
            <div style={{marginBottom:16}}><Lbl>Subtasks</Lbl>
              {taskForm.subtasks.map(s=>(
                <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:`1px solid ${T.brd}`}}>
                  <span style={{fontSize:13,color:T.txt,flex:1}}>• {s.title}</span>
                  <button onClick={()=>setTaskForm(p=>({...p,subtasks:p.subtasks.filter(x=>x.id!==s.id)}))} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,color:T.txt3}}>✕</button>
                </div>
              ))}
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <input value={subIn} onChange={e=>setSubIn(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSub()} placeholder="Add subtask, press Enter…" style={{flex:1,background:T.sur2,border:`1.5px solid ${T.brd}`,borderRadius:8,padding:'8px 12px',fontSize:13,color:T.txt,fontFamily:'inherit',outline:'none'}}/>
                <button onClick={addSub} style={{background:T.sur2,border:`1px solid ${T.brd}`,borderRadius:8,padding:'8px 12px',cursor:'pointer',fontSize:13,color:T.txt}}>+ Add</button>
              </div>
            </div>
            <div style={{display:'flex',gap:16,marginBottom:20,flexWrap:'wrap'}}>
              {[{k:'inToday',l:'Add to Today'},{k:'pinned',l:'📌 Pin'}].map(({k,l})=>(
                <label key={k} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                  <div onClick={()=>setTaskForm(p=>({...p,[k]:!p[k]}))} style={{width:44,height:24,borderRadius:12,cursor:'pointer',background:taskForm[k]?'#FF6B35':T.brd,position:'relative',transition:'background .2s',flexShrink:0}}>
                    <div style={{position:'absolute',top:2,left:taskForm[k]?22:2,width:20,height:20,borderRadius:'50%',background:'white',transition:'left .2s',boxShadow:'0 1px 4px rgba(0,0,0,.2)'}}/>
                  </div>
                  <span style={{fontSize:13,color:T.txt}}>{l}</span>
                </label>
              ))}
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>{setModal(null);setEditTid(null);setTaskForm(BLANK);}} style={{background:T.sur2,border:`1px solid ${T.brd}`,borderRadius:100,padding:'9px 18px',fontSize:14,fontWeight:600,color:T.txt,cursor:'pointer'}}>Cancel</button>
              <button onClick={saveTask} style={{background:'#FF6B35',border:'none',borderRadius:100,padding:'9px 22px',fontSize:14,fontWeight:700,color:'white',cursor:'pointer'}}>{modal==='edit-task'?'Save':'Add Task'}</button>
            </div>
          </div>
        </div>
      )}

      {(modal==='add-project'||modal==='edit-project')&&(
        <div onClick={e=>e.target===e.currentTarget&&setModal(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(8px)'}}>
          <div style={{background:T.sur,borderRadius:20,padding:24,width:'100%',maxWidth:420,maxHeight:'88vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
            <div style={{fontFamily:"'Lora',Georgia,serif",fontSize:20,fontWeight:700,marginBottom:20,color:T.txt}}>{editPid?'Edit Project':'New Project'}</div>
            <div style={{marginBottom:14}}><Lbl>Name</Lbl><input autoFocus value={projForm.name} onChange={e=>setProjForm(p=>({...p,name:e.target.value}))} placeholder="Project name…" style={inp}/></div>
            <div style={{marginBottom:14}}><Lbl>Emoji</Lbl>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {EMOJIS.map(e=><button key={e} onClick={()=>setProjForm(p=>({...p,emoji:e}))} style={{width:36,height:36,border:projForm.emoji===e?'2px solid #FF6B35':`1.5px solid ${T.brd}`,borderRadius:8,background:T.sur2,cursor:'pointer',fontSize:18}}>{e}</button>)}
              </div>
            </div>
            <div style={{marginBottom:20}}><Lbl>Colour</Lbl>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                {COLORS.map(c=><div key={c} onClick={()=>setProjForm(p=>({...p,color:c}))} style={{width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',border:projForm.color===c?`3px solid ${T.txt}`:'2px solid transparent'}}/>)}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="color" value={projForm.color} onChange={e=>setProjForm(p=>({...p,color:e.target.value}))} style={{width:36,height:36,borderRadius:8,border:`1.5px solid ${T.brd}`,cursor:'pointer',padding:2}}/>
                <input value={projForm.color} onChange={e=>setProjForm(p=>({...p,color:e.target.value}))} placeholder="#hex" style={{flex:1,...inp,padding:'8px 12px',fontSize:13}}/>
              </div>
            </div>
            {projForm.name&&(
              <div style={{padding:'12px 16px',borderRadius:12,background:hl(projForm.color),marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:24}}>{projForm.emoji}</span>
                <span style={{fontSize:16,fontWeight:700,color:projForm.color}}>{projForm.name}</span>
              </div>
            )}
            <div style={{display:'flex',gap:10,justifyContent:'space-between'}}>
              {editPid&&<button onClick={()=>delProj(editPid)} style={{background:'#FF3B3010',border:'1px solid #FF3B3040',borderRadius:100,padding:'9px 16px',fontSize:13,fontWeight:600,color:'#FF3B30',cursor:'pointer'}}>Delete</button>}
              <div style={{display:'flex',gap:10,marginLeft:'auto'}}>
                <button onClick={()=>{setModal(null);setEditPid(null);}} style={{background:T.sur2,border:`1px solid ${T.brd}`,borderRadius:100,padding:'9px 18px',fontSize:14,fontWeight:600,color:T.txt,cursor:'pointer'}}>Cancel</button>
                <button onClick={saveProj} style={{background:'#FF6B35',border:'none',borderRadius:100,padding:'9px 22px',fontSize:14,fontWeight:700,color:'white',cursor:'pointer'}}>{editPid?'Save':'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal==='voice'&&(
        <div onClick={e=>e.target===e.currentTarget&&setModal(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(8px)'}}>
          <div style={{background:T.sur,borderRadius:20,padding:28,width:'100%',maxWidth:460,boxShadow:'0 20px 60px rgba(0,0,0,.25)',textAlign:'center'}}>
            <div style={{fontFamily:"'Lora',Georgia,serif",fontSize:20,fontWeight:700,marginBottom:6,color:T.txt}}>Voice Task</div>
            <p style={{fontSize:13,color:T.txt2,marginBottom:20,lineHeight:1.5}}>Speak naturally. Mention a project, say "today", or list subtasks.</p>
            <button onClick={listening?stopVoice:startVoice} style={{width:86,height:86,borderRadius:'50%',background:listening?'#FF3B30':'#FF6B35',border:'none',cursor:'pointer',fontSize:34,animation:listening?'pulse 1.5s infinite':'none',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',color:'white'}}>🎙️</button>
            <p style={{fontSize:12,color:T.txt3,marginBottom:14}}>{listening?'🔴 Listening…':'Tap to speak · V key'}</p>
            <div style={{background:T.sur2,border:`1.5px solid ${T.brd}`,borderRadius:12,padding:14,minHeight:50,marginBottom:12,textAlign:'left'}}>
              {transcript
                ?<input value={transcript} onChange={e=>setTranscript(e.target.value)} style={{width:'100%',background:'none',border:'none',fontSize:14,color:T.txt,fontFamily:'inherit',outline:'none'}}/>
                :<span style={{fontSize:13,color:T.txt3,fontStyle:'italic'}}>Speech appears here…</span>}
            </div>
            {transcript&&!parsed&&(
              <button onClick={parseAI} disabled={vLoad} style={{background:T.sur2,border:`1px solid ${T.brd}`,borderRadius:100,padding:'8px 18px',fontSize:13,fontWeight:600,color:T.txt,cursor:'pointer',marginBottom:14,width:'100%'}}>{vLoad?'Analysing…':'🤖 Parse with AI →'}</button>
            )}
            {parsed&&(
              <div style={{background:T.sur2,border:'1.5px solid #FF6B3540',borderRadius:12,padding:14,marginBottom:14,textAlign:'left'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#FF6B35',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.5px'}}>AI parsed — edit if needed</div>
                <div style={{marginBottom:8}}><Lbl>Task</Lbl><input value={parsed.title} onChange={e=>setParsed(p=>({...p,title:e.target.value}))} style={{...inp,fontSize:13,padding:'7px 10px'}}/></div>
                <div style={{marginBottom:8}}><Lbl>Project</Lbl>
                  <select value={parsed.projectId} onChange={e=>setParsed(p=>({...p,projectId:e.target.value}))} style={{...inp,fontSize:13,padding:'7px 10px'}}>
                    <option value="">No project</option>
                    {projects.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                  </select>
                </div>
                {parsed.subtasks?.length>0&&(
                  <div style={{marginBottom:8}}><Lbl>Subtasks</Lbl>{parsed.subtasks.map(s=><div key={s.id} style={{fontSize:12,color:T.txt,padding:'2px 0'}}>• {s.title}</div>)}</div>
                )}
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginTop:8}}>
                  <div onClick={()=>setParsed(p=>({...p,inToday:!p.inToday}))} style={{width:38,height:22,borderRadius:11,cursor:'pointer',background:parsed.inToday?'#FF6B35':T.brd,position:'relative',transition:'background .2s',flexShrink:0}}>
                    <div style={{position:'absolute',top:2,left:parsed.inToday?18:2,width:18,height:18,borderRadius:'50%',background:'white',transition:'left .2s'}}/>
                  </div>
                  <span style={{fontSize:12,color:T.txt}}>Add to Today</span>
                </label>
              </div>
            )}
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <button onClick={()=>{stopVoice();setModal(null);setParsed(null);setTranscript('');}} style={{background:T.sur2,border:`1px solid ${T.brd}`,borderRadius:100,padding:'9px 18px',fontSize:14,fontWeight:600,color:T.txt,cursor:'pointer'}}>Cancel</button>
              {parsed&&<button onClick={confirmVoice} style={{background:'#FF6B35',border:'none',borderRadius:100,padding:'9px 22px',fontSize:14,fontWeight:700,color:'white',cursor:'pointer'}}>Save Task</button>}
              {!parsed&&transcript&&<button onClick={()=>{upd(prev=>({...prev,tasks:[...prev.tasks,{id:genId(),title:transcript.trim(),projectId:null,subtasks:[],notes:'',done:false,inToday:false,pinned:false,archived:false,completedAt:null,createdAt:Date.now(),recur:''}]}));setModal(null);setTranscript('');}} style={{background:T.sur2,border:`1px solid ${T.brd}`,borderRadius:100,padding:'9px 18px',fontSize:13,fontWeight:600,color:T.txt,cursor:'pointer'}}>Save as-is</button>}
            </div>
          </div>
        </div>
      )}

      {modal==='search'&&(
        <div onClick={e=>e.target===e.currentTarget&&setModal(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:500,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'60px 20px 20px',backdropFilter:'blur(8px)'}}>
          <div style={{background:T.sur,borderRadius:20,width:'100%',maxWidth:560,boxShadow:'0 20px 60px rgba(0,0,0,.25)',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.brd}`,display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:18,color:T.txt3}}>🔍</span>
              <input autoFocus value={srchQ} onChange={e=>setSrchQ(e.target.value)} placeholder="Search tasks, subtasks, projects…" style={{flex:1,background:'none',border:'none',fontSize:16,color:T.txt,fontFamily:'inherit',outline:'none'}}/>
              {srchQ&&<button onClick={()=>setSrchQ('')} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:T.txt3}}>✕</button>}
            </div>
            <div style={{maxHeight:420,overflowY:'auto'}}>
              {!srchQ&&<div style={{padding:'40px 20px',textAlign:'center',color:T.txt3,fontSize:13}}>Start typing to search</div>}
              {srchQ&&srchRes().length===0&&<div style={{padding:'40px 20px',textAlign:'center',color:T.txt3,fontSize:13}}>No results for "{srchQ}"</div>}
              {srchRes().map(t=>{
                const proj=t._proj;
                return (
                  <div key={t.id} onClick={()=>{if(t.projectId){setView(`project-${t.projectId}`);}else{setView('dashboard');}setModal(null);}} style={{padding:'12px 20px',borderBottom:`1px solid ${T.brd}`,display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                    <div style={{width:4,height:36,borderRadius:2,background:proj?.color||T.brd,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:500,color:T.txt,textDecoration:t.done?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>
                      <div style={{fontSize:11,color:T.txt3,marginTop:2}}>{proj?`${proj.emoji} ${proj.name}`:'Misc'}{t._arch?' · 📦 Archived':''}{t.inToday?' · ☀️ Today':''}</div>
                    </div>
                    {t.done&&<span style={{fontSize:12,color:T.txt3}}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
