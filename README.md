# Salon Lumière - Site Web de Réservation en Ligne

## 📋 Description

Site web complet pour le Salon Lumière, un barbier-coiffeur artisan établi à Lyon depuis 1997. L'application permet la prise de rendez-vous en ligne, la gestion administrative des services, et met en valeur l'exposition d'art permanente du salon.

### Fonctionnalités principales

- **Système de réservation en ligne** avec calendrier interactif
- **Interface d'administration** complète et sécurisée
- **Dashboard analytique** avec statistiques en temps réel
- **Design responsive** optimisé pour tous les appareils
- **SEO optimisé** pour un meilleur référencement local
- **Galerie d'exposition** avec carrousel d'images

## 🚀 Technologies utilisées

### Backend
- **Node.js** (v14+)
- **Express.js** - Framework web
- **SQLite3** - Base de données légère
- **express-session** - Gestion des sessions
- **crypto** - Authentification sécurisée
- **he** - Protection XSS
- **dotenv** - Variables d'environnement

### Frontend
- **HTML5** sémantique avec ARIA
- **CSS3** moderne avec animations
- **JavaScript vanilla** (ES6+)
- **FullCalendar** - Calendrier admin
- **Chart.js** - Graphiques dashboard

## 📁 Structure du projet

```
barber-lyon/
├── db/
│   ├── database.js      # Configuration et helpers SQLite
│   ├── initdb.js        # Script d'initialisation BDD
│   └── database.db      # Base de données SQLite
├── public/
│   ├── index.html       # Page principale
│   ├── admin.html       # Interface d'administration
│   ├── login.html       # Page de connexion
│   ├── styles.css       # Styles CSS complets
│   ├── script.js        # JS côté client
│   ├── admin.js         # JS administration
│   └── image/           # Images du site
├── routes/
│   ├── public.js        # API publique
│   └── admin.js         # API administration
├── server.js            # Serveur Express principal
├── package.json         # Dépendances NPM
├── .env                 # Variables d'environnement
└── README.md            # Documentation
```

## 🛠️ Installation

### Prérequis
- Node.js (v14 ou supérieur)
- NPM ou Yarn
- Git

### Étapes d'installation

1. **Cloner le repository**
```bash
git clone https://github.com/votre-username/salon-lumiere.git
cd salon-lumiere
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer les variables d'environnement**
Créer un fichier `.env` à la racine :
```env
# Port du serveur (optionnel, défaut: 3000)
PORT=3000

# Secret de session (générer une chaîne aléatoire sécurisée)
SESSION_SECRET=votre_secret_de_session_tres_long_et_aleatoire

# Identifiants admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=hash_sha256_du_mot_de_passe
```

4. **Générer le hash du mot de passe admin**
```bash
# Dans Node.js REPL ou un script :
const crypto = require('crypto');
const password = 'votre_mot_de_passe_securise';
const hash = crypto.createHash('sha256').update(password).digest('hex');
console.log(hash);
```

5. **Initialiser la base de données**
```bash
node db/initdb.js
```

6. **Démarrer le serveur**
```bash
npm start
```

Le site sera accessible sur `http://localhost:3000`

## 💻 Utilisation

### Partie publique
- **Accueil** : Présentation du salon et de ses services
- **Services** : Liste des prestations avec tarifs
- **Réservation** : Système de prise de RDV en 4 étapes
- **Exposition** : Galerie des œuvres exposées

### Administration (`/admin`)
1. Se connecter avec les identifiants configurés
2. Accès aux fonctionnalités :
   - **Dashboard** : KPIs et graphiques
   - **Planning** : Calendrier des RDV (FullCalendar)
   - **Services** : Gestion des prestations
   - **Horaires** : Configuration des heures d'ouverture
   - **Blocages** : Gestion des indisponibilités

## 🌐 Déploiement

### Option 1 : Déploiement sur VPS/Serveur dédié

1. **Préparer le serveur**
```bash
# Installer Node.js et PM2
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

2. **Configurer Nginx (reverse proxy)**
```nginx
server {
    listen 80;
    server_name salon-lumiere-lyon.fr www.salon-lumiere-lyon.fr;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. **Démarrer avec PM2**
```bash
pm2 start server.js --name salon-lumiere
pm2 save
pm2 startup
```

### Option 2 : Déploiement sur Heroku

1. **Créer `Procfile`**
```
web: node server.js
```

2. **Déployer**
```bash
heroku create salon-lumiere
git push heroku main
heroku config:set SESSION_SECRET=votre_secret
heroku config:set ADMIN_USERNAME=admin
heroku config:set ADMIN_PASSWORD_HASH=votre_hash
```

### Option 3 : Déploiement sur Railway/Render

Ces plateformes détectent automatiquement les applications Node.js :
1. Connecter le repository GitHub
2. Configurer les variables d'environnement
3. Déployer automatiquement

## 🔒 Sécurité

- **Authentification** : Hash SHA-256 + timing-safe comparison
- **Sessions** : Sécurisées avec secret aléatoire
- **Protection XSS** : Encodage HTML des entrées utilisateur
- **HTTPS** : Configurer SSL en production
- **Headers de sécurité** : À ajouter via middleware

### Recommandations de sécurité
```javascript
// Ajouter dans server.js pour la production
const helmet = require('helmet');
app.use(helmet());

// Limiter les tentatives de connexion
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // 5 tentatives max
});
app.use('/login', loginLimiter);
```

## 📱 Responsive Design

Le site est entièrement responsive avec des breakpoints :
- **Mobile** : < 768px
- **Tablette** : 768px - 1024px
- **Desktop** : > 1024px

Optimisations mobiles :
- Navigation adaptative
- Calendrier tactile
- Formulaires optimisés
- Performance améliorée

## 🔍 SEO

### Optimisations implémentées
- Balises meta complètes
- Open Graph pour réseaux sociaux
- Schema.org pour rich snippets
- URLs canoniques
- Sitemap XML (à ajouter)
- Performance optimisée

### Créer un sitemap.xml
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://salon-lumiere-lyon.fr/</loc>
    <lastmod>2025-01-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

## 🧪 Tests

### Tests manuels recommandés
1. **Réservation** : Tester le parcours complet
2. **Admin** : Vérifier toutes les fonctionnalités CRUD
3. **Responsive** : Tester sur différents appareils
4. **Performance** : Lighthouse audit

### Tests automatisés (à implémenter)
```bash
# Installer les dépendances de test
npm install --save-dev jest supertest

# Créer des tests
# test/api.test.js
```

## 🚧 Améliorations futures

- [ ] Système de notifications email
- [ ] Rappels SMS automatiques
- [ ] Paiement en ligne
- [ ] Multi-langue (FR/EN)
- [ ] Application mobile
- [ ] Système de fidélité
- [ ] Avis clients intégrés
- [ ] Export PDF des factures

## 📝 Maintenance

### Sauvegarde de la base de données
```bash
# Script de backup quotidien
cp db/database.db backups/database_$(date +%Y%m%d).db
```

### Logs et monitoring
- Utiliser PM2 pour les logs : `pm2 logs salon-lumiere`
- Configurer des alertes (Uptime Robot, etc.)

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence propriétaire. Tous droits réservés © 2025 Salon Lumière.

## 👥 Contact

**Salon Lumière**
- 📍 39 avenue des frères Lumière, 69008 LYON
- 📞 04 78 00 51 64
- 🌐 [salon-lumiere-lyon.fr](https://salon-lumiere-lyon.fr)

---

Développé avec ❤️ pour le Salon Lumière