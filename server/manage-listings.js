
const db = require("./database");

const action = process.argv[2];
const carId = Number(process.argv[3]);

if (action === "list") {
  const cars = db.prepare(`
    SELECT id, name, year, price, condition, location, created_at
    FROM cars
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `).all();

  if (cars.length === 0) {
    console.log("No pending listings.");
  } else {
    console.log("Pending Listings:");

    cars.forEach((car) => {
      console.log("----------------------");
      console.log("ID:", car.id);
      console.log("Car:", car.name);
      console.log("Year:", car.year);
      console.log("Price:", car.price, "DA");
      console.log("Condition:", car.condition);
      console.log("Location:", car.location);
    });
  }
} else if (
  (action === "approve" || action === "reject") &&
  Number.isInteger(carId) &&
  carId > 0
) {
  const newStatus = action === "approve" ? "approved" : "rejected";

  const result = db.prepare(`
    UPDATE cars
    SET status = ?
    WHERE id = ? AND status = 'pending'
  `).run(newStatus, carId);

  if (result.changes > 0) {
    console.log(`Car ${carId} has been ${newStatus}.`);
  } else {
    console.log("Car not found or already reviewed.");
  }
} else {
  console.log("Available commands:");
  console.log("node manage-listings.js list");
  console.log("node manage-listings.js approve 1");
  console.log("node manage-listings.js reject 1");
}

db.close();
