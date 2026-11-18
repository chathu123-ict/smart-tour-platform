
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const API = "http://127.0.0.1:5000";

export default function TranslatorDashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

      setRequests(data.requests || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();

    const timer = setInterval(loadRequests, 30000);

    return () => clearInterval(timer);
  }, [loadRequests]);

  async function updateStatus(id, status) {
    setLoadingId(id);
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

      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      await loadRequests();
      setLoadingId(null);
    }
  }

  const cardStyle = {
    border: "1px solid #ddd",
    borderRadius: "10px",
    padding: "20px",
    marginBottom: "15px",
    backgroundColor: "white"
  };

  return (
    <main style={{
      maxWidth: "900px",
      margin: "30px auto",
      padding: "20px",
      fontFamily: "Arial"
    }}>
      <Link href="/">← Back to Home</Link>

      <h1>Translator Dashboard</h1>
      <p>Manage your tour translation requests</p>

      <button
        onClick={loadRequests}
        style={{ padding: "10px 18px", marginBottom: "20px" }}
      >
        Refresh Requests
      </button>

      {message && (
        <p style={{ color: "green" }}>{message}</p>
      )}

      {error && (
        <div>
          <p style={{ color: "red" }}>{error}</p>
          <Link href="/login">Go to Login</Link>
        </div>
      )}

      {loading && <p>Loading requests...</p>}

      {!loading && !error && requests.length === 0 && (
        <p>No translator requests found.</p>
      )}

      {!loading && !error && requests.map((request) => (
        <div key={request.id} style={cardStyle}>
          <h2>{request.tourName}</h2>

          <p><strong>Request ID:</strong> {request.id}</p>

          <p>
            <strong>Customer:</strong> {request.customerName}
          </p>

          <p>
            <strong>Travel Date:</strong>{" "}
            {String(request.travelDate).slice(0, 10)}
          </p>

          <p>
            <strong>People:</strong> {request.people}
          </p>

          <p>
            <strong>Languages:</strong> {request.languages}
          </p>

          <p>
            <strong>Daily Fee:</strong> Rs.{" "}
            {Number(request.feePerDay).toLocaleString()}
          </p>

          <p>
            <strong>Status:</strong>{" "}
            <span style={{
              color:
                request.status === "Accepted"
                  ? "green"
                  : request.status === "Pending"
                  ? "#b45309"
                  : "red"
            }}>
              {request.status}
            </span>
          </p>

          {request.status === "Pending" && (
            <div style={{
              display: "flex",
              gap: "10px",
              marginTop: "15px"
            }}>
              <button
                disabled={loadingId !== null}
                onClick={() =>
                  updateStatus(request.id, "Accepted")
                }
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#15803d",
                  color: "white",
                  border: "none",
                  borderRadius: "5px"
                }}
              >
                {loadingId === request.id
                  ? "Processing..."
                  : "Accept"}
              </button>

              <button
                disabled={loadingId !== null}
                onClick={() =>
                  updateStatus(request.id, "Rejected")
                }
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: "5px"
                }}
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
