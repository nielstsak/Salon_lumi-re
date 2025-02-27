const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');

const app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'votre_secret_de_session_ultra_secure',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

const db = new sqlite3.Database('./db/database.db');

// Hard-coded services
const services = [
  { 
    id: 1,
    title: "Tondeuse",
    duration: 20,    // durée en minutes (à ajuster selon ta réalité)
    price: 22.00
  },
  { 
    id: 2,
    title: "Ciseaux",
    duration: 30,
    price: 30.00
  },
  { 
    id: 3,
    title: "Dessin de la barbe - Tondeuse",
    duration: 15,
    price: 15.00
  },
  { 
    id: 4,
    title: "Dessin de la barbe - Ciseaux",
    duration: 30,
    price: 30.00
  },
  { 
    id: 5,
    title: "Dessin de la barbe - Rasoir",
    duration: 25,
    price: 37.00
  },
  { 
    id: 6,
    title: "Rasage complet (Serviette chaude...)",
    duration: 30,
    price: 35.00
  }
];
const ADMIN_USERNAME = "barbier";
const ADMIN_PASSWORD = "secret123";

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/login.html');
}

function queryAsync(sql, params=[]) {
  return new Promise((resolve, reject)=>{
    db.all(sql, params, (err, rows)=>{
      if(err) reject(err);
      else resolve(rows);
    });
  });
}

// =============== ROUTES ===============
app.get('/api/services',(req,res)=>{
  res.json(services);
});

// GET all appointments
app.get('/api/appointments',(req,res)=>{
  db.all("SELECT * FROM appointments",[],(err,rows)=>{
    if(err){
      console.error("DB error:",err);
      return res.status(500).json({ error:"Erreur interne" });
    }
    res.json(rows);
  });
});

// CREATE new appointment
app.post('/api/appointments',(req,res)=>{
  const { title, start, end, phone } = req.body;
  if(!title||!start||!end||!phone){
    return res.status(400).json({ error:"Paramètres manquants (titre,start,end,phone)" });
  }
  const sDate = new Date(start);
  const eDate = new Date(end);
  if(isNaN(sDate.getTime())||isNaN(eDate.getTime())){
    return res.status(400).json({ error:"Dates invalides" });
  }
  if(eDate<=sDate){
    return res.status(400).json({ error:"Créneau invalide (end <= start)" });
  }
  // conflicts
  db.all("SELECT * FROM appointments WHERE (start < ? AND end > ?)",[end,start],(err2,conf)=>{
    if(err2){
      console.error("DB error:",err2);
      return res.status(500).json({ error:"Erreur interne" });
    }
    if(conf && conf.length>0){
      return res.status(400).json({ error:"Créneau indisponible" });
    }
    // block
    db.all("SELECT * FROM blocked_slots WHERE (start < ? AND end > ?)",[end,start],(err3,blocks)=>{
      if(err3){
        console.error("DB error:",err3);
        return res.status(500).json({ error:"Erreur interne" });
      }
      if(blocks && blocks.length>0){
        return res.status(400).json({ error:"Créneau bloqué" });
      }
      // insert
      db.run("INSERT INTO appointments (title,start,end,phone) VALUES (?,?,?,?)",
        [title, start, end, phone],
        function(err4){
          if(err4){
            console.error("DB error:",err4);
            return res.status(500).json({ error:"Erreur interne" });
          }
          return res.json({ success:true, id:this.lastID });
        }
      );
    });
  });
});

// timeslots for a single day
app.get('/api/timeslots/day', async (req,res)=>{
  const { date, serviceId }=req.query;
  if(!date||!serviceId){
    return res.status(400).json({ error:"Paramètres manquants" });
  }
  const service=services.find(s=>s.id==serviceId);
  if(!service){
    return res.status(404).json({ error:"Service inconnu" });
  }
  const dayDate=new Date(date+"T00:00:00");
  const now=new Date(); now.setHours(0,0,0,0);
  if(dayDate<now){
    return res.json({ slots:[] });
  }
  let dow=dayDate.getDay()||7;
  // sat(6), sun(7) => closed
  if(dow===6||dow===7) return res.json({ slots:[] });

  try{
    const wh = await queryAsync("SELECT * FROM working_hours WHERE day_of_week=?",[dow]);
    if(!wh||wh.length===0) return res.json({ slots:[] });
    const row=wh[0];
    if(!row.start||!row.end) return res.json({ slots:[] });
    const [sh,sm]=row.start.split(':').map(Number);
    const [eh,em]=row.end.split(':').map(Number);
    const startTime=new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), sh,sm);
    const endTime=new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), eh,em);

    let currentTime=startTime;
    const outSlots=[];
    while(currentTime<endTime){
      const slotStart=new Date(currentTime);
      const slotEnd=new Date(currentTime.getTime()+ service.duration*60000);
      if(slotEnd> endTime) break;

      const conf=await queryAsync("SELECT * FROM appointments WHERE (start < ? AND end > ?)",
        [slotEnd.toISOString(), slotStart.toISOString()]);
      const blocks=await queryAsync("SELECT * FROM blocked_slots WHERE (start < ? AND end > ?)",
        [slotEnd.toISOString(), slotStart.toISOString()]);
      if((!conf||conf.length===0)&&(!blocks||blocks.length===0)){
        outSlots.push({
          start: slotStart.toISOString(),
          end:   slotEnd.toISOString()
        });
      }
      currentTime=new Date(currentTime.getTime()+30*60000);
    }
    res.json({ slots: outSlots });
  } catch(e){
    console.error("Timeslot error:", e);
    res.status(500).json({ error:"Erreur interne" });
  }
});

