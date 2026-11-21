
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RatingDisplay from "../components/RatingDisplay";

const API = "http://127.0.0.1:5000";

export default function DriversPage() {
  const [travelDate, setTravelDate] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [loading, setLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUnavailable, setShowUnavailable] = useState(false);

  const [autoFallback, setAutoFallback] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [message, setMessage] = useState("");
  const [requestSuccess, setRequestSuccess] = useState(false);

  // Get Booking ID and Travel Date from URL
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const id = params.get("bookingId");
    const date = params.get("travelDate");

    if (id && /^\d+$/.test(id)) {
      setBookingId(id);
    }

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setTravelDate(date);
    }
  }, []);

  // Load customer's bookings for validation
  useEffect(() => {
    let active = true;

    async function loadBookings() {
      try {
        const response = await fetch(
          `${API}/api/bookings`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to verify your bookings. Please login as a customer."
          );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid booking data");
        }

        if (active) {
          setBookings(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setBookingsLoading(false);
        }
      }
    }

    loadBookings();

    return () => {
      active = false;
    };
  }, []);

  // Load Drivers based on Travel Date
  useEffect(() => {
    if (!travelDate) {
      setDrivers([]);
      return;
    }

    const controller = new AbortController();

    async function loadDrivers() {
      setLoading(true);
      setError("");
      setDrivers([]);

      try {
        const response = await fetch(
          `${API}/api/drivers?travelDate=${encodeURIComponent(
            travelDate
          )}`,
          {
            cache: "no-store",
            credentials: "include",
            signal: controller.signal
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load drivers"
          );
        }

        if (!Array.isArray(data)) {
          throw new Error("Invalid driver data");
        }

        if (!controller.signal.aborted) {
          setDrivers(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDrivers();

    return () => controller.abort();
  }, [travelDate]);

  // Validate selected booking
  function validateBooking() {
    const id = Number(bookingId);

    if (!Number.isSafeInteger(id) || id < 1) {
      return "Please enter a valid Booking ID.";
    }

    if (!travelDate) {
      return "Please select your travel date.";
    }

    if (bookingsLoading) {
      return "Please wait while your bookings are loading.";
    }

    const booking = bookings.find(
      (item) => Number(item.id) === id
    );

    if (!booking) {
      return "Booking not found in your account.";
    }

    if (booking.status !== "Pending") {
      return "Driver requests are only allowed for pending bookings.";
    }

    const bookingDate = String(
      booking.travelDate
    ).slice(0, 10);

    if (bookingDate !== travelDate) {
      return `Travel Date does not match your booking. Correct date: ${bookingDate}`;
    }

    return null;
  }

  // Send Driver Request
  async function requestDriver(driverId) {
    if (sendingId !== null || requestSuccess) {
      return;
    }

    setMessage("");

    const validationError = validateBooking();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    const driver = drivers.find(
      (item) => Number(item.id) === Number(driverId)
    );

    if (!driver || !driver.availableForDate) {
      setMessage("This driver is unavailable.");
      return;
    }

    setSendingId(driverId);

    try {
      const response = await fetch(
        `${API}/api/driver-requests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            bookingId: Number(bookingId),
            driverId: Number(driverId),
            autoFallbackEnabled: autoFallback
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to request driver"
        );
      }

      setRequestSuccess(true);

      setMessage(
        "Driver request sent successfully! Waiting for driver confirmation."
      );
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSendingId(null);
    }
  }

  const availableDrivers = drivers.filter(
    (driver) => Boolean(driver.availableForDate)
  );

  const displayedDrivers = showUnavailable
    ? drivers
    : availableDrivers;

  const selectedBooking = bookings.find(
    (booking) =>
      Number(booking.id) === Number(bookingId) &&
      Number(bookingId) > 0
  );

  return (
    <main
      style={{
        padding: "40px",
        fontFamily: "Arial"
      }}
    >
      {/* Navigation Buttons */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "30px"
        }}
      >
        <Link href="/" className="back-btn">
          ← Back to Home
        </Link>

        <Link
          href="/bookings"
          className="back-btn"
          style={{
            backgroundColor: "#2563eb"
          }}
        >
          ← Back to Booking Dashboard
        </Link>
      </div>

      <h1>Our Drivers</h1>

      <p>
        Select a travel date to check driver availability.
      </p>

      {/* Driver Request Details */}
      <div
        style={{
          backgroundColor: "#f3f4f6",
          padding: "22px",
          borderRadius: "12px",
          marginBottom: "25px"
        }}
      >
        <h3>Request a Driver</h3>

        <p>
          Enter your active Tour Booking ID to request a driver.
        </p>

        {/* Booking ID */}
        <div>
          <label htmlFor="bookingId">
            <strong>Booking ID: </strong>
          </label>

          <input
            id="bookingId"
            type="number"
            min="1"
            value={bookingId}
            disabled={
              requestSuccess || sendingId !== null
            }
            onChange={(e) => {
              setBookingId(e.target.value);
              setMessage("");
              setRequestSuccess(false);
            }}
            placeholder="Example: 4013"
            style={{
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "6px",
              width: "300px",
              maxWidth: "100%",
              marginTop: "10px"
            }}
          />
        </div>

        {/* Booking Information */}
        {selectedBooking && (
          <div
            style={{
              backgroundColor: "#e0f2fe",
              padding: "12px",
              borderRadius: "8px",
              marginTop: "15px"
            }}
          >
            <p>
              <strong>Tour:</strong>{" "}
              {selectedBooking.tourName}
            </p>

            <p>
              <strong>Booking Date:</strong>{" "}
              {String(
                selectedBooking.travelDate
              ).slice(0, 10)}
            </p>

            <p>
              <strong>Booking Status:</strong>{" "}
              {selectedBooking.status}
            </p>
          </div>
        )}

        {/* Automatic Fallback */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            marginTop: "20px",
            cursor: "pointer"
          }}
        >
          <input
            type="checkbox"
            checked={autoFallback}
            disabled={
              requestSuccess || sendingId !== null
            }
            onChange={(e) =>
              setAutoFallback(e.target.checked)
            }
          />

          <span>
            <strong>
              Automatically find another driver
            </strong>

            <small
              style={{
                display: "block",
                marginTop: "5px",
                lineHeight: "1.6"
              }}
            >
              If my selected driver rejects or does not
              respond within 10 minutes, I agree to send
              a request to another available driver.
              The new driver must accept first.
            </small>
          </span>
        </label>

        <p
          style={{
            fontSize: "13px",
            marginTop: "15px"
          }}
        >
          You can find your Booking ID in the{" "}
          <Link href="/bookings">
            Booking Dashboard
          </Link>.
        </p>

        {/* Request Message */}
        {message && (
          <div
            role="status"
            style={{
              padding: "12px",
              marginTop: "15px",
              borderRadius: "8px",
              backgroundColor: requestSuccess
                ? "#dcfce7"
                : "#fee2e2",
              color: requestSuccess
                ? "#166534"
                : "#991b1b"
            }}
          >
            <strong>{message}</strong>

            {requestSuccess && (
              <p>
                <Link href="/bookings">
                  View Booking Status →
                </Link>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Travel Date */}
      <div style={{ marginBottom: "25px" }}>
        <label htmlFor="travelDate">
          <strong>Travel Date: </strong>
        </label>

        <input
          id="travelDate"
          type="date"
          value={travelDate}
          disabled={
            requestSuccess || sendingId !== null
          }
          onChange={(e) => {
            setTravelDate(e.target.value);
            setMessage("");
          }}
          style={{
            padding: "10px",
            marginLeft: "10px",
            borderRadius: "5px",
            border: "1px solid #ccc"
          }}
        />
      </div>

      {!travelDate && (
        <p>
          Please select a travel date to view available drivers.
        </p>
      )}

      {loading && <p>Loading drivers...</p>}

      {bookingsLoading && (
        <p>Checking your bookings...</p>
      )}

      {error && (
        <p style={{ color: "red" }}>
          {error}
        </p>
      )}

      {/* Driver List */}
      {travelDate && !loading && !error && (
        <>
          <h3>
            Available Drivers: {availableDrivers.length}
          </h3>

          <label
            style={{
              display: "block",
              marginBottom: "20px"
            }}
          >
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
            <p>
              No drivers found for the selected date.
            </p>
          ) : (
            <div className="tour-grid">
              {displayedDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className="tour-card"
                >
                  <h3>{driver.name}</h3>

                  <p>
                    <strong>Vehicle:</strong>{" "}
                    {driver.vehicle}
                  </p>

                  <p>
                    <strong>Location:</strong>{" "}
                    {driver.location}
                  </p>

                  <p>
                    <strong>Status:</strong>{" "}
                    <strong
                      style={{
                        color: driver.availableForDate
                          ? "green"
                          : "red"
                      }}
                    >
                      {driver.availableForDate
                        ? "Available"
                        : "Unavailable"}
                    </strong>
                  </p>

                  <RatingDisplay type="driver" personId={driver.id} />

                  {/* Request Driver Button */}
                  <button
                    type="button"
                    className="details-btn"
                    disabled={
                      !driver.availableForDate ||
                      sendingId !== null ||
                      requestSuccess ||
                      bookingsLoading
                    }
                    onClick={() =>
                      requestDriver(driver.id)
                    }
                    style={{
                      marginTop: "12px",
                      opacity:
                        !driver.availableForDate ||
                        requestSuccess ||
                        bookingsLoading
                          ? 0.5
                          : 1
                    }}
                  >
                    {sendingId === driver.id
                      ? "Sending Request..."
                      : !driver.availableForDate
                      ? "Unavailable"
                      : requestSuccess
                      ? "Request Sent"
                      : "Request Driver"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
 