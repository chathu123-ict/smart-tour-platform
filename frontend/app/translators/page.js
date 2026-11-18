
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = "http://127.0.0.1:5000";

const languages = [
  "English",
  "Sinhala",
  "Tamil",
  "Japanese",
  "Chinese",
  "French",
  "German",
  "Hindi",
  "Korean",
  "Arabic",
  "Spanish",
  "Russian"
];

export default function TranslatorsPage() {
  const [translators, setTranslators] = useState([]);
  const [language, setLanguage] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [bookingId, setBookingId] = useState("");

  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSuccess, setRequestSuccess] = useState(false);



  // Automatically fill booking ID and travel date
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const id = params.get("bookingId");
    const date = params.get("travelDate");

    if (id && /^\d+$/.test(id) && Number(id) > 0) {
      setBookingId(id);
    }

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setTravelDate(date);
    }
  }, []);





  // Load translators
  useEffect(() => {
    const controller = new AbortController();

    async function loadTranslators() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();

        if (language) {
          params.set("language", language);
        }

        if (travelDate) {
          params.set("travelDate", travelDate);
        }

        const query = params.toString();

        const url = `${API}/api/translators${
          query ? `?${query}` : ""
        }`;

        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store"
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load translators"
          );
        }

        if (!Array.isArray(data)) {
          throw new Error("Invalid translator data");
        }

        setTranslators(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
          setTranslators([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadTranslators();

    return () => controller.abort();
  }, [language, travelDate]);

  // Send translator request
  async function requestTranslator(translatorId) {
    const id = Number(bookingId);

    setRequestMessage("");
    setRequestSuccess(false);

    if (
      !Number.isSafeInteger(id) ||
      id < 1
    ) {
      setRequestMessage(
        "Please enter a valid Booking ID"
      );
      return;
    }

    if (!travelDate) {
      setRequestMessage(
        "Please select your booking travel date"
      );
      return;
    }

    setSendingId(translatorId);

    try {
      const response = await fetch(
        `${API}/api/translator-requests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            bookingId: id,
            translatorId
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Request failed"
        );
      }

      setRequestSuccess(true);
      setRequestMessage(
        `Translator request #${data.request.id} sent successfully! Status: Pending`
      );

    } catch (err) {
      setRequestMessage(err.message);
    } finally {
      setSendingId(null);
    }
  }

  const inputStyle = {
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    width: "100%",
    marginTop: "6px",
    boxSizing: "border-box"
  };

  return (
    <main
      style={{
        padding: "30px 20px",
        fontFamily: "Arial",
        maxWidth: "1100px",
        margin: "auto"
      }}
    >
      <Link href="/">← Back to Home</Link>

      <h1>Available Translators</h1>

      <p>
        Find and request a translator for your tour.
      </p>

      {/* Booking details */}
      <div
        style={{
          padding: "20px",
          backgroundColor: "#f3f4f6",
          borderRadius: "10px",
          marginBottom: "25px"
        }}
      >
        <h2>Request a Translator</h2>

        <p>
          Enter your active Tour Booking ID and
          select your travel date.
        </p>

        <label>Booking ID</label>

        <input
          type="number"
          min="1"
          value={bookingId}
          onChange={(e) => {
            setBookingId(e.target.value);
            setRequestMessage("");
          }}
          placeholder="Example: 4008"
          style={{
            ...inputStyle,
            maxWidth: "300px"
          }}
        />

        <p style={{ fontSize: "13px" }}>
          Use the Booking ID from your Booking Dashboard.
        </p>

        {requestMessage && (
          <p
            role="status"
            style={{
              color: requestSuccess
                ? "#166534"
                : "#dc2626",
              fontWeight: "bold"
            }}
          >
            {requestMessage}
          </p>
        )}
      </div>

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "15px",
          marginBottom: "30px"
        }}
      >
        <div>
          <label>Select Language</label>

          <select
            style={inputStyle}
            value={language}
            onChange={(e) =>
              setLanguage(e.target.value)
            }
          >
            <option value="">All Languages</option>

            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Travel Date</label>

          <input
            type="date"
            style={inputStyle}
            value={travelDate}
            onChange={(e) =>
              setTravelDate(e.target.value)
            }
          />
        </div>
      </div>

      {loading && (
        <p>Loading translators...</p>
      )}

      {error && (
        <p style={{ color: "red" }}>
          {error}
        </p>
      )}

      {!loading && !error && (
        <p>
          <strong>
            {translators.length} translator(s) found
          </strong>
        </p>
      )}

      {/* Translator cards */}
      {!loading && !error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px"
          }}
        >
          {translators.map((translator) => (
            <div
              key={translator.id}
              style={{
                padding: "20px",
                border: "1px solid #ddd",
                borderRadius: "10px",
                boxShadow:
                  "0 2px 8px rgba(0,0,0,0.07)"
              }}
            >
              <h2>{translator.name}</h2>

              <p>
                <strong>Languages:</strong>{" "}
                {translator.languages}
              </p>

              <p>
                <strong>Daily Fee:</strong>{" "}
                Rs.{" "}
                {Number(
                  translator.feePerDay
                ).toLocaleString("en-LK")}
              </p>

              <p>
                <strong>Availability:</strong>{" "}
                <span
                  style={{
                    color: translator.availableForDate
                      ? "green"
                      : "red",
                    fontWeight: "bold"
                  }}
                >
                  {translator.availableForDate
                    ? "Available"
                    : "Unavailable"}
                </span>
              </p>

              <p
                style={{
                  fontSize: "13px",
                  color: "#666"
                }}
              >
                {travelDate
                  ? `Availability for ${travelDate}`
                  : "General availability"}
              </p>

              {/* Request button */}
              <button
                type="button"
                disabled={
                  !translator.availableForDate ||
                  sendingId !== null
                }
                onClick={() =>
                  requestTranslator(translator.id)
                }
                style={{
                  padding: "12px",
                  width: "100%",
                  marginTop: "10px",
                  backgroundColor:
                    translator.availableForDate
                      ? "#166534"
                      : "#9ca3af",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor:
                    translator.availableForDate &&
                    sendingId === null
                      ? "pointer"
                      : "not-allowed"
                }}
              >
                {sendingId === translator.id
                  ? "Sending Request..."
                  : translator.availableForDate
                  ? "Request Translator"
                  : "Unavailable"}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading &&
        !error &&
        translators.length === 0 && (
          <p>
            No translators found for this language.
          </p>
        )}
    </main>
  );
}
