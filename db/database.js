const sqlite3 = require('sqlite3').verbose();

// Initialise la connexion à la base de données.
// Le fichier database.db sera créé dans le dossier /db s'il n'existe pas.
const db = new sqlite3.Database('./db/database.db', (err) => {
    if (err) {
        console.error("Erreur critique de connexion à la base de données SQLite:", err.message);
        // L'application ne peut pas fonctionner sans BDD, donc on arrête le processus.
        process.exit(1);
    } else {
        console.log("Connecté à la base de données SQLite.");
        // Activation des contraintes de clé étrangère pour assurer l'intégrité des données.
        // Doit être activé après chaque connexion pour SQLite.
        db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
            if (pragmaErr) {
                console.error("Erreur lors de l'activation des clés étrangères:", pragmaErr.message);
            } else {
                console.log("Les contraintes de clés étrangères sont activées.");
            }
        });
    }
});

/**
 * Exécute une requête SELECT (qui retourne des lignes) de manière asynchrone.
 * Enrobe db.all dans une Promesse pour une utilisation avec async/await.
 * @param {string} sql - La requête SQL à exécuter.
 * @param {Array} [params=[]] - Les paramètres pour la requête préparée.
 * @returns {Promise<Array>} Une promesse qui résout avec un tableau des lignes de résultat.
 */
db.queryAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    // Utilise .all() pour les requêtes qui retournent plusieurs lignes (SELECT)
    this.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Erreur de requête (queryAsync):', { sql, params, error: err.message });
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

/**
 * Exécute une requête d'écriture (INSERT, UPDATE, DELETE) de manière asynchrone.
 * Enrobe db.run dans une Promesse pour une utilisation avec async/await.
 * @param {string} sql - La requête SQL à exécuter.
 * @param {Array} [params=[]] - Les paramètres pour la requête préparée.
 * @returns {Promise<{lastID: number, changes: number}>} Une promesse qui résout avec l'ID de la dernière ligne insérée et le nombre de lignes modifiées.
 */
db.runAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    // Utilise .run() pour les commandes SQL qui ne retournent pas de données (INSERT, UPDATE, DELETE)
    this.run(sql, params, function (err) {
      if (err) {
        console.error('Erreur de requête (runAsync):', { sql, params, error: err.message });
        reject(err);
      } else {
        // 'this' est fourni par la fonction de callback de sqlite3 et contient les métadonnées de l'exécution.
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};


/**
 * Démarre une transaction SQL.
 * @returns {Promise<void>} Une promesse qui se résout quand la transaction est démarrée.
 */
db.beginTransaction = function () {
    return new Promise((resolve, reject) => {
        this.run('BEGIN TRANSACTION', (err) => (err ? reject(err) : resolve()));
    });
};

/**
 * Valide (COMMIT) la transaction en cours.
 * @returns {Promise<void>} Une promesse qui se résout quand la transaction est validée.
 */
db.commit = function () {
    return new Promise((resolve, reject) => {
        this.run('COMMIT', (err) => (err ? reject(err) : resolve()));
    });
};

/**
 * Annule (ROLLBACK) la transaction en cours.
 * @returns {Promise<void>} Une promesse qui se résout quand la transaction est annulée.
 */
db.rollback = function () {
    return new Promise((resolve, reject) => {
        this.run('ROLLBACK', (err) => (err ? reject(err) : resolve()));
    });
};

// Exporte l'instance de la base de données augmentée des nouvelles méthodes.
module.exports = db;