// ADMIN login
app.post('/login',(req,res)=>{
  const { username, password }=req.body;
  if(username===ADMIN_USERNAME && password===ADMIN_PASSWORD){
    req.session.isAdmin=true;
    return res.json({ success:true });
  }
  return res.status(401).json({ error:"Identifiants invalides" });
});
app.get('/logout',(req,res)=>{
  req.session.destroy(()=>res.redirect('/login.html'));
});
app.get('/admin', requireAdmin, (req,res)=>{
  res.sendFile(path.join(__dirname,'public','admin.html'));
});

// ADMIN: Rendez-vous CRUD
app.delete('/api/admin/appointments/:id', requireAdmin,(req,res)=>{
  const{id}=req.params;
  db.run("DELETE FROM appointments WHERE id=?",[id], function(err){
    if(err) {
      console.error("DB error:",err);
      return res.status(500).json({ error:"Erreur interne" });
    }
    res.json({ success:true });
  });
});

// ADMIN: blocks
app.post('/api/admin/block', requireAdmin,(req,res)=>{
  const {start,end,reason}=req.body;
  if(!start||!end) return res.status(400).json({ error:"Paramètres manquants" });
  db.run("INSERT INTO blocked_slots (start,end,reason,type) VALUES(?,?,?,?)",
    [start,end,reason||'','BLOCK'],
    function(err){
      if(err){
        console.error("DB error:",err);
        return res.status(500).json({ error:"Erreur interne" });
      }
      res.json({ success:true, id:this.lastID });
    }
  );
});
app.post('/api/admin/vacation', requireAdmin,(req,res)=>{
  const {start,end,reason}=req.body;
  if(!start||!end) return res.status(400).json({ error:"Paramètres manquants" });
  db.run("INSERT INTO blocked_slots (start,end,reason,type) VALUES(?,?,?,?)",
    [start,end,reason||'Vacances','VACATION'],
    function(err){
      if(err){
        console.error("DB error:",err);
        return res.status(500).json({ error:"Erreur interne" });
      }
      res.json({ success:true, id:this.lastID });
    }
  );
});
app.get('/api/admin/blocks', requireAdmin,(req,res)=>{
  db.all("SELECT * FROM blocked_slots",[],(err,rows)=>{
    if(err){
      console.error("DB error:",err);
      return res.status(500).json({ error:"Erreur interne" });
    }
    res.json(rows);
  });
});
app.delete('/api/admin/blocks/:id', requireAdmin,(req,res)=>{
  const{id}=req.params;
  db.run("DELETE FROM blocked_slots WHERE id=?",[id], function(err){
    if(err){
      console.error("DB error:",err);
      return res.status(500).json({ error:"Erreur interne" });
    }
    res.json({ success:true});
  });
});

// ADMIN: hours
app.get('/api/admin/hours', requireAdmin,(req,res)=>{
  db.all("SELECT * FROM working_hours ORDER BY day_of_week",[],(err,rows)=>{
    if(err){
      console.error("DB error:",err);
      return res.status(500).json({ error:"Erreur interne" });
    }
    res.json(rows);
  });
});
app.post('/api/admin/hours', requireAdmin,(req,res)=>{
  const { day_of_week,start,end }=req.body;
  db.run("INSERT OR REPLACE INTO working_hours(day_of_week,start,end) VALUES(?,?,?)",
    [day_of_week||null, start||null, end||null],
    (err)=>{
      if(err){
        console.error("DB error:",err);
        return res.status(500).json({ error:"Erreur interne" });
      }
      res.json({ success:true });
    }
  );
});

// ADMIN: monthly appointments => { dayCounts:{'YYYY-MM-DD': count} }
app.post('/api/admin/month-appointments', requireAdmin, async(req,res)=>{
  const { days }=req.body;
  if(!days||!Array.isArray(days)) return res.json({ dayCounts:{}});
  const dayCounts={};
  try{
    for(const dStr of days){
      const startDay = dStr+"T00:00:00";
      const endDay   = dStr+"T23:59:59.999Z";
      const rows = await queryAsync(
        "SELECT COUNT(*) as c FROM appointments WHERE start>=? AND start<=?",
        [startDay, endDay]
      );
      const c = (rows&&rows[0])?rows[0].c:0;
      dayCounts[dStr]=c;
    }
    res.json({ dayCounts });
  } catch(e){
    console.error("Month apt error:",e);
    res.json({ dayCounts:{} });
  }
});

// ADMIN: day appointments => /api/admin/day-appointments?day=YYYY-MM-DD
app.get('/api/admin/day-appointments', requireAdmin, async(req,res)=>{
  const { day }=req.query;
  if(!day) return res.json([]);
  const startDay= day+"T00:00:00";
  const endDay  = day+"T23:59:59.999Z";
  try{
    const rows=await queryAsync(
      "SELECT * FROM appointments WHERE start>=? AND start<=? ORDER BY start",
      [startDay, endDay]
    );
    res.json(rows);
  } catch(e){
    console.error("Day apt error:",e);
    res.json([]);
  }
});

// Serve login
app.get('/login.html',(req,res)=>{
  res.sendFile(path.join(__dirname,'public','login.html'));
});

const PORT = process.env.PORT||3000;
app.listen(PORT,()=>console.log("Serveur lancé sur port "+PORT));
