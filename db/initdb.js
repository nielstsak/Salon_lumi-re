const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.db');

db.serialize(() => {
  // Table des rendez-vous
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      phone TEXT
    )
  `);

  // Table des blocages et vacances
  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      reason TEXT,
      type TEXT CHECK(type IN ('BLOCK','VACATION')) NOT NULL DEFAULT 'BLOCK'
    )
  `);

  // Table des horaires d'ouverture
  db.run(`
    CREATE TABLE IF NOT EXISTS working_hours (
      day_of_week INTEGER PRIMARY KEY CHECK(day_of_week BETWEEN 1 AND 7),
      start TEXT,
      end TEXT
    )
  `);

  // NOUVEAU : Table pour les services/prestations
  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      duration INTEGER NOT NULL,
      price REAL NOT NULL
    )
  `);

  // NOUVEAU : Insertion des services par défaut
  const services = [
    { id: 1, title: "Tondeuse", duration: 30, price: 22.00 },
    { id: 2, title: "Ciseaux", duration: 30, price: 30.00 },
    { id: 3, title: "Dessin de la barbe - Tondeuse", duration: 30, price: 15.00 },
    { id: 4, title: "Dessin de la barbe - Ciseaux", duration: 30, price: 30.00 },
    { id: 5, title: "Dessin de la barbe - Rasoir", duration: 30, price: 37.00 },
    { id: 6, title: "Rasage complet (Serviette chaude...)", duration: 30, price: 35.00 }
  ];

  const stmt = db.prepare("INSERT OR IGNORE INTO services (id, title, duration, price) VALUES (?, ?, ?, ?)");
  services.forEach(service => {
    stmt.run(service.id, service.title, service.duration, service.price);
  });
  stmt.finalize();

});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Base de données initialisée et fermée.');
});
