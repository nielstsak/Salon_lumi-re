// --- CONFIGURATION INITIALE ---
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./db/database'); // Importe la connexion à la BDD

// --- IMPORT DES ROUTEURS ---
// Sépare la logique des routes dans des fichiers dédiés pour une meilleure organisation.
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();

// --- MIDDLEWARES GLOBAUX ---
app.use(express.json()); // Remplace l'ancien 'body-parser' pour analyser le JSON
app.use(express.urlencoded({ extended: true })); // Pour analyser les formulaires URL-encoded
app.use(express.static(path.join(__dirname, 'public'))); // Sert les fichiers statiques (HTML, CSS, JS client)

// Configuration de la session utilisateur
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Mettre à true si vous utilisez HTTPS
    httpOnly: true, // Empêche l'accès au cookie via JavaScript côté client (sécurité)
    maxAge: 24 * 60 * 60 * 1000 // Durée de vie du cookie : 24 heures
  }
}));


// --- CACHE LOCAL POUR LES SERVICES ---
// Charge les services en mémoire au démarrage pour éviter des requêtes BDD répétées.
app.locals.loadServicesIntoCache = async () => {
    try {
        app.locals.services = await db.queryAsync("SELECT * FROM services ORDER BY id");
        console.log("Services chargés/mis à jour dans le cache.");
    } catch (err) {
        console.error("Impossible de charger les services dans le cache:", err);
    }
};

// --- GESTION DES ROUTES ---

// Routes publiques (accessibles par tous)
app.use('/api', publicRoutes);

// Routes d'administration (protégées par un middleware)
// Toutes les routes commençant par /api/admin nécessiteront d'être connecté.
app.use('/api/admin', (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next(); // L'utilisateur est admin, on continue
    }
    // L'utilisateur n'est pas admin, on renvoie une erreur d'autorisation.
    res.status(403).json({ message: "Accès non autorisé." });
}, adminRoutes);


// --- ROUTES D'AUTHENTIFICATION ET DE PAGES ---

// Connexion de l'administrateur
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Vérification des identifiants depuis les variables d'environnement
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true; // Création de la session admin
        return res.json({ success: true });
    }
    res.status(401).json({ message: "Identifiants invalides." });
});

// Déconnexion de l'administrateur
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html'); // Redirection vers la page de connexion
  });
});

// Accès à la page d'administration
app.get('/admin', (req, res) => {
    // Si l'utilisateur est connecté en tant qu'admin, on sert la page admin.
    if (req.session && req.session.isAdmin) {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        // Sinon, on le redirige vers la page de connexion.
        res.redirect('/login.html');
    }
});


// --- DÉMARRAGE DU SERVEUR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    // Charge les services en mémoire une seule fois au démarrage.
    await app.locals.loadServicesIntoCache();
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
