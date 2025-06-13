const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.db');

db.serialize(() => {
  console.log("Initialisation et vérification de la base de données...");

  // Création des tables de base si elles n'existent pas
  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      duration INTEGER NOT NULL,
      price REAL NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      reason TEXT,
      type TEXT CHECK(type IN ('BLOCK','VACATION')) NOT NULL DEFAULT 'BLOCK'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS working_hours (
      day_of_week INTEGER PRIMARY KEY CHECK(day_of_week BETWEEN 1 AND 7), -- Lundi (1) à Dimanche (7)
      start TEXT,
      end TEXT
    )
  `);

  // S'assure que la table appointments existe, même dans son ancienne version
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      phone TEXT
    )
  `);

  // Tente d'ajouter la colonne service_id.
  // La requête échouera si la colonne existe déjà, mais ce n'est pas une erreur bloquante.
  db.run(`ALTER TABLE appointments ADD COLUMN service_id INTEGER REFERENCES services(id) ON DELETE SET NULL`, (err) => {
    if (err) {
        if (err.message.includes('duplicate column name')) {
            console.log("Info: La colonne 'service_id' existe déjà dans la table 'appointments'.");
        } else {
            console.error("Erreur lors de la modification de la table 'appointments':", err.message);
        }
    } else {
      console.log("Succès: La table 'appointments' a été mise à jour avec la colonne 'service_id'.");
    }
  });

  // Insertion des données par défaut
  const services = [
    { id: 1, title: "Tondeuse", duration: 30, price: 22.00 },
    { id: 2, title: "Ciseaux", duration: 30, price: 30.00 },
    { id: 3, title: "Dessin de la barbe - Tondeuse", duration: 30, price: 15.00 },
    { id: 4, title: "Dessin de la barbe - Ciseaux", duration: 30, price: 30.00 },
    { id: 5, title: "Dessin de la barbe - Rasoir", duration: 30, price: 37.00 },
    { id: 6, title: "Rasage complet (Serviette chaude...)", duration: 30, price: 35.00 }
  ];
  const stmtServices = db.prepare("INSERT OR IGNORE INTO services (id, title, duration, price) VALUES (?, ?, ?, ?)");
  services.forEach(service => stmtServices.run(service.id, service.title, service.duration, service.price));
  stmtServices.finalize();

  const hours = [
      { day_of_week: 1, start: '11:00', end: '19:00' }, { day_of_week: 2, start: '11:00', end: '19:00' },
      { day_of_week: 3, start: '11:00', end: '19:00' }, { day_of_week: 4, start: '11:00', end: '19:00' },
      { day_of_week: 5, start: '11:00', end: '19:00' }, { day_of_week: 6, start: null, end: null },
      { day_of_week: 7, start: null, end: null }
  ];
  const stmtHours = db.prepare("INSERT OR IGNORE INTO working_hours (day_of_week, start, end) VALUES (?, ?, ?)");
  hours.forEach(hour => stmtHours.run(hour.day_of_week, hour.start, hour.end));
  stmtHours.finalize();
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Base de données initialisée et fermée.');
});
