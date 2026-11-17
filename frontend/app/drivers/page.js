
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function DriversPage() {
  const [travelDate, setTravelDate] = useState("");
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showUnavailable, setShowUnavailable] = useState(false);

  useEffect(() => {
    if (!travelDate) {
      setDrivers([]);
      setError("");
      return;
    }

    let cancelled = false;

    async function loadDrivers() {
      setLoading(true);
      setError("");
      setDrivers([]);

      try {
        const response = await fetch(
          `http://127.0.0.1:5000/api/drivers?travelDate=${encodeURIComponent(travelDate)}`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load drivers");
        }

        const data = await response.json();

        if (!cancelled) {
          setDrivers(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDrivers();

    return () => {
      cancelled = true;
    };
  }, [travelDate]);

  const availableDrivers = drivers.filter(
    (driver) => driver.availableForDate === true
  );

  const displayedDrivers = showUnavailable
    ? drivers
    : availableDrivers;

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <Link href="/" className="back-btn">
        ← Back to Home
      </Link>

      <h1>Our Drivers</h1>

      <p>Select a travel date to check driver availability.</p>

      <div style={{ marginBottom: "25px" }}>
        <label htmlFor="travelDate">
          <strong>Travel Date: </strong>
        </label>

        <input
          id="travelDate"
          type="date"
          value={travelDate}
          onChange={(e) => setTravelDate(e.target.value)}
          style={{
            padding: "10px",
            marginLeft: "10px",
            borderRadius: "5px",
            border: "1px solid #ccc",
          }}
        />
      </div>

      {!travelDate && (
        <p>Please select a travel date to view available drivers.</p>
      )}

      {loading && <p>Loading drivers...</p>}

      {error && (
        <p style={{ color: "red" }}>{error}</p>
      )}

      {travelDate && !loading && !error && (
        <>
          <h3>
            Available Drivers: {availableDrivers.length}
          </h3>

          <label style={{ display: "block", marginBottom: "20px" }}>
            <input
              type="checkbox"
              checked={showUnavailable}
              onChange={(e) =>
                setShowUnavailable(e.target.checked)
              }
            />{" "}
            Show unavailable drivers too
          </label>

          {displayedDrivers.length === 0 ? (
            <p>No drivers found for the selected date.</p>
          ) : (
            <div className="tour-grid">
              {displayedDrivers.map((driver) => (
                <div key={driver.id} className="tour-card">
                  <h3>{driver.name}</h3>

                  <p>Vehicle: {driver.vehicle}</p>

                  <p>Location: {driver.location}</p>

                  <p>
                    Status:{" "}
                    <strong
                      style={{
                        color: driver.availableForDate
                          ? "green"
                          : "red",
                      }}
                    >
                      {driver.availableForDate
                        ? "Available"
                        : "Unavailable"}
                    </strong>
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
