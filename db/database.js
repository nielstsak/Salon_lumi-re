const sqlite3 = require('sqlite3').verbose();

// Initialise la connexion à la base de données.
// Le fichier database.db sera créé à la racine du dossier /db s'il n'existe pas.
const db = new sqlite3.Database('./db/database.db', (err) => {
    if (err) {
        console.error("Erreur de connexion à la base de données SQLite:", err.message);
        // Quitte l'application si la BDD est inaccessible, car elle est critique.
        process.exit(1);
    } else {
        console.log("Connecté à la base de données SQLite.");
    }
});

/**
 * Exécute une requête SELECT (qui retourne des lignes) de manière asynchrone.
 * @param {string} sql - La requête SQL à exécuter.
 * @param {Array} [params=[]] - Les paramètres pour la requête préparée.
 * @returns {Promise<Array>} Une promesse qui résout avec un tableau des lignes de résultat.
 */
db.queryAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    this.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Erreur de requête (queryAsync):', sql, params, err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

/**
 * Exécute une requête d'écriture (INSERT, UPDATE, DELETE) de manière asynchrone.
 * @param {string} sql - La requête SQL à exécuter.
 * @param {Array} [params=[]] - Les paramètres pour la requête préparée.
 * @returns {Promise<object>} Une promesse qui résout avec { lastID, changes }.
 */
db.runAsync = function (sql, params = []) {
  return new Promise((resolve, reject) => {
    this.run(sql, params, function (err) {
      if (err) {
        console.error('Erreur de requête (runAsync):', sql, params, err);
        reject(err);
      } else {
        // 'this' est fourni par la fonction de callback de sqlite3
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

// Exporte l'instance de la base de données pour l'utiliser dans d'autres fichiers.
module.exports = db;
