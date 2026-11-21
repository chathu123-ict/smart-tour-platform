
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const API = "http://127.0.0.1:5000";

export default function TranslatorDashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(0);

  const loadRequests = useCallback(async () => {
    try {
      const response = await fetch(
        `${API}/api/translator-requests`,
        {
          credentials: "include",
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load requests"
        );
      }

      const fetchedAt = Date.now();

      const items = (data.requests || []).map((request) => {
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

      setRequests(items);
      setNowMs(fetchedAt);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();

    const refresh = setInterval(loadRequests, 10000);

    const clock = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, [loadRequests]);

  async function updateStatus(id, status) {
    setBusyId(id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API}/api/translator-requests/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ status })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update request"
        );
      }

      setMessage(data.message || `Request ${status}`);
    } catch (err) {
      setError(err.message);
    } finally {
      await loadRequests();
      setBusyId(null);
    }
  }

  function statusColor(status) {
    if (status === "Accepted") return "green";
    if (status === "Pending") return "#b45309";
    return "red";
  }

  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "30px auto",
        padding: "20px",
        fontFamily: "Arial"
      }}
    >
      <Link href="/">← Back to Home</Link>

      <h1>Translator Dashboard</h1>



      <Link
  href="/translator-profile"
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
        Manage translation requests and respond within
        10 minutes.
      </p>

      <button
        onClick={loadRequests}
        style={{ padding: "10px 15px" }}
      >
        Refresh Requests
      </button>

      {message && (
        <p style={{ color: "green" }}>{message}</p>
      )}

      {error && (
        <p style={{ color: "red" }}>{error}</p>
      )}

      {loading && <p>Loading requests...</p>}

      {!loading && requests.length === 0 && (
        <p>No translator requests found.</p>
      )}

      {requests.map((request) => {
        const hasCountdown =
          request.expiresAtClient != null;

        const seconds = hasCountdown
          ? Math.max(
              0,
              Math.ceil(
                (request.expiresAtClient - nowMs) / 1000
              )
            )
          : null;

        const canRespond =
          request.status === "Pending" &&
          (!hasCountdown || seconds > 0);

        return (
          <div
            key={request.id}
            style={{
              border: "1px solid #ddd",
              padding: "22px",
              marginTop: "20px",
              borderRadius: "10px"
            }}
          >
            <h2>{request.tourName}</h2>

            <p>Request ID: {request.id}</p>
            <p>Booking ID: {request.bookingId}</p>
            <p>Customer: {request.customerName}</p>

            <p>
              Travel Date:{" "}
              {String(request.travelDate).slice(0, 10)}
            </p>

            <p>People: {request.people}</p>
            <p>Languages: {request.languages}</p>

            <p>
              Daily Fee: Rs.{" "}
              {Number(request.feePerDay).toLocaleString("en-LK")}
            </p>

            <p>
              Status:{" "}
              <strong
                style={{
                  color: statusColor(request.status)
                }}
              >
                {request.status}
              </strong>
            </p>

            {request.status === "Pending" && (
              <div
                style={{
                  padding: "15px",
                  backgroundColor: "#fef3c7",
                  borderRadius: "8px",
                  marginBottom: "15px"
                }}
              >
                <p style={{ marginTop: 0 }}>
                  Time Remaining to Respond
                </p>

                <h2
                  style={{
                    color:
                      seconds !== null && seconds <= 60
                        ? "red"
                        : "#92400e",
                    marginBottom: "5px"
                  }}
                >
                  {seconds === null
                    ? "Loading timer..."
                    : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`}
                </h2>

                <small>
                  {seconds === 0
                    ? "Time limit reached. Updating status..."
                    : "Accept or reject before the timer expires."}
                </small>
              </div>
            )}

            {canRespond && (
              <div
                style={{
                  display: "flex",
                  gap: "10px"
                }}
              >
                <button
                  disabled={busyId !== null}
                  onClick={() =>
                    updateStatus(request.id, "Accepted")
                  }
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "green",
                    color: "white",
                    border: "none",
                    borderRadius: "5px"
                  }}
                >
                  Accept
                </button>

                <button
                  disabled={busyId !== null}
                  onClick={() =>
                    updateStatus(request.id, "Rejected")
                  }
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "red",
                    color: "white",
                    border: "none",
                    borderRadius: "5px"
                  }}
                >
                  Reject
                </button>
              </div>
            )}

            {request.status === "Accepted" && (
              <p style={{ color: "green" }}>
                You have accepted this translation request.
              </p>
            )}

            {request.status === "Expired" && (
              <p style={{ color: "red" }}>
                This request expired after 10 minutes.
              </p>
            )}
          </div>
        );
      })}
    </main>
  );
}
