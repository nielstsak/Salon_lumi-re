// --- CONFIGURATION INITIALE ET IMPORTS ---
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto'); // Module natif pour la cryptographie
const db = require('./db/database');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();

// --- MIDDLEWARES GLOBAUX ---

// Analyse des corps de requête JSON et URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Service des fichiers statiques du dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Configuration de la session utilisateur
// Le secret doit être une chaîne longue et aléatoire stockée dans .env
app.use(session({
  secret: process.env.SESSION_SECRET || 'un-secret-par-defaut-non-securise',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Mettre à true en production avec HTTPS
    httpOnly: true, // Empêche l'accès au cookie via JavaScript côté client
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

// --- GESTION DES ERREURS ET MIDDLEWARES UTILITAIRES ---

// Middleware pour vérifier si l'utilisateur est un administrateur connecté
const isAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(403).json({ message: "Accès non autorisé. Vous devez être connecté en tant qu'administrateur." });
};

// Gestionnaire d'erreurs final pour toutes les routes
const errorHandler = (err, req, res, next) => {
    console.error("ERREUR GLOBALE CAPTURÉE:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ message: "Une erreur interne inattendue est survenue sur le serveur." });
};


// --- GESTION DES ROUTES ---

app.use('/api', publicRoutes);
app.use('/api/admin', isAdmin, adminRoutes);


// --- ROUTES SPÉCIFIQUES D'AUTHENTIFICATION ET DE PAGES ---

app.post('/login', (req, res, next) => {
    try {
        const { username, password } = req.body;

        const adminUsername = process.env.ADMIN_USERNAME;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        if (!adminUsername || !adminPasswordHash) {
            console.error("Les variables d'environnement ADMIN_USERNAME ou ADMIN_PASSWORD_HASH ne sont pas définies.");
            return res.status(500).json({ message: "Erreur de configuration du serveur." });
        }

        // 1. Hasher le mot de passe fourni par l'utilisateur
        const inputPasswordHash = crypto.createHash('sha256').update(password).digest('hex');

        // 2. Créer des buffers à partir des chaînes hexadécimales
        const inputHashBuffer = Buffer.from(inputPasswordHash, 'hex');
        const storedHashBuffer = Buffer.from(adminPasswordHash, 'hex');

        // 3. Vérifier que les buffers ont la même taille AVANT de les comparer pour éviter l'erreur.
        if (inputHashBuffer.length !== storedHashBuffer.length) {
            // Cette situation ne devrait pas se produire si le hash dans .env est correct.
            // On effectue une comparaison factice pour des raisons de sécurité (prévention d'attaques temporelles basées sur la longueur).
            crypto.timingSafeEqual(inputHashBuffer, inputHashBuffer);
            return res.status(401).json({ message: "Identifiant ou mot de passe incorrect." });
        }

        // 4. Comparer les identifiants et les hashs de manière sécurisée
        const isUsernameMatch = (username === adminUsername);
        const isPasswordMatch = crypto.timingSafeEqual(inputHashBuffer, storedHashBuffer);

        if (isUsernameMatch && isPasswordMatch) {
            req.session.isAdmin = true;
            return res.json({ success: true, message: "Connexion réussie." });
        } else {
            return res.status(401).json({ message: "Identifiant ou mot de passe incorrect." });
        }
    } catch (error) {
        // Si une erreur survient (ex: hash malformé dans .env), elle est passée au gestionnaire global.
        next(error);
    }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
        console.error("Erreur lors de la déconnexion :", err);
    }
    res.redirect('/login.html');
  });
});

app.get('/admin', (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        res.redirect('/login.html');
    }
});


// --- GESTIONNAIRE D'ERREURS ---
app.use(errorHandler);

// --- DÉMARRAGE DU SERVEUR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    await app.locals.loadServicesIntoCache();
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
