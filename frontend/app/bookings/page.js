
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import AuthGuard from "../components/AuthGuard";
import LogoutButton from "../components/LogoutButton";
import ReviewForm from "../components/ReviewForm";

const API_URL = "http://127.0.0.1:5000";

function prepareRequests(data) {
  const fetchedAt = Date.now();

  return data.map((request) => {
    const seconds = Number(request.remainingSeconds);

    return {
      ...request,
      expiresAtClient:
        request.status === "Pending" &&
        request.remainingSeconds != null &&
        Number.isFinite(seconds)
          ? fetchedAt + Math.max(0, seconds) * 1000
          : null
    };
  });
}

function formatCountdown(request, nowMs) {
  if (!request || request.status !== "Pending") {
    return null;
  }

  if (request.expiresAtClient == null) {
    return "Waiting for response (10-minute limit).";
  }

  const seconds = Math.max(
    0,
    Math.ceil((request.expiresAtClient - nowMs) / 1000)
  );

  if (seconds === 0) {
    return "Time limit reached. Waiting for server update...";
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = String(seconds % 60).padStart(2, "0");

  return `Time remaining: ${minutes}m ${remaining}s`;
}

function statusColor(status) {
  if (status === "Accepted" || status === "Confirmed") {
    return "#15803d";
  }

  if (status === "Pending") {
    return "#b45309";
  }

  return "#b91c1c";
}

const infoBoxStyle = {
  marginTop: "20px",
  padding: "16px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  backgroundColor: "#f9fafb"
};

const linkButtonStyle = {
  display: "inline-block",
  padding: "10px 18px",
  backgroundColor: "#166534",
  color: "white",
  textDecoration: "none",
  borderRadius: "6px",
  fontWeight: "bold"
};

function BookingsPage() {
  const searchParams = useSearchParams();

  const newBookingId = searchParams.get("newBooking");
  const bookingSuccess = searchParams.get("success") === "1";

  const newBookingRef = useRef(null);

  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driverRequests, setDriverRequests] = useState([]);
  const [translatorRequests, setTranslatorRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [translatorError, setTranslatorError] = useState("");

  const [loginRequired, setLoginRequired] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  const [reviewEligibility, setReviewEligibility] = useState([]);

  // Load bookings, drivers and requests
  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [
          bookingRes,
          driverRes,
          driverRequestRes
        ] = await Promise.all([
          fetch(`${API_URL}/api/bookings`, {
            credentials: "include",
            cache: "no-store"
          }),

          fetch(`${API_URL}/api/drivers`, {
            credentials: "include",
            cache: "no-store"
          }),

          fetch(`${API_URL}/api/driver-requests`, {
            credentials: "include",
            cache: "no-store"
          })
        ]);

        if (
          bookingRes.status === 401 ||
          driverRequestRes.status === 401
        ) {
          if (active) {
            setLoginRequired(true);
          }

          throw new Error("Please login to view your bookings.");
        }

        if (
          !bookingRes.ok ||
          !driverRes.ok ||
          !driverRequestRes.ok
        ) {
          throw new Error("Failed to load booking information.");
        }

        const bookingData = await bookingRes.json();
        const driverData = await driverRes.json();
        const requestData = await driverRequestRes.json();

        if (
          !Array.isArray(bookingData) ||
          !Array.isArray(driverData) ||
          !Array.isArray(requestData)
        ) {
          throw new Error("Invalid booking information.");
        }

        if (!active) return;

        const bookingIds = new Set(
          bookingData.map((booking) => Number(booking.id))
        );

        setBookings(bookingData);
        setDrivers(driverData);

        setDriverRequests(
          prepareRequests(
            requestData.filter((request) =>
              bookingIds.has(Number(request.bookingId))
            )
          )
        );
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  // Refresh driver requests every 10 seconds
  useEffect(() => {
    
    let active = true;

    async function refreshDriverRequests() {
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

        if (!Array.isArray(data)) return;

        if (active) {
          setDriverRequests(prepareRequests(data));
        }
      } catch (err) {
        console.error("Driver refresh error:", err);
      }
    }

    const interval = setInterval(
      refreshDriverRequests,
      10000
    );

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Refresh translator requests every 10 seconds
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
          throw new Error("Invalid translator request data");
        }

        if (!active) return;

        setTranslatorRequests(
          prepareRequests(data.requests)
        );

        setTranslatorError("");
      } catch (err) {
        if (active) {
          setTranslatorError(err.message);
        }
      }
    }

    refreshTranslatorRequests();

    const interval = setInterval(
      refreshTranslatorRequests,
      10000
    );

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Update both countdowns every second
  useEffect(() => {
    setNowMs(Date.now());

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Highlight newly created booking
  useEffect(() => {
    if (!newBookingId || loading) return;

    const timer = setTimeout(() => {
      newBookingRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [newBookingId, loading]);



  async function loadReviewEligibility() {
    try {
      const response = await fetch(
        `${API_URL}/api/my-review-eligibility`,
        {
          credentials: "include",
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load review eligibility");
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setReviewEligibility(data);
      }
    } catch (err) {
      console.error("Review eligibility error:", err);
    }
  }

  useEffect(() => {
    loadReviewEligibility();

    // Refresh eligibility every 30 seconds.
    // This also detects when the travel date has ended.
    const interval = setInterval(loadReviewEligibility, 30000);

    return () => clearInterval(interval);
  }, []);






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

      setDriverRequests((previous) =>
        previous.map((request) =>
          Number(request.bookingId) === Number(booking.id) &&
          ["Pending", "Accepted"].includes(request.status)
            ? { ...request, status: "Cancelled" }
            : request
        )
      );

      setTranslatorRequests((previous) =>
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
    } catch (err) {
      setMessage("Error: " + err.message);
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
        View your bookings, choose drivers,
        find translators and cancel bookings.
      </p>

      {/* New Booking Success */}
      {(newBookingId || bookingSuccess) &&
        bookings.some(
          (booking) =>
            String(booking.id) === String(newBookingId) &&
            booking.status === "Pending"
        ) && (
          <div
            style={{
              padding: "18px",
              backgroundColor: "#dcfce7",
              color: "#166534",
              borderRadius: "10px",
              marginBottom: "20px"
            }}
          >
            <h3>Booking Submitted Successfully!</h3>

            <p>
              Your booking has been saved.
              Please choose an available driver below.
            </p>
          </div>
        )}

      {loading && <p>Loading bookings...</p>}

      {error && (
        <p style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          style={{
            padding: "12px",
            color: message.startsWith("Error")
              ? "#b91c1c"
              : "#166534"
          }}
        >
          {message}
        </p>
      )}

      {translatorError && (
        <p style={{ color: "#b91c1c" }}>
          Translator status could not be refreshed:{" "}
          {translatorError}
        </p>
      )}

      {loginRequired && (
        <Link href="/login?next=%2Fbookings">
          Go to Login
        </Link>
      )}

      {!loading && !error && bookings.length === 0 && (
        <p>No bookings found.</p>
      )}

      {/* Booking Cards */}
      <div className="tour-grid">
        {bookings.map((booking) => {
          const isNewBooking =
            String(booking.id) === String(newBookingId);

          const isCancelled =
            booking.status === "Cancelled";

          const canCancel =
            booking.status === "Pending" ||
            booking.status === "Confirmed";

          const travelDate =
            String(booking.travelDate).slice(0, 10);

          // Driver requests for this booking
          const bookingDriverRequests = driverRequests
            .filter(
              (request) =>
                Number(request.bookingId) ===
                Number(booking.id)
            )
            .sort((a, b) => Number(b.id) - Number(a.id));

          // Prefer accepted, then pending, then latest
          const driverRequest =
            bookingDriverRequests.find(
              (request) => request.status === "Accepted"
            ) ||
            bookingDriverRequests.find(
              (request) => request.status === "Pending"
            ) ||
            bookingDriverRequests[0];

          const selectedDriver = driverRequest
            ? drivers.find(
                (driver) =>
                  Number(driver.id) ===
                  Number(driverRequest.driverId)
              )
            : null;

          const driverCountdown =
            formatCountdown(driverRequest, nowMs);

          // Identify fallback driver
          const previousFailedDriver = driverRequest
            ? bookingDriverRequests
                .filter(
                  (request) =>
                    Number(request.id) <
                      Number(driverRequest.id) &&
                    ["Rejected", "Expired"].includes(
                      request.status
                    )
                )
                .sort(
                  (a, b) => Number(b.id) - Number(a.id)
                )[0]
            : null;

          // Translator requests for this booking
          const bookingTranslatorRequests =
            translatorRequests
              .filter(
                (request) =>
                  Number(request.bookingId) ===
                  Number(booking.id)
              )
              .sort(
                (a, b) => Number(b.id) - Number(a.id)
              );

          const translatorRequest =
            bookingTranslatorRequests.find(
              (request) => request.status === "Accepted"
            ) ||
            bookingTranslatorRequests.find(
              (request) => request.status === "Pending"
            ) ||
            bookingTranslatorRequests[0];

          const translatorCountdown =
            formatCountdown(translatorRequest, nowMs);

          const eligibility = reviewEligibility.find(
  (item) => Number(item.bookingId) === Number(booking.id)
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

              <p>
                <strong>Booking ID:</strong> {booking.id}
              </p>

              <p>
                <strong>Customer:</strong> {booking.name}
              </p>

              <p>
                <strong>Email:</strong> {booking.email}
              </p>

              <p>
                <strong>Travel Date:</strong> {travelDate}
              </p>

              <p>
                <strong>People:</strong> {booking.people}
              </p>

              <p>
                <strong>Booking Status:</strong>{" "}
                <strong
                  style={{
                    color: statusColor(booking.status)
                  }}
                >
                  {booking.status}
                </strong>
              </p>

              <hr />

              {/* DRIVER DETAILS BOX */}
              <section style={infoBoxStyle}>
                <h3
                  style={{
                    marginTop: 0,
                    color: "#166534"
                  }}
                >
                  Driver Details
                </h3>

                {driverRequest ? (
                  <>
                    <p>
                      Driver:{" "}
                      <strong>
                        {driverRequest.driverName ||
                          selectedDriver?.name ||
                          "Unknown"}
                      </strong>
                    </p>

                    <p>
                      Vehicle:{" "}
                      {selectedDriver?.vehicle ||
                        "Not available"}
                    </p>

                    <p>
                      Location:{" "}
                      {selectedDriver?.location ||
                        "Not available"}
                    </p>

                    <p>
                      Request Status:{" "}
                      <strong
                        style={{
                          color: statusColor(
                            driverRequest.status
                          )
                        }}
                      >
                        {driverRequest.status}
                      </strong>
                    </p>

                    {/* Driver Countdown */}
                    {driverRequest.status === "Pending" && (
                      <div
                        style={{
                          padding: "12px",
                          backgroundColor: "#fff7ed",
                          border: "1px solid #fed7aa",
                          borderRadius: "8px",
                          marginTop: "12px"
                        }}
                      >
                        <p
                          style={{
                            fontWeight: "bold",
                            color: "#b45309",
                            margin: 0
                          }}
                        >
                          {driverCountdown}
                        </p>

                        <p style={{ marginBottom: 0 }}>
                          Waiting for driver confirmation...
                        </p>
                      </div>
                    )}

                    {driverRequest.status === "Accepted" && (
                      <p style={{ color: "#15803d" }}>
                        Driver accepted your request.
                        Your booking is confirmed.
                      </p>
                    )}

                    {driverRequest.status === "Rejected" && (
                      <p style={{ color: "#b91c1c" }}>
                        This driver rejected your request.
                      </p>
                    )}

                    {driverRequest.status === "Expired" && (
                      <p style={{ color: "#b91c1c" }}>
                        Driver did not respond within
                        10 minutes.
                      </p>
                    )}

                    {/* Fallback Driver */}
                    {previousFailedDriver &&
                      ["Pending", "Accepted"].includes(
                        driverRequest.status
                      ) && (
                        <div
                          style={{
                            padding: "14px",
                            marginTop: "12px",
                            borderRadius: "8px",
                            border: "1px solid #86efac",
                            backgroundColor: "#dcfce7"
                          }}
                        >
                          <h4
                            style={{
                              marginTop: 0,
                              color: "#166534"
                            }}
                          >
                            {driverRequest.status === "Accepted"
                              ? "Alternative Driver Accepted!"
                              : "Alternative Driver Request"}
                          </h4>

                          <p>
                            Previous Driver:{" "}
                            <strong>
                              {previousFailedDriver.driverName}
                            </strong>
                          </p>

                          <p>
                            Previous Status:{" "}
                            {previousFailedDriver.status}
                          </p>

                          <p>
                            New Driver:{" "}
                            <strong>
                              {driverRequest.driverName}
                            </strong>
                          </p>

                          <p>
                            {driverRequest.status === "Accepted"
                              ? "Your new driver has accepted."
                              : "Waiting for the new driver to accept."}
                          </p>
                        </div>
                      )}

                    {bookingDriverRequests.length > 1 && (
                      <details style={{ marginTop: "12px" }}>
                        <summary>
                          Previous driver requests
                        </summary>

                        <ul>
                          {bookingDriverRequests
                            .filter(
                              (request) =>
                                request.id !== driverRequest.id
                            )
                            .map((request) => (
                              <li key={request.id}>
                                {request.driverName}:{" "}
                                {request.status}
                              </li>
                            ))}
                        </ul>
                      </details>
                    )}

                    {isCancelled && (
                      <p style={{ color: "#b91c1c" }}>
                        Booking cancelled. Previous driver
                        details are shown for reference.
                      </p>
                    )}
                  </>
                ) : (
                  <p>
                    No driver requested for this booking.
                  </p>
                )}
              </section>

              {/* FIND DRIVER BUTTON */}
              {!isCancelled &&
                booking.status === "Pending" &&
                !["Accepted", "Pending"].includes(
                  driverRequest?.status
                ) && (
                  <div style={{ marginTop: "15px" }}>
                    <Link
                      href={{
                        pathname: "/drivers",
                        query: {
                          bookingId: booking.id,
                          travelDate
                        }
                      }}
                      style={linkButtonStyle}
                    >
                      Find a Driver
                    </Link>

                    <p
                      style={{
                        fontSize: "13px",
                        color: "#555",
                        marginTop: "8px"
                      }}
                    >
                      View available drivers and send
                      your request.
                    </p>
                  </div>
                )}

              {/* TRANSLATOR DETAILS BOX */}
              <section style={infoBoxStyle}>
                <h3
                  style={{
                    marginTop: 0,
                    color: "#166534"
                  }}
                >
                  Translator Details (Optional)
                </h3>

                {translatorRequest ? (
                  <>
                    <p>
                      Translator:{" "}
                      <strong>
                        {translatorRequest.translatorName}
                      </strong>
                    </p>

                    <p>
                      Languages:{" "}
                      {translatorRequest.languages}
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
                          color: statusColor(
                            translatorRequest.status
                          )
                        }}
                      >
                        {translatorRequest.status}
                      </strong>
                    </p>

                    {/* Translator Countdown */}
                    {translatorRequest.status === "Pending" && (
                      <div
                        style={{
                          padding: "12px",
                          backgroundColor: "#fff7ed",
                          border: "1px solid #fed7aa",
                          borderRadius: "8px",
                          marginTop: "12px"
                        }}
                      >
                        <p
                          style={{
                            fontWeight: "bold",
                            color: "#b45309",
                            margin: 0
                          }}
                        >
                          {translatorCountdown}
                        </p>

                        <p style={{ marginBottom: 0 }}>
                          Waiting for translator confirmation...
                        </p>
                      </div>
                    )}

                    {translatorRequest.status === "Accepted" && (
                      <p style={{ color: "#15803d" }}>
                        Translator accepted your request.
                      </p>
                    )}

                    {translatorRequest.status === "Rejected" && (
                      <p style={{ color: "#b91c1c" }}>
                        Translator rejected your request.
                      </p>
                    )}

                    {translatorRequest.status === "Expired" && (
                      <p style={{ color: "#b91c1c" }}>
                        Translator did not respond within
                        10 minutes.
                      </p>
                    )}

                    {isCancelled && (
                      <p style={{ color: "#b91c1c" }}>
                        This booking is cancelled.
                        Previous translator requests are
                        shown for reference only.
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

              {/* FIND TRANSLATOR BUTTON */}
              {canCancel && (
                <div style={{ marginTop: "20px" }}>
                  <Link
                    href={{
                      pathname: "/translators",
                      query: {
                        bookingId: booking.id,
                        travelDate
                      }
                    }}
                    style={{
                      ...linkButtonStyle,
                      backgroundColor: "#2563eb"
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
                    Use Booking ID {booking.id} and
                    travel date {travelDate} on the
                    translator page.
                  </p>
                </div>
              )}



{/* RATINGS AND REVIEWS */}
<section style={infoBoxStyle}>
  <h3 style={{ color: "#166534" }}>
    Ratings & Reviews
  </h3>

  {eligibility?.driverReviewed && (
    <p style={{ color: "#15803d" }}>
      ✓ You have already reviewed your driver.
    </p>
  )}

  {eligibility?.canReviewDriver && (
    <ReviewForm
      bookingId={booking.id}
      reviewerType="Driver"
      onSubmitted={loadReviewEligibility}
    />
  )}

  {eligibility?.translatorReviewed && (
    <p style={{ color: "#15803d" }}>
      ✓ You have already reviewed your translator.
    </p>
  )}

  {eligibility?.canReviewTranslator && (
    <ReviewForm
      bookingId={booking.id}
      reviewerType="Translator"
      onSubmitted={loadReviewEligibility}
    />
  )}

  {!eligibility?.canReviewDriver &&
    !eligibility?.canReviewTranslator &&
    !eligibility?.driverReviewed &&
    !eligibility?.translatorReviewed && (
      <p style={{ color: "#6b7280" }}>
        {isCancelled
          ? "Cancelled bookings cannot be reviewed."
          : "Reviews will be available after your travel date, for accepted drivers and translators."}
      </p>
    )}
</section>







              {/* CANCEL BOOKING */}
              {canCancel && (
                <div style={{ marginTop: "20px" }}>
                  <button
                    type="button"
                    onClick={() => cancelBooking(booking)}
                    disabled={loadingId !== null}
                    style={{
                      padding: "10px 18px",
                      backgroundColor: "#dc2626",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor:
                        loadingId !== null
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

export default function ProtectedBookingsPage() {
  return (
    <AuthGuard role="customer">
      <BookingsPage />
    </AuthGuard>
  );
}
