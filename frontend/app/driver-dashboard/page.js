
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import AuthGuard from "../components/AuthGuard";
import LogoutButton from "../components/LogoutButton";

const API_URL = "http://127.0.0.1:5000";

// Driver Dashboard
function DriverDashboard() {
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("Loading...");
  const [loadingId, setLoadingId] = useState(null);

  const [requestErrors, setRequestErrors] = useState({});

  // Driver Profile States
  const [driverProfile, setDriverProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  // Load driver profile
  async function loadDriverProfile() {
    try {
      setProfileError("");

      const response = await fetch(
        `${API_URL}/api/driver-profile`,
        {
          credentials: "include",
          cache: "no-store"
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
          cache: "no-store"
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

      setRequests(data);
      setMessage("");

    } catch (error) {
      setMessage("Error: " + error.message);
    }
  }

  useEffect(() => {
    loadDriverProfile();
    loadRequests();
  }, []);

  // Accept or Reject a request
  async function updateStatus(requestId, status) {
    setLoadingId(requestId);
    setMessage("");

    setRequestErrors((previous) => ({
      ...previous,
      [requestId]: ""
    }));

    try {
      const response = await fetch(
        `${API_URL}/api/driver-requests/${requestId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            status
          })
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

      // Update status while keeping customer and trip details
      setRequests((previous) =>
        previous.map((request) =>
          Number(request.id) === Number(requestId)
            ? {
                ...request,
                ...result.request
              }
            : request
        )
      );

      setMessage(result.message);

      // Refresh driver profile
      if (status === "Accepted") {
        await loadDriverProfile();
      }

    } catch (error) {
      setRequestErrors((previous) => ({
        ...previous,
        [requestId]: error.message
      }));
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

      <h1>Driver Dashboard</h1>

      <p>
        Manage your driver profile and tour requests.
      </p>

      {/* Driver Profile Section */}
      <div
        style={{
          padding: "25px",
          border: "1px solid #ddd",
          borderRadius: "12px",
          marginTop: "25px",
          marginBottom: "30px",
          backgroundColor: "#f0fdf4",
          boxShadow: "0 3px 10px rgba(0,0,0,0.05)"
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
                    : "#dc2626"
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
                color: "#64748b"
              }}
            >
              Trip availability is checked separately
              for each travel date.
            </p>
          </>
        )}
      </div>

      {/* Requests Section */}
      <h2>My Tour Requests</h2>

      {/* General Message */}
      {message && (
        <p
          style={{
            color: message.startsWith("Error")
              ? "#dc2626"
              : "#166534"
          }}
        >
          {message}
        </p>
      )}

      {/* No Requests */}
      {requests.length === 0 && !message && (
        <p>No driver requests found.</p>
      )}

      {/* Driver Request Cards */}
      {requests.map((request) => (
        <div
          key={request.id}
          className="tour-card"
          style={{
            padding: "25px",
            marginBottom: "20px",
            borderRadius: "12px"
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

          {/* Customer and Trip Details */}
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

          {/* Driver Details */}
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
                  request.status === "Accepted"
                    ? "#166534"
                    : request.status === "Rejected"
                    ? "#dc2626"
                    : "#ca8a04"
              }}
            >
              {request.status}
            </strong>
          </p>

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
                marginTop: "12px"
              }}
            >
              ⚠ {requestErrors[request.id]}
            </p>
          )}

          {/* Accept / Reject Buttons */}
          {request.status === "Pending" && (
            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "15px"
              }}
            >
              <button
                className="details-btn"
                disabled={loadingId !== null}
                onClick={() =>
                  updateStatus(request.id, "Accepted")
                }
              >
                {loadingId === request.id
                  ? "Processing..."
                  : "Accept"}
              </button>

              <button
                className="details-btn"
                style={{
                  backgroundColor: "#dc2626"
                }}
                disabled={loadingId !== null}
                onClick={() =>
                  updateStatus(request.id, "Rejected")
                }
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
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
