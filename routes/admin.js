const express = require('express');
const router = express.Router();
const db = require('../db/database');

// --- MIDDLEWARE ---
// Ce middleware est exécuté après chaque modification des services
// pour s'assurer que le cache en mémoire est toujours à jour.
const reloadServicesCache = async (req, res, next) => {
    await req.app.locals.loadServicesIntoCache();
    // next(); // Pas nécessaire si c'est le dernier middleware de la chaîne
};

// --- ROUTES ADMIN ---
// Préfixe de route dans server.js : /api/admin

// --- CRUD pour les Services ---
router.get('/services', (req, res) => {
    res.json(req.app.locals.services);
});

router.post('/services', async (req, res) => {
    const { title, duration, price } = req.body;
    if (!title || !duration || !price) return res.status(400).json({ message: "Paramètres manquants." });
    try {
        const result = await db.runAsync("INSERT INTO services (title, duration, price) VALUES (?, ?, ?)", [title, duration, price]);
        await req.app.locals.loadServicesIntoCache(); // Mise à jour du cache
        res.status(201).json({ success: true, id: result.lastID });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.put('/services/:id', async (req, res) => {
    const { title, duration, price } = req.body;
    if (!title || !duration || !price) return res.status(400).json({ message: "Paramètres manquants." });
    try {
        const result = await db.runAsync("UPDATE services SET title = ?, duration = ?, price = ? WHERE id = ?", [title, duration, price, req.params.id]);
        if (result.changes === 0) return res.status(404).json({ message: "Service non trouvé." });
        await req.app.locals.loadServicesIntoCache(); // Mise à jour du cache
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.delete('/services/:id', async (req, res) => {
    try {
        const result = await db.runAsync("DELETE FROM services WHERE id = ?", [req.params.id]);
        if (result.changes === 0) return res.status(404).json({ message: "Service non trouvé." });
        await req.app.locals.loadServicesIntoCache(); // Mise à jour du cache
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});


// --- Gestion des Rendez-vous ---
router.get('/day-appointments', async (req,res)=>{
    const { day } = req.query;
    if (!day) return res.status(400).json([]);
    try {
        const startDay = day + "T00:00:00.000Z";
        const endDay = day + "T23:59:59.999Z";
        const rows = await db.queryAsync("SELECT * FROM appointments WHERE start >= ? AND start <= ? ORDER BY start", [startDay, endDay]);
        res.json(rows);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.post('/month-appointments', async (req,res)=>{
    const { days } = req.body;
    if (!days || !Array.isArray(days)) return res.json({ dayCounts: {} });
    const dayCounts = {};
    try {
        for (const dStr of days) {
            const startDay = dStr + "T00:00:00.000Z";
            const endDay = dStr + "T23:59:59.999Z";
            const rows = await db.queryAsync("SELECT COUNT(*) as c FROM appointments WHERE start >= ? AND start <= ?", [startDay, endDay]);
            dayCounts[dStr] = (rows && rows[0]) ? rows[0].c : 0;
        }
        res.json({ dayCounts });
    } catch (e) {
        res.json({ dayCounts: {} });
    }
});

router.delete('/appointments/:id', async (req, res) => {
    try {
        const result = await db.runAsync("DELETE FROM appointments WHERE id = ?", [req.params.id]);
        if (result.changes === 0) return res.status(404).json({ message: "Rendez-vous non trouvé." });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});


// --- Gestion des Blocages / Vacances ---
router.get('/blocks', async (req, res) => {
    try {
        const rows = await db.queryAsync("SELECT * FROM blocked_slots ORDER BY start DESC");
        res.json(rows);
    } catch(e) {
        res.status(500).json({ message: "Erreur interne." });
    }
});

router.post('/block', async (req,res)=>{
  const {start,end,reason}=req.body;
  if(!start||!end) return res.status(400).json({ message:"Paramètres manquants" });
  try {
    const result = await db.runAsync("INSERT INTO blocked_slots (start,end,reason,type) VALUES(?,?,?,?)", [start,end,reason||'','BLOCK']);
    res.status(201).json({ success:true, id: result.lastID });
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/vacation', async (req,res)=>{
  const {start,end,reason}=req.body;
  if(!start||!end) return res.status(400).json({ message:"Paramètres manquants" });
  try {
    const result = await db.runAsync("INSERT INTO blocked_slots (start,end,reason,type) VALUES(?,?,?,?)", [start,end,reason||'Vacances','VACATION']);
    res.status(201).json({ success:true, id: result.lastID });
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete('/blocks/:id', async (req,res)=>{
    try {
        const result = await db.runAsync("DELETE FROM blocked_slots WHERE id = ?", [req.params.id]);
        if (result.changes === 0) return res.status(404).json({ message: "Blocage non trouvé." });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});


// --- Gestion des Horaires ---
router.get('/hours', async (req, res) => {
    try {
        const rows = await db.queryAsync("SELECT * FROM working_hours ORDER BY day_of_week");
        res.json(rows);
    } catch(e) {
        res.status(500).json({ message: "Erreur interne." });
    }
});

router.post('/hours', async (req,res)=>{
  const { day_of_week, start, end } = req.body;
  if (!day_of_week) return res.status(400).json({ message: "Jour de la semaine manquant." });
  try {
    await db.runAsync("INSERT OR REPLACE INTO working_hours(day_of_week,start,end) VALUES(?,?,?)", [day_of_week, start || null, end || null]);
    res.json({ success:true });
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
});


module.exports = router;
