const express = require('express');
const router = express.Router();
const db = require('../db/database');
const he = require('he'); // Importation de la bibliothèque pour l'encodage des entités HTML

/**
 * Calcule les créneaux horaires disponibles pour une journée et un service donnés.
 * @param {string} dateStr - La date cible au format YYYY-MM-DD.
 * @param {object} service - L'objet service contenant au minimum { id, duration }.
 * @returns {Promise<Array<{start: string, end: string}>>} Une promesse qui se résout avec un tableau de créneaux disponibles.
 */
async function getAvailableSlotsForDay(dateStr, service) {
    const dayDate = new Date(dateStr + "T00:00:00.000Z"); // Utilise UTC pour éviter les décalages horaires
    const dayOfWeek = dayDate.getUTCDay(); // Dimanche = 0, Lundi = 1, ...
    const sqliteDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // SQLite utilise Lundi (1) à Dimanche (7)

    const workingHours = await db.queryAsync("SELECT start, end FROM working_hours WHERE day_of_week = ?", [sqliteDayOfWeek]);
    if (workingHours.length === 0 || !workingHours[0].start || !workingHours[0].end) {
        return []; // Pas d'horaires de travail définis pour ce jour
    }

    // Création des heures de début et de fin de la journée de travail en UTC
    const [startHour, startMinute] = workingHours[0].start.split(':').map(Number);
    const [endHour, endMinute] = workingHours[0].end.split(':').map(Number);
    const workDayStart = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate(), startHour, startMinute));
    const workDayEnd = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate(), endHour, endMinute));

    const dayStartISO = workDayStart.toISOString();
    const dayEndISO = workDayEnd.toISOString();
    
    // Récupération de tous les rendez-vous et blocages pour la journée
    const appointments = await db.queryAsync("SELECT start, end FROM appointments WHERE start >= ? AND start < ?", [dayStartISO, dayEndISO]);
    const blocks = await db.queryAsync("SELECT start, end FROM blocked_slots WHERE (start < ? AND end > ?)", [dayEndISO, dayStartISO]);
    
    // Concaténation de tous les créneaux occupés
    const allBookedSlots = [...appointments, ...blocks].map(slot => ({
        start: new Date(slot.start),
        end: new Date(slot.end)
    }));
    
    const availableSlots = [];
    let currentTime = new Date(workDayStart);
    const now = new Date();
    const slotIncrement = 15; // "Pas" du calendrier pour vérifier la disponibilité (en minutes)

    while (currentTime < workDayEnd) {
        const slotStart = new Date(currentTime);
        const slotEnd = new Date(slotStart.getTime() + service.duration * 60000);

        if (slotEnd > workDayEnd) {
            break; // Le créneau dépasse la fin de la journée de travail
        }
        
        // Vérifie si le créneau potentiel est déjà dans le passé
        if (slotStart < now) {
            currentTime.setUTCMinutes(currentTime.getUTCMinutes() + slotIncrement);
            continue;
        }

        // Vérifie si le créneau potentiel chevauche un créneau déjà réservé
        const isOverlapping = allBookedSlots.some(
            bookedSlot => slotStart < bookedSlot.end && slotEnd > bookedSlot.start
        );
        
        if (!isOverlapping) {
            availableSlots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
        }
        
        currentTime.setUTCMinutes(currentTime.getUTCMinutes() + slotIncrement);
    }
    
    return availableSlots;
}


// --- ROUTES PUBLIQUES (/api) ---

// Récupère la liste de tous les services depuis le cache
router.get('/services', (req, res) => {
  res.json(req.app.locals.services || []);
});

// Récupère les créneaux disponibles pour un jour donné
router.get('/timeslots/day', async (req, res) => {
  const { date, serviceId } = req.query;
  if (!date || !serviceId) {
    return res.status(400).json({ message: "Les paramètres 'date' et 'serviceId' sont requis." });
  }

  const service = req.app.locals.services.find(s => s.id == serviceId);
  if (!service) {
    return res.status(404).json({ message: "Le service demandé n'existe pas." });
  }

  try {
    const slots = await getAvailableSlotsForDay(date, service);
    res.json({ slots });
  } catch (e) {
    console.error("Erreur lors du calcul des créneaux:", e);
    res.status(500).json({ message: "Erreur interne du serveur lors de la recherche de créneaux." });
  }
});

// Récupère les 5 prochains créneaux disponibles
router.get('/timeslots/next-five', async (req, res) => {
    const { serviceId } = req.query;
    if (!serviceId) {
        return res.status(400).json({ message: "Le paramètre 'serviceId' est requis." });
    }
    const service = req.app.locals.services.find(s => s.id == serviceId);
    if (!service) {
        return res.status(404).json({ message: "Service inconnu." });
    }

    try {
        let checkDate = new Date();
        const nextSlots = [];
        const searchLimitInDays = 60;

        for (let i = 0; i < searchLimitInDays && nextSlots.length < 5; i++) {
            const dateStr = checkDate.toISOString().split('T')[0];
            const slotsForDay = await getAvailableSlotsForDay(dateStr, service);
            
            for (const slot of slotsForDay) {
                if (nextSlots.length < 5) {
                    nextSlots.push(slot);
                } else {
                    break;
                }
            }
            checkDate.setDate(checkDate.getDate() + 1);
        }
        res.json({ slots: nextSlots });
    } catch (e) {
        console.error("Erreur lors de la recherche des prochains créneaux:", e);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});


// Crée un nouveau rendez-vous
router.post('/appointments', async (req, res) => {
    const { title, start, end, phone, serviceId, serviceName } = req.body;
    if (!title || !start || !end || !phone || !serviceId || !serviceName) {
        return res.status(400).json({ message: "Tous les champs sont requis pour la prise de rendez-vous." });
    }

    await db.beginTransaction();
    try {
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
            await db.rollback();
            return res.status(400).json({ message: "Le format de date ou de créneau est invalide." });
        }

        // Verrouillage de la table en vérifiant les conflits à l'intérieur de la transaction
        const conflicts = await db.queryAsync("SELECT id FROM appointments WHERE (start < ? AND end > ?)", [end, start]);
        if (conflicts.length > 0) {
            await db.rollback();
            return res.status(409).json({ message: "Désolé, ce créneau vient d'être réservé. Veuillez en choisir un autre." });
        }

        const blocks = await db.queryAsync("SELECT id FROM blocked_slots WHERE (start < ? AND end > ?)", [end, start]);
        if (blocks.length > 0) {
            await db.rollback();
            return res.status(409).json({ message: "Ce créneau est indisponible pour des raisons internes. Veuillez en choisir un autre." });
        }
        
        // Nettoyage de l'entrée utilisateur pour prévenir les failles XSS
        const sanitizedName = he.encode(title.trim());
        const fullTitle = `${serviceName} - ${sanitizedName}`;
        
        const result = await db.runAsync(
            "INSERT INTO appointments (title, start, end, phone, service_id) VALUES (?, ?, ?, ?, ?)",
            [fullTitle, start, end, phone, serviceId]
        );
        
        await db.commit();
        res.status(201).json({ success: true, id: result.lastID, message: "Rendez-vous confirmé avec succès." });

    } catch (e) {
        await db.rollback();
        console.error("Erreur serveur lors de la création du rendez-vous:", e);
        res.status(500).json({ message: "Une erreur interne est survenue lors de la création du rendez-vous." });
    }
});

module.exports = router;
