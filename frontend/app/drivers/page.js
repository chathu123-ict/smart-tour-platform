
import Link from "next/link";


export default async function DriversPage() {

  const response = await fetch(
    "http://127.0.0.1:5000/api/drivers",
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Failed to load drivers");
  }

  const drivers = await response.json();

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>

      <Link href="/" className="back-btn">
  ← Back to Home
</Link>


      <h1>Our Drivers</h1>

      <p>Select a driver for your journey.</p>

      <div className="tour-grid">

        {drivers.map((driver) => (

          <div key={driver.id} className="tour-card">

            <h3>{driver.name}</h3>

            <p>Vehicle: {driver.vehicle}</p>

            <p>Location: {driver.location}</p>

            <p>
              Status: {driver.available
                ? "Available"
                : "Unavailable"}
            </p>

          </div>

        ))}

      </div>

    </main>
  );
}
