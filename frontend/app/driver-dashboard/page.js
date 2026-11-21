
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import AuthGuard from "../components/AuthGuard";
import LogoutButton from "../components/LogoutButton";

const API_URL = "http://127.0.0.1:5000";

// Convert seconds to MM:SS
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remaining
  ).padStart(2, "0")}`;
}

// Calculate remaining time using backend data
function getRemainingTime(request, now) {
  if (request.status !== "Pending") {
    return 0;
  }

  const seconds = Number(request.remainingSeconds);

  if (
    request.remainingSeconds == null ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }

  const elapsed = Math.max(
    0,
    (now - request.receivedAt) / 1000
  );

  return Math.max(0, Math.ceil(seconds - elapsed));
}

function DriverDashboard() {
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("Loading...");
  const [loadingId, setLoadingId] = useState(null);
  const [requestErrors, setRequestErrors] = useState({});

  const [driverProfile, setDriverProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  // Current time for live countdown
  const [now, setNow] = useState(() => Date.now());

  // Load driver profile
  async function loadDriverProfile() {
    try {
      setProfileError("");

      const response = await fetch(
        `${API_URL}/api/driver-profile`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Failed to load driver profile"
        );
      }

      setDriverProfile(result);
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setProfileLoading(false);
    }
  }

  // Load driver requests
  async function loadRequests() {
    try {
      const response = await fetch(
        `${API_URL}/api/driver-requests`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        throw new Error("Please login first.");
      }

      if (response.status === 403) {
        throw new Error("Driver access required.");
      }

      if (!response.ok) {
        throw new Error("Failed to load requests");
      }

      const data = await response.json();

      // Save the time when API data was received
      const receivedAt = Date.now();

      setRequests(
        data.map((request) => ({
          ...request,
          receivedAt,
        }))
      );

      setNow(receivedAt);
      setMessage("");
    } catch (error) {
      setMessage("Error: " + error.message);
    }
  }

  // Initial data loading
  useEffect(() => {
    loadDriverProfile();
    loadRequests();
  }, []);

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Refresh request statuses every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadRequests();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Accept or Reject request
  async function updateStatus(requestId, status) {
    setLoadingId(requestId);
    setMessage("");

    setRequestErrors((previous) => ({
      ...previous,
      [requestId]: "",
    }));

    try {
      const response = await fetch(
        `${API_URL}/api/driver-requests/${requestId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ status }),
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        throw new Error("Please login first.");
      }

      if (response.status === 403) {
        throw new Error("Access denied.");
      }

      if (!response.ok) {
        throw new Error(
          result.message || "Failed to update request"
        );
      }

      // Update request while preserving trip details
      setRequests((previous) =>
        previous.map((request) =>
          Number(request.id) === Number(requestId)
            ? {
                ...request,
                ...result.request,
              }
            : request
        )
      );

      setMessage(result.message);

      if (status === "Accepted") {
        await loadDriverProfile();
      }
    } catch (error) {
      setRequestErrors((previous) => ({
        ...previous,
        [requestId]: error.message,
      }));

      // Refresh after failure (including expiry)
      await loadRequests();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <main
      style={{
        padding: "40px",
        fontFamily: "Arial",
        minHeight: "100vh",
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
          marginBottom: "25px",
        }}
      >
        <Link href="/" className="back-btn">
          ← Back to Home
        </Link>

        <LogoutButton />
      </div>

      <h1>Driver Dashboard</h1>
      <Link
  href="/driver-profile"
  style={{
    display: "inline-block",
    padding: "10px 18px",
    backgroundColor: "#166534",
    color: "white",
    borderRadius: "6px",
    textDecoration: "none",
    marginBottom: "20px"
  }}
>
  My Profile
</Link>

      

      <p>
        Manage your driver profile and tour requests.
      </p>

      {/* Driver Profile */}
      <div
        style={{
          padding: "25px",
          border: "1px solid #ddd",
          borderRadius: "12px",
          marginTop: "25px",
          marginBottom: "30px",
          backgroundColor: "#f0fdf4",
          boxShadow: "0 3px 10px rgba(0,0,0,0.05)",
        }}
      >
        <h2 style={{ color: "#166534" }}>
          My Driver Profile
        </h2>

        {profileLoading && (
          <p>Loading driver profile...</p>
        )}

        {profileError && (
          <p style={{ color: "#dc2626" }}>
            Error: {profileError}
          </p>
        )}

        {driverProfile && (
          <>
            <p>
              <strong>Driver ID:</strong>{" "}
              {driverProfile.id}
            </p>

            <p>
              <strong>Name:</strong>{" "}
              {driverProfile.name}
            </p>

            <p>
              <strong>Vehicle:</strong>{" "}
              {driverProfile.vehicle}
            </p>

            <p>
              <strong>Location:</strong>{" "}
              {driverProfile.location}
            </p>

            <p>
              <strong>Account Availability:</strong>{" "}
              <strong
                style={{
                  color: driverProfile.available
                    ? "#166534"
                    : "#dc2626",
                }}
              >
                {driverProfile.available
                  ? "Active"
                  : "Inactive"}
              </strong>
            </p>

            <p
              style={{
                fontSize: "13px",
                color: "#64748b",
              }}
            >
              Trip availability is checked separately
              for each travel date.
            </p>
          </>
        )}
      </div>

      {/* Requests */}
      <h2>My Tour Requests</h2>

      {message && (
        <p
          style={{
            color: message.startsWith("Error")
              ? "#dc2626"
              : "#166534",
          }}
        >
          {message}
        </p>
      )}

      {requests.length === 0 && !message && (
        <p>No driver requests found.</p>
      )}

      {/* Request Cards */}
      {requests.map((request) => {
        const remaining = getRemainingTime(
          request,
          now
        );

        const expiredLocally =
          request.status === "Pending" &&
          remaining === 0;

        const displayStatus = expiredLocally
          ? "Expired"
          : request.status;

        const canRespond =
          request.status === "Pending" &&
          remaining !== 0;

        const isUrgent =
          remaining !== null &&
          remaining <= 60;

        return (
          <div
            key={request.id}
            className="tour-card"
            style={{
              padding: "25px",
              marginBottom: "20px",
              borderRadius: "12px",
            }}
          >
            <h3 style={{ color: "#166534" }}>
              {request.tourName}
            </h3>

            <p>
              <strong>Request ID:</strong>{" "}
              {request.id}
            </p>

            <p>
              <strong>Booking ID:</strong>{" "}
              {request.bookingId}
            </p>

            <hr />

            <h4 style={{ color: "#166534" }}>
              Customer & Trip Details
            </h4>

            <p>
              <strong>Customer Name:</strong>{" "}
              {request.customerName || "Not available"}
            </p>

            <p>
              <strong>Travel Date:</strong>{" "}
              {request.travelDate || "Not available"}
            </p>

            <p>
              <strong>Number of Passengers:</strong>{" "}
              {request.people ?? "Not available"}
            </p>

            <p>
              <strong>Tour Package:</strong>{" "}
              {request.tourName}
            </p>

            <hr />

            <p>
              <strong>Driver:</strong>{" "}
              {request.driverName}
            </p>

            {/* Request Status */}
            <p>
              <strong>Request Status:</strong>{" "}
              <strong
                style={{
                  color:
                    displayStatus === "Accepted"
                      ? "#166534"
                      : displayStatus === "Pending"
                      ? "#ca8a04"
                      : "#dc2626",
                }}
              >
                {displayStatus}
              </strong>
            </p>

            {/* Live Countdown */}
            {request.status === "Pending" &&
              !expiredLocally && (
                <div
                  style={{
                    backgroundColor: isUrgent
                      ? "#fee2e2"
                      : "#eff6ff",
                    border: `1px solid ${
                      isUrgent ? "#fca5a5" : "#bfdbfe"
                    }`,
                    padding: "20px",
                    borderRadius: "10px",
                    textAlign: "center",
                    marginTop: "20px",
                    marginBottom: "20px",
                  }}
                >
                  <h4 style={{ marginTop: 0 }}>
                    Time Remaining to Respond
                  </h4>

                  <div
                    style={{
                      fontSize: "42px",
                      fontWeight: "bold",
                      color: isUrgent
                        ? "#dc2626"
                        : "#2563eb",
                    }}
                  >
                    {remaining === null
                      ? "Unavailable"
                      : formatTime(remaining)}
                  </div>

                  {remaining !== null && (
                    <div
                      style={{
                        height: "10px",
                        backgroundColor: "#e5e7eb",
                        borderRadius: "10px",
                        marginTop: "15px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${
                            (remaining / 600) * 100
                          }%`,
                          height: "100%",
                          backgroundColor: isUrgent
                            ? "#dc2626"
                            : "#2563eb",
                          transition: "width 1s linear",
                        }}
                      />
                    </div>
                  )}

                  {isUrgent && (
                    <p
                      style={{
                        color: "#dc2626",
                        fontWeight: "bold",
                      }}
                    >
                      Hurry! Less than 1 minute left.
                    </p>
                  )}

                  {remaining === null && (
                    <p style={{ color: "#dc2626" }}>
                      Countdown data unavailable.
                      Check the backend API.
                    </p>
                  )}
                </div>
              )}

            {/* Expired Message */}
            {displayStatus === "Expired" && (
              <div
                style={{
                  padding: "15px",
                  backgroundColor: "#fee2e2",
                  color: "#991b1b",
                  borderRadius: "8px",
                  marginTop: "15px",
                }}
              >
                <strong>Request Expired</strong>

                <p>
                  The 10-minute response period has ended.
                  This request can no longer be accepted
                  or rejected.
                </p>
              </div>
            )}

            {/* Request-specific Error */}
            {requestErrors[request.id] && (
              <p
                role="alert"
                style={{
                  color: "#b91c1c",
                  backgroundColor: "#fee2e2",
                  padding: "12px",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  marginTop: "12px",
                }}
              >
                ⚠ {requestErrors[request.id]}
              </p>
            )}

            {/* Accept / Reject */}
            {canRespond && (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "15px",
                }}
              >
                <button
                  className="details-btn"
                  disabled={loadingId !== null}
                  onClick={() =>
                    updateStatus(
                      request.id,
                      "Accepted"
                    )
                  }
                >
                  {loadingId === request.id
                    ? "Processing..."
                    : "Accept"}
                </button>

                <button
                  className="details-btn"
                  style={{
                    backgroundColor: "#dc2626",
                  }}
                  disabled={loadingId !== null}
                  onClick={() =>
                    updateStatus(
                      request.id,
                      "Rejected"
                    )
                  }
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}

// Protected Driver Dashboard
export default function ProtectedDriverDashboard() {
  return (
    <AuthGuard role="driver">
      <DriverDashboard />
    </AuthGuard>
  );
}
