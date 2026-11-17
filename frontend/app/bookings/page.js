
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import AuthGuard from "../components/AuthGuard";
import LogoutButton from "../components/LogoutButton";

const API_URL = "http://127.0.0.1:5000";

// Customer Booking Dashboard
function BookingsPage() {
  const searchParams = useSearchParams();

  const newBookingId = searchParams.get("newBooking");
  const bookingSuccess = searchParams.get("success") === "1";

  const newBookingRef = useRef(null);

  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driversByDate, setDriversByDate] = useState({});
  const [requests, setRequests] = useState([]);

  const [selectedDrivers, setSelectedDrivers] = useState({});
  const [message, setMessage] = useState("Loading...");
  const [loadingId, setLoadingId] = useState(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load customer bookings and drivers by travel date
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const bookingRes = await fetch(
          `${API_URL}/api/bookings`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

        if (!active) return;

        if (bookingRes.status === 401) {
          setLoginRequired(true);
          setMessage("Please login to view your bookings.");
          return;
        }

        if (bookingRes.status === 403) {
          setMessage("Access denied. Customer account required.");
          return;
        }

        if (!bookingRes.ok) {
          throw new Error("Failed to load bookings");
        }

        const bookingData = await bookingRes.json();

        // Get unique travel dates
        const uniqueDates = [
          ...new Set(
            bookingData.map((booking) => booking.travelDate)
          )
        ];

        // Load all drivers, requests and date-specific drivers
        const [
          driverRes,
          requestRes,
          ...dateResponses
        ] = await Promise.all([
          fetch(`${API_URL}/api/drivers`, {
            credentials: "include",
            cache: "no-store"
          }),

          fetch(`${API_URL}/api/driver-requests`, {
            credentials: "include",
            cache: "no-store"
          }),

          ...uniqueDates.map((date) =>
            fetch(
              `${API_URL}/api/drivers?travelDate=${encodeURIComponent(date)}`,
              {
                credentials: "include",
                cache: "no-store"
              }
            )
          )
        ]);

        const allResponses = [
          driverRes,
          requestRes,
          ...dateResponses
        ];

        if (!allResponses.every((response) => response.ok)) {
          throw new Error("Failed to load driver information");
        }

        const driverData = await driverRes.json();
        const requestData = await requestRes.json();

        const dateDriverLists = await Promise.all(
          dateResponses.map((response) => response.json())
        );

        // Store available drivers separately for each date
        const dateMap = Object.fromEntries(
          uniqueDates.map((date, index) => [
            date,
            dateDriverLists[index]
          ])
        );

        if (!active) return;

        setBookings(bookingData);
        setDrivers(driverData);
        setDriversByDate(dateMap);

        // Filter requests belonging to this customer
        const bookingIds = new Set(
          bookingData.map((booking) => Number(booking.id))
        );

        const customerRequests = requestData.filter(
          (request) =>
            bookingIds.has(Number(request.bookingId))
        );

        setRequests(customerRequests);
        setMessage("");
        setDataLoaded(true);

      } catch (error) {
        if (active) {
          setMessage("Error: " + error.message);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  // Automatically scroll to newly created booking
  useEffect(() => {
    if (!newBookingId || !dataLoaded) return;

    const timer = setTimeout(() => {
      newBookingRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [newBookingId, dataLoaded]);

  // Send driver request
  async function requestDriver(bookingId) {
    const driverId = selectedDrivers[bookingId];

    if (!driverId) {
      setMessage("Please select a driver first.");
      return;
    }

    setLoadingId(bookingId);
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/driver-requests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            bookingId: Number(bookingId),
            driverId: Number(driverId)
          })
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        setLoginRequired(true);
        throw new Error("Please login first.");
      }

      if (!response.ok) {
        throw new Error(
          result.message || "Failed to request driver"
        );
      }

      setRequests((previous) => [
        result.request,
        ...previous
      ]);

      setMessage(
        result.message || "Driver request sent successfully!"
      );

    } catch (error) {
      setMessage("Error: " + error.message);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <main
      style={{
        padding: "40px",
        fontFamily: "Arial",
        minHeight: "100vh"
      }}
    >

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "15px",
          marginBottom: "25px"
        }}
      >

        <Link href="/" className="back-btn">
          ← Back to Home
        </Link>

        <LogoutButton />

      </div>

      <h1>My Booking Dashboard</h1>

      <p>
        View your bookings and request drivers.
      </p>

      {/* Booking Success Message */}
      {(newBookingId || bookingSuccess) && (
        <div
          style={{
            backgroundColor: "#dcfce7",
            color: "#166534",
            padding: "18px",
            borderRadius: "10px",
            marginBottom: "20px"
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            Booking Submitted Successfully!
          </h3>

          <p>
            Your booking has been saved.
            Please choose an available driver
            below to continue your booking.
          </p>
        </div>
      )}

      {/* General Messages */}
      {message && (
        <p
          style={{
            padding: "10px 0",
            color: message.startsWith("Error")
              ? "#dc2626"
              : "#374151"
          }}
        >
          {message}
        </p>
      )}

      {/* Login required */}
      {loginRequired && (
        <p>
          <Link href="/login?next=%2Fbookings">
            Go to Login
          </Link>
        </p>
      )}

      {/* No bookings */}
      {bookings.length === 0 && !message && (
        <p>No bookings found.</p>
      )}

      {/* Booking Cards */}
      <div className="tour-grid">

        {bookings.map((booking) => {

          const isNewBooking =
            String(booking.id) === String(newBookingId);

          const currentRequest = requests.find(
            (request) =>
              Number(request.bookingId) ===
                Number(booking.id) &&
              (
                request.status === "Accepted" ||
                request.status === "Pending"
              )
          );

          // Get assigned driver details
          const assignedDriver =
            currentRequest?.status === "Accepted"
              ? drivers.find(
                  (driver) =>
                    Number(driver.id) ===
                    Number(currentRequest.driverId)
                )
              : null;

          // Get drivers available on this booking date
          const availableDrivers = (
            driversByDate[booking.travelDate] || []
          ).filter(
            (driver) => driver.availableForDate
          );

          return (
            <div
              key={booking.id}
              ref={isNewBooking ? newBookingRef : null}
              className="tour-card"
              style={{
                border: isNewBooking
                  ? "3px solid #16a34a"
                  : undefined,
                borderRadius: "10px"
              }}
            >

              {/* New Booking Highlight */}
              {isNewBooking && (
                <p
                  style={{
                    color: "#166534",
                    fontWeight: "bold"
                  }}
                >
                  ✓ Your New Booking
                </p>
              )}

              <h2>{booking.tourName}</h2>

              <p>Booking ID: {booking.id}</p>
              <p>Customer: {booking.name}</p>
              <p>Email: {booking.email}</p>
              <p>Travel Date: {booking.travelDate}</p>
              <p>People: {booking.people}</p>

              {/* Booking Status */}
              <p>
                Booking Status:{" "}
                <strong
                  style={{
                    color:
                      booking.status === "Confirmed"
                        ? "green"
                        : "orange"
                  }}
                >
                  {booking.status}
                </strong>
              </p>

              <hr />

              {/* Accepted Driver */}
              {currentRequest?.status === "Accepted" ? (

                <div>
                  <h3>Assigned Driver</h3>

                  <p>
                    Driver Name:{" "}
                    <strong>
                      {currentRequest.driverName}
                    </strong>
                  </p>

                  {assignedDriver && (
                    <>
                      <p>
                        Vehicle: {assignedDriver.vehicle}
                      </p>

                      <p>
                        Location: {assignedDriver.location}
                      </p>
                    </>
                  )}

                  <p>
                    Request Status:{" "}
                    <strong style={{ color: "green" }}>
                      Accepted
                    </strong>
                  </p>
                </div>

              ) : currentRequest?.status === "Pending" ? (

                /* Pending Driver Request */
                <div>
                  <h3>Driver Request</h3>

                  <p>
                    Driver: {currentRequest.driverName}
                  </p>

                  <p>
                    Request Status:{" "}
                    <strong style={{ color: "orange" }}>
                      Pending
                    </strong>
                  </p>

                  <p>
                    Waiting for driver confirmation...
                  </p>
                </div>

              ) : booking.status === "Confirmed" ? (

                <p>This booking is confirmed.</p>

              ) : booking.status !== "Pending" ? (

                <p>Driver requests are unavailable for this booking.</p>

              ) : (

                /* Request New Driver */
                <div>
                  <h3>Request a Driver</h3>

                  <select
                    value={selectedDrivers[booking.id] || ""}
                    onChange={(event) =>
                      setSelectedDrivers((previous) => ({
                        ...previous,
                        [booking.id]: event.target.value
                      }))
                    }
                  >
                    <option value="">
                      Select Driver
                    </option>

                    {availableDrivers.map((driver) => (
                      <option
                        key={driver.id}
                        value={driver.id}
                      >
                        {driver.name} - {driver.vehicle}
                      </option>
                    ))}
                  </select>

                  {availableDrivers.length === 0 && (
                    <p style={{ color: "#dc2626" }}>
                      No drivers available for this date.
                    </p>
                  )}

                  <br />
                  <br />

                  <button
                    className="details-btn"
                    disabled={
                      loadingId !== null ||
                      availableDrivers.length === 0
                    }
                    onClick={() =>
                      requestDriver(booking.id)
                    }
                  >
                    {loadingId === booking.id
                      ? "Sending..."
                      : "Request Driver"}
                  </button>
                </div>

              )}

            </div>
          );
        })}

      </div>
    </main>
  );
}

// Protected Customer Dashboard
export default function ProtectedBookingsPage() {
  return (
    <AuthGuard role="customer">
      <BookingsPage />
    </AuthGuard>
  );
}
