
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import AuthGuard from "../components/AuthGuard";
import LogoutButton from "../components/LogoutButton";

const API_URL = "http://127.0.0.1:5000";

function BookingsPage() {
  const searchParams = useSearchParams();

  const newBookingId = searchParams.get("newBooking");
  const bookingSuccess = searchParams.get("success") === "1";

  const newBookingRef = useRef(null);

  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driversByDate, setDriversByDate] = useState({});
  const [requests, setRequests] = useState([]);

  // Translator requests
  const [translatorRequests, setTranslatorRequests] = useState([]);
  const [translatorError, setTranslatorError] = useState("");
  const [translatorLoaded, setTranslatorLoaded] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  const [selectedDrivers, setSelectedDrivers] = useState({});
  const [autoFallbackChoices, setAutoFallbackChoices] = useState({});

  const [message, setMessage] = useState("Loading...");
  const [loadingId, setLoadingId] = useState(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load bookings and driver availability
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

        const uniqueDates = [
          ...new Set(
            bookingData.map((booking) => booking.travelDate)
          )
        ];

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

  // Automatically refresh driver requests
  useEffect(() => {
    let active = true;

    async function refreshRequests() {
      try {
        const response = await fetch(
          `${API_URL}/api/driver-requests`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

        if (!response.ok) return;

        const data = await response.json();

        if (active) {
          setRequests(data);
        }
      } catch (error) {
        console.error("Request refresh error:", error);
      }
    }

    const interval = setInterval(refreshRequests, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Translator status and live countdown
  useEffect(() => {
    let active = true;

    async function refreshTranslatorRequests() {
      try {
        const response = await fetch(
          `${API_URL}/api/customer/translator-requests`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load translator requests"
          );
        }

        if (!Array.isArray(data.requests)) {
          throw new Error("Invalid translator requests response");
        }

        if (!active) return;

        const fetchedAt = Date.now();

        const updatedRequests = data.requests.map((request) => {
          const remaining = Number(request.remainingSeconds);

          return {
            ...request,
            expiresAtClient:
              request.status === "Pending" &&
              request.remainingSeconds != null &&
              Number.isFinite(remaining)
                ? fetchedAt + Math.max(0, remaining) * 1000
                : null
          };
        });

        setTranslatorRequests(updatedRequests);
        setTranslatorError("");
        setTranslatorLoaded(true);
        setNowMs(fetchedAt);

      } catch (error) {
        if (active) {
          setTranslatorError(error.message);
          setTranslatorLoaded(true);
        }
      }
    }

    refreshTranslatorRequests();

    // Check translator status every 10 seconds
    const refreshTimer = setInterval(
      refreshTranslatorRequests,
      10000
    );

    // Update countdown every second
    const clockTimer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      active = false;
      clearInterval(refreshTimer);
      clearInterval(clockTimer);
    };
  }, []);

  // Scroll to newly created booking
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
            driverId: Number(driverId),
            autoFallbackEnabled:
              autoFallbackChoices[bookingId] === true
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

  // Cancel booking
  async function cancelBooking(booking) {
    const confirmed = window.confirm(
      `Are you sure you want to cancel booking #${booking.id}?`
    );

    if (!confirmed) return;

    setLoadingId(booking.id);
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/bookings/${booking.id}/cancel`,
        {
          method: "PATCH",
          credentials: "include"
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        setLoginRequired(true);
        throw new Error("Please login first.");
      }

      if (!response.ok) {
        throw new Error(
          result.message || "Failed to cancel booking"
        );
      }

      setBookings((previous) =>
        previous.map((item) =>
          Number(item.id) === Number(booking.id)
            ? { ...item, status: "Cancelled" }
            : item
        )
      );

      setRequests((previous) =>
        previous.map((request) =>
          Number(request.bookingId) === Number(booking.id) &&
          ["Pending", "Accepted"].includes(request.status)
            ? { ...request, status: "Cancelled" }
            : request
        )
      );

      setMessage(
        result.message || "Booking cancelled successfully!"
      );

      try {
        const driverResponse = await fetch(
          `${API_URL}/api/drivers?travelDate=${encodeURIComponent(booking.travelDate)}`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

        if (!driverResponse.ok) {
          throw new Error("Availability refresh failed");
        }

        const updatedDrivers = await driverResponse.json();

        setDriversByDate((previous) => ({
          ...previous,
          [booking.travelDate]: updatedDrivers
        }));

      } catch (refreshError) {
        setMessage(
          "Booking cancelled successfully! Refresh the page to update driver availability."
        );
      }

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
        View your bookings, request drivers,
        find translators and cancel bookings.
      </p>

      {/* Booking Success Message */}
      {(newBookingId || bookingSuccess) &&
        bookings.some(
          (booking) =>
            String(booking.id) === String(newBookingId) &&
            booking.status === "Pending"
        ) && (
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
              Please choose an available driver below.
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

      {loginRequired && (
        <p>
          <Link href="/login?next=%2Fbookings">
            Go to Login
          </Link>
        </p>
      )}

      {bookings.length === 0 && !message && (
        <p>No bookings found.</p>
      )}

      {/* Translator API errors */}
      {translatorError && (
        <p role="alert" style={{ color: "#b91c1c" }}>
          Translator status could not be refreshed: {translatorError}
        </p>
      )}

      {/* Booking Cards */}
      <div className="tour-grid">
        {bookings.map((booking) => {

          // Find translator requests for this booking
          const bookingTranslatorRequests = translatorRequests
            .filter(
              (request) =>
                Number(request.bookingId) === Number(booking.id)
            )
            .sort(
              (a, b) => Number(b.id) - Number(a.id)
            );

          // Prefer accepted, then pending, then latest
          const translatorRequest =
            bookingTranslatorRequests.find(
              (request) => request.status === "Accepted"
            ) ||
            bookingTranslatorRequests.find(
              (request) => request.status === "Pending"
            ) ||
            bookingTranslatorRequests[0];

          // Countdown for pending translator request
          const translatorSecondsLeft =
            translatorRequest?.status === "Pending" &&
            translatorRequest.expiresAtClient != null
              ? Math.max(
                  0,
                  Math.ceil(
                    (translatorRequest.expiresAtClient - nowMs) / 1000
                  )
                )
              : null;

          const isNewBooking =
            String(booking.id) === String(newBookingId);

          const isCancelled =
            booking.status === "Cancelled";

          const canCancel =
            booking.status === "Pending" ||
            booking.status === "Confirmed";

          const currentRequest = requests.find(
            (request) =>
              Number(request.bookingId) === Number(booking.id) &&
              (
                request.status === "Accepted" ||
                request.status === "Pending"
              )
          );

          const latestRequest = requests.find(
            (request) =>
              Number(request.bookingId) === Number(booking.id)
          );

          const requestExpired =
            latestRequest?.status === "Expired";

          const previousFailedRequest = currentRequest
            ? requests
                .filter(
                  (request) =>
                    Number(request.bookingId) === Number(booking.id) &&
                    Number(request.id) < Number(currentRequest.id) &&
                    ["Rejected", "Expired"].includes(request.status)
                )
                .sort(
                  (a, b) => Number(b.id) - Number(a.id)
                )[0]
            : null;

          const hasAlternativeDriver =
            Boolean(previousFailedRequest);

          const assignedDriver =
            currentRequest?.status === "Accepted"
              ? drivers.find(
                  (driver) =>
                    Number(driver.id) ===
                    Number(currentRequest.driverId)
                )
              : null;

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
              {isNewBooking && !isCancelled && (
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
                        : isCancelled
                        ? "red"
                        : "orange"
                  }}
                >
                  {booking.status}
                </strong>
              </p>

              <hr />

              {/* Driver Information */}
              {isCancelled ? (
                <div>
                  <h3 style={{ color: "red" }}>
                    Booking Cancelled
                  </h3>

                  <p>
                    This booking has been cancelled.
                  </p>

                  <p>
                    Driver requests are no longer available
                    for this booking.
                  </p>
                </div>

              ) : currentRequest?.status === "Accepted" ? (
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

                  {hasAlternativeDriver && (
                    <div
                      style={{
                        backgroundColor: "#dcfce7",
                        border: "1px solid #86efac",
                        borderRadius: "8px",
                        padding: "15px",
                        marginTop: "15px"
                      }}
                    >
                      <h4 style={{ color: "#166534" }}>
                        Alternative Driver Accepted!
                      </h4>

                      <p>
                        Your previous driver was unavailable.
                      </p>

                      <p>
                        New Driver:{" "}
                        <strong>
                          {currentRequest.driverName}
                        </strong>
                      </p>

                      <p>
                        Your booking is now confirmed.
                      </p>
                    </div>
                  )}
                </div>

              ) : currentRequest?.status === "Pending" ? (
                <div>
                  <h3>Driver Request</h3>

                  {requestExpired && (
                    <div
                      style={{
                        backgroundColor: "#fff3cd",
                        padding: "15px",
                        borderRadius: "8px",
                        marginBottom: "15px",
                        border: "1px solid #ffe69c"
                      }}
                    >
                      <h4 style={{ color: "#856404" }}>
                        Driver Request Expired
                      </h4>

                      <p>
                        Your previous driver did not respond
                        within 10 minutes.
                      </p>

                      <p>
                        Please select another available driver.
                      </p>
                    </div>
                  )}

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

                  {hasAlternativeDriver && (
                    <div
                      style={{
                        backgroundColor: "#eff6ff",
                        border: "1px solid #93c5fd",
                        borderRadius: "8px",
                        padding: "15px",
                        marginTop: "15px"
                      }}
                    >
                      <h4 style={{ color: "#1d4ed8" }}>
                        Alternative Driver Request
                      </h4>

                      <p>
                        Previous Driver:{" "}
                        <strong>
                          {previousFailedRequest.driverName}
                        </strong>
                      </p>

                      <p>
                        Previous Status:{" "}
                        <strong>
                          {previousFailedRequest.status}
                        </strong>
                      </p>

                      <p>
                        New Driver:{" "}
                        <strong>
                          {currentRequest.driverName}
                        </strong>
                      </p>

                      <p>
                        Waiting for the new driver to accept.
                      </p>
                    </div>
                  )}
                </div>

              ) : booking.status === "Confirmed" ? (
                <p>This booking is confirmed.</p>

              ) : booking.status !== "Pending" ? (
                <p>
                  Driver requests are unavailable
                  for this booking.
                </p>

              ) : (
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

                  {/* Automatic Fallback Permission */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      marginTop: "18px",
                      marginBottom: "8px",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        autoFallbackChoices[booking.id] === true
                      }
                      disabled={loadingId !== null}
                      onChange={(event) =>
                        setAutoFallbackChoices((previous) => ({
                          ...previous,
                          [booking.id]: event.target.checked
                        }))
                      }
                      style={{ marginTop: "3px" }}
                    />

                    <span>
                      <strong>
                        Automatically find another driver
                      </strong>

                      <span
                        style={{
                          display: "block",
                          color: "#555",
                          fontSize: "13px",
                          marginTop: "4px",
                          lineHeight: "1.5"
                        }}
                      >
                        If this driver rejects or does not
                        respond within 10 minutes, I agree
                        to send a request to another available
                        driver. The next driver must accept
                        before my booking is confirmed.
                      </span>
                    </span>
                  </label>

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
                      ? "Processing..."
                      : "Request Driver"}
                  </button>
                </div>
              )}

              {/* Translator Details */}
              <section
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  backgroundColor: "#f9fafb"
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  Translator Details (Optional)
                </h3>

                {!translatorLoaded ? (
                  <p>Loading translator status...</p>

                ) : translatorRequest ? (
                  <>
                    <p>
                      Translator:{" "}
                      <strong>
                        {translatorRequest.translatorName}
                      </strong>
                    </p>

                    <p>
                      Languages: {translatorRequest.languages}
                    </p>

                    <p>
                      Daily Fee: Rs.{" "}
                      {Number(
                        translatorRequest.feePerDay
                      ).toLocaleString("en-LK")}
                    </p>

                    <p>
                      Request Status:{" "}
                      <strong
                        style={{
                          color:
                            translatorRequest.status === "Accepted"
                              ? "#15803d"
                              : translatorRequest.status === "Pending"
                              ? "#b45309"
                              : "#b91c1c"
                        }}
                      >
                        {translatorRequest.status}
                      </strong>
                    </p>

                    {isCancelled ? (
                      <p style={{ color: "#b91c1c" }}>
                        This booking is cancelled.
                        Previous translator requests are shown
                        for reference only.
                      </p>

                    ) : translatorRequest.status === "Pending" ? (
                      <p style={{ color: "#92400e" }}>
                        {translatorSecondsLeft === null
                          ? "Waiting for translator response (10-minute limit)."
                          : translatorSecondsLeft > 0
                          ? `Time remaining: ${Math.floor(translatorSecondsLeft / 60)}m ${String(translatorSecondsLeft % 60).padStart(2, "0")}s`
                          : "Time limit reached. Waiting for server to update status..."}
                      </p>

                    ) : translatorRequest.status === "Accepted" ? (
                      <p style={{ color: "#15803d" }}>
                        Translator accepted your request.
                      </p>

                    ) : (
                      <p>
                        You may request another available
                        translator if your booking is active.
                      </p>
                    )}

                    {bookingTranslatorRequests.length > 1 && (
                      <details style={{ marginTop: "12px" }}>
                        <summary>
                          Previous translator requests
                        </summary>

                        <ul>
                          {bookingTranslatorRequests
                            .filter(
                              (request) =>
                                request.id !== translatorRequest.id
                            )
                            .map((request) => (
                              <li key={request.id}>
                                {request.translatorName}:{" "}
                                {request.status}
                              </li>
                            ))}
                        </ul>
                      </details>
                    )}
                  </>

                ) : (
                  <p>
                    No translator requested for this booking.
                  </p>
                )}
              </section>

              {/* Find Translator Button */}
              {canCancel && (
                <div style={{ marginTop: "20px" }}>
                  <Link
                    href={{
                      pathname: "/translators",
                      query: {
                        bookingId: booking.id,
                        travelDate: String(
                          booking.travelDate
                        ).slice(0, 10)
                      }
                    }}
                    style={{
                      display: "inline-block",
                      padding: "10px 18px",
                      backgroundColor: "#2563eb",
                      color: "white",
                      textDecoration: "none",
                      borderRadius: "6px",
                      fontWeight: "bold"
                    }}
                  >
                    Find a Translator (Optional)
                  </Link>

                  <p
                    style={{
                      fontSize: "13px",
                      color: "#555",
                      marginTop: "8px"
                    }}
                  >
                    Use Booking ID {booking.id} and travel
                    date{" "}
                    {String(booking.travelDate).slice(0, 10)}
                    {" "}on the translator page.
                  </p>
                </div>
              )}

              {/* Cancel Booking Button */}
              {canCancel && (
                <div style={{ marginTop: "20px" }}>
                  <button
                    onClick={() => cancelBooking(booking)}
                    disabled={loadingId !== null}
                    style={{
                      padding: "10px 18px",
                      backgroundColor: "#dc2626",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: loadingId !== null
                        ? "not-allowed"
                        : "pointer"
                    }}
                  >
                    {loadingId === booking.id
                      ? "Processing..."
                      : "Cancel Booking"}
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
