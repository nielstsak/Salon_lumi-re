const express = require('express');
const router = express.Router();
const db = require('../db/database');
const he = require('he'); // Importation de la bibliothèque pour le décodage des entités HTML

// --- HELPER ---
// Wrapper pour les routes asynchrones afin de capturer les erreurs et de les passer au gestionnaire d'erreurs global.
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// --- ROUTES ADMIN (préfixe /api/admin) ---

// --- CRUD pour les Services ---

// Récupère tous les services (utilise le cache pour la rapidité)
router.get('/services', asyncHandler(async (req, res) => {
    res.json(req.app.locals.services || []);
}));

// Récupère un seul service par son ID
router.get('/services/:id', asyncHandler(async (req, res) => {
    const service = await db.queryAsync("SELECT * FROM services WHERE id = ?", [req.params.id]);
    if (service.length === 0) {
        return res.status(404).json({ message: "Service non trouvé." });
    }
    res.json(service[0]);
}));

// Crée un nouveau service
router.post('/services', asyncHandler(async (req, res) => {
    const { title, duration, price } = req.body;
    if (!title || !duration || !price) {
        return res.status(400).json({ message: "Les champs titre, durée et prix sont requis." });
    }
    const result = await db.runAsync("INSERT INTO services (title, duration, price) VALUES (?, ?, ?)", [title, duration, price]);
    await req.app.locals.loadServicesIntoCache(); // Invalide et recharge le cache
    res.status(201).json({ success: true, id: result.lastID, message: "Service ajouté avec succès." });
}));

// Met à jour un service existant
router.put('/services/:id', asyncHandler(async (req, res) => {
    const { title, duration, price } = req.body;
    if (!title || !duration || !price) {
        return res.status(400).json({ message: "Les champs titre, durée et prix sont requis." });
    }
    const result = await db.runAsync("UPDATE services SET title = ?, duration = ?, price = ? WHERE id = ?", [title, duration, price, req.params.id]);
    if (result.changes === 0) return res.status(404).json({ message: "Service non trouvé." });
    await req.app.locals.loadServicesIntoCache(); // Invalide et recharge le cache
    res.json({ success: true, message: "Service mis à jour avec succès." });
}));

// Supprime un service
router.delete('/services/:id', asyncHandler(async (req, res) => {
    const result = await db.runAsync("DELETE FROM services WHERE id = ?", [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ message: "Service non trouvé." });
    await req.app.locals.loadServicesIntoCache(); // Invalide et recharge le cache
    res.json({ success: true, message: "Service supprimé avec succès." });
}));


// --- Gestion des Rendez-vous (Planning) ---
router.get('/appointments', asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
        return res.status(400).json({ message: "Les paramètres de date 'start' et 'end' sont requis." });
    }
    const appointments = await db.queryAsync("SELECT id, title, start, end FROM appointments WHERE start < ? AND end > ?", [end, start]);
    res.json(appointments.map(appt => ({
        id: appt.id,
        title: he.decode(appt.title), // Décode le titre pour un affichage correct et sécurisé dans le calendrier
        start: appt.start,
        end: appt.end,
        backgroundColor: '#d47463',
        borderColor: '#bd5c4c'
    })));
}));

router.delete('/appointments/:id', asyncHandler(async (req, res) => {
    const result = await db.runAsync("DELETE FROM appointments WHERE id = ?", [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ message: "Rendez-vous non trouvé." });
    res.json({ success: true, message: "Rendez-vous supprimé." });
}));

router.put('/appointments/:id/move', asyncHandler(async (req, res) => {
    const { start, end } = req.body;
    if (!start || !end) return res.status(400).json({ message: "Les dates de début et de fin sont requises." });
    const result = await db.runAsync("UPDATE appointments SET start = ?, end = ? WHERE id = ?", [start, end, req.params.id]);
    if (result.changes === 0) return res.status(404).json({ message: "Rendez-vous non trouvé." });
    res.json({ success: true, message: "Rendez-vous mis à jour." });
}));

// --- Endpoints pour le Dashboard (Statistiques) ---
router.get('/kpis/daily', asyncHandler(async (req, res) => {
    const today = new Date();
    const startDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
    const endDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

    const appointments = await db.queryAsync(
        `SELECT a.service_id, s.price FROM appointments a 
         JOIN services s ON a.service_id = s.id 
         WHERE a.start >= ? AND a.start <= ?`, [startDay, endDay]
    );
    
    const dailyRevenue = appointments.reduce((sum, appt) => sum + (appt.price || 0), 0);

    res.json({
        appointmentCount: appointments.length,
        estimatedRevenue: dailyRevenue
    });
}));

router.get('/charts/weekly-overview', asyncHandler(async (req, res) => {
    const services = req.app.locals.services;
    const labels = [];
    const appointmentData = [];
    const serviceCounts = {};
    
    services.forEach(s => { serviceCounts[s.id] = { name: s.title, count: 0 }; });

    for (let i = 0; i < 7; i++) {
        const baseDate = new Date();
        const targetDate = new Date(baseDate);
        targetDate.setDate(baseDate.getDate() + i);
        
        const startDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0).toISOString();
        const endDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999).toISOString();

        labels.push(targetDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }));
        
        const appointments = await db.queryAsync("SELECT service_id FROM appointments WHERE start >= ? AND start <= ?", [startDay, endDay]);
        appointmentData.push(appointments.length);
        
        appointments.forEach(appt => {
            if(appt.service_id && serviceCounts[appt.service_id]) {
                serviceCounts[appt.service_id].count++;
            }
        });
    }
    
    const popularServices = Object.values(serviceCounts)
        .filter(s => s.count > 0)
        .sort((a, b) => b.count - a.count);

    res.json({
        dailyAppointments: { labels, data: appointmentData },
        serviceDistribution: {
            labels: popularServices.map(s => s.name),
            data: popularServices.map(s => s.count)
        }
    });
}));

// --- Gestion des Horaires et Blocages ---
router.get('/hours', asyncHandler(async (req, res) => {
    const rows = await db.queryAsync("SELECT * FROM working_hours ORDER BY day_of_week");
    res.json(rows);
}));

router.post('/hours', asyncHandler(async (req, res) => {
  const { day_of_week, start, end } = req.body;
  if (day_of_week === undefined) return res.status(400).json({ message: "Jour de la semaine manquant." });
  await db.runAsync("INSERT OR REPLACE INTO working_hours(day_of_week,start,end) VALUES(?,?,?)", [day_of_week, start || null, end || null]);
  res.json({ success: true, message: "Horaire sauvegardé." });
}));

router.get('/blocks', asyncHandler(async (req, res) => {
    const rows = await db.queryAsync("SELECT * FROM blocked_slots ORDER BY start DESC");
    res.json(rows);
}));

router.post('/block', asyncHandler(async (req, res) => {
  const { start, end, reason } = req.body;
  if (!start || !end) return res.status(400).json({ message: "Les dates de début et de fin sont requises." });
  const result = await db.runAsync("INSERT INTO blocked_slots (start,end,reason,type) VALUES(?,?,?,?)", [start, end, reason || '', 'BLOCK']);
  res.status(201).json({ success: true, id: result.lastID, message: "Blocage ajouté." });
}));

router.delete('/blocks/:id', asyncHandler(async (req, res) => {
    const result = await db.runAsync("DELETE FROM blocked_slots WHERE id = ?", [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ message: "Blocage non trouvé." });
    res.json({ success: true, message: "Blocage supprimé." });
}));

module.exports = router;
