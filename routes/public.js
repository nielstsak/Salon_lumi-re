const express = require('express');
const router = express.Router();
const db = require('../db/database'); // Importe la connexion et les fonctions de la BDD

// --- ROUTES PUBLIQUES ---
// Préfixe de route dans server.js : /api

/**
 * GET /services
 * Fournit la liste des services disponibles depuis le cache local de l'application.
 */
router.get('/services', (req, res) => {
  // 'req.app.locals' permet d'accéder aux variables locales de l'instance Express
  res.json(req.app.locals.services);
});

/**
 * GET /timeslots/day
 * Calcule et retourne les créneaux horaires disponibles pour un jour et un service donnés.
 */
router.get('/timeslots/day', async (req, res) => {
  const { date, serviceId } = req.query;
  if (!date || !serviceId) {
    return res.status(400).json({ message: "Paramètres 'date' et 'serviceId' manquants." });
  }

  const service = req.app.locals.services.find(s => s.id == serviceId);
  if (!service) {
    return res.status(404).json({ message: "Service inconnu." });
  }

  try {
    const dayDate = new Date(date + "T00:00:00.000Z");
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (dayDate < now) return res.json({ slots: [] });

    // 0 (Dimanche) devient 7 pour correspondre à la logique de la BDD
    const dow = dayDate.getUTCDay() === 0 ? 7 : dayDate.getUTCDay();
    if ([6, 7].includes(dow)) return res.json({ slots: [] }); // Samedi, Dimanche

    const wh = await db.queryAsync("SELECT start, end FROM working_hours WHERE day_of_week = ?", [dow]);
    if (wh.length === 0 || !wh[0].start || !wh[0].end) {
        return res.json({ slots: [] });
    }
    
    const [sh, sm] = wh[0].start.split(':').map(Number);
    const [eh, em] = wh[0].end.split(':').map(Number);
    const startTime = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate(), sh, sm));
    const endTime = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate(), eh, em));

    const dayStartISO = startTime.toISOString();
    const dayEndISO = endTime.toISOString();
    
    const dayAppointments = await db.queryAsync("SELECT start, end FROM appointments WHERE start >= ? AND start < ?", [dayStartISO, dayEndISO]);
    const dayBlocks = await db.queryAsync("SELECT start, end FROM blocked_slots WHERE (start < ? AND end > ?)", [dayEndISO, dayStartISO]);
    const allBookedSlots = [...dayAppointments, ...dayBlocks].map(s => ({ start: new Date(s.start), end: new Date(s.end) }));
    
    const availableSlots = [];
    let currentTime = new Date(startTime);
    
    while (currentTime < endTime) {
        const slotStart = new Date(currentTime);
        const slotEnd = new Date(slotStart.getTime() + service.duration * 60000);
        if (slotEnd > endTime) break;
        const isOverlapping = allBookedSlots.some(booked => slotStart < booked.end && slotEnd > booked.start);
        
        // N'affiche que les créneaux futurs
        if (!isOverlapping && slotStart > new Date()) {
            availableSlots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
        }
        currentTime.setMinutes(currentTime.getMinutes() + 30);
    }
    
    res.json({ slots: availableSlots });
  } catch (e) {
    console.error("Erreur calcul des créneaux:", e);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
});


/**
 * POST /appointments
 * Crée un nouveau rendez-vous après vérification des disponibilités.
 */
router.post('/appointments', async (req, res) => {
    const { title, start, end, phone } = req.body;
    if (!title || !start || !end || !phone) {
        return res.status(400).json({ message: "Veuillez remplir tous les champs." });
    }
    try {
        const sDate = new Date(start);
        const eDate = new Date(end);
        if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || eDate <= sDate) {
            return res.status(400).json({ message: "Format de date ou de créneau invalide." });
        }

        const conflicts = await db.queryAsync("SELECT id FROM appointments WHERE (start < ? AND end > ?)", [end, start]);
        if (conflicts.length > 0) {
            return res.status(409).json({ message: "Désolé, ce créneau n'est plus disponible." });
        }

        const blocks = await db.queryAsync("SELECT id FROM blocked_slots WHERE (start < ? AND end > ?)", [end, start]);
        if (blocks.length > 0) {
            return res.status(409).json({ message: "Ce créneau est indisponible." });
        }

        const result = await db.runAsync("INSERT INTO appointments (title, start, end, phone) VALUES (?, ?, ?, ?)", [title, start, end, phone]);
        res.status(201).json({ success: true, id: result.lastID });

    } catch (e) {
        console.error("Server Error (Create Appointment):", e);
        res.status(500).json({ message: "Une erreur interne est survenue." });
    }
});


module.exports = router;
