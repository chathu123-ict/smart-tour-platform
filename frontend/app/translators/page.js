
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  "Russian",
];

export default function TranslatorsPage() {
  const [travelDate, setTravelDate] = useState("");
  const [language, setLanguage] = useState("");
  const [bookingId, setBookingId] = useState("");

  const [translators, setTranslators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showUnavailable, setShowUnavailable] =
    useState(false);

  const [sendingId, setSendingId] = useState(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSuccess, setRequestSuccess] =
    useState(false);


  const [autoFallbackEnabled, setAutoFallbackEnabled] =
  useState(false);


  

  // Read booking details from URL
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
    if (!travelDate) {
      setTranslators([]);
      setError("");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadTranslators() {
      setLoading(true);
      setError("");
      setTranslators([]);

      try {
        const params = new URLSearchParams();

        params.set("travelDate", travelDate);
        params.set("includeUnavailable", "true");

        if (language) {
          params.set("language", language);
        }

        const response = await fetch(
          `${API}/api/translators?${params.toString()}`,
          {
            cache: "no-store",
            credentials: "include",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load translators"
          );
        }

        if (!Array.isArray(data)) {
          throw new Error("Invalid translator data");
        }

        if (!controller.signal.aborted) {
          setTranslators(data);
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

    loadTranslators();

    return () => controller.abort();
  }, [travelDate, language]);

  // Check translator availability
  function isAvailable(translator) {
    return (
      translator.availableForDate === true ||
      translator.availableForDate === 1
    );
  }

  const availableTranslators = translators.filter(
    isAvailable
  );

  const displayedTranslators = showUnavailable
    ? translators
    : availableTranslators;

  // Send translator request
  async function requestTranslator(translatorId) {
    const id = Number(bookingId);

    setRequestMessage("");
    setRequestSuccess(false);

    if (!Number.isSafeInteger(id) || id < 1) {
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
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            bookingId: id,
            translatorId,
            autoFallbackEnabled
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Translator request failed"
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
    borderRadius: "5px",
    width: "100%",
    marginTop: "8px",
    boxSizing: "border-box",
  };

  return (
    <main
      style={{
        padding: "40px",
        fontFamily: "Arial",
      }}
    >
      
<div style={{
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "30px"
}}>
  <Link href="/" className="back-btn">
    ← Back to Home
  </Link>

  <Link
    href="/bookings"
    className="back-btn"
    style={{ backgroundColor: "#2563eb" }}
  >
    ← Back to Booking Dashboard
  </Link>
</div>


      <h1>Our Translators</h1>

      <p>
        Select a travel date to check translator
        availability.
      </p>

      {/* Booking Details */}
      <div
        style={{
          backgroundColor: "#f3f4f6",
          padding: "20px",
          borderRadius: "10px",
          marginBottom: "25px",
        }}
      >
        <h3>Request a Translator</h3>

        <p>
          Enter your active Tour Booking ID to request
          a translator.
        </p>

        <label htmlFor="bookingId">
          <strong>Booking ID:</strong>
        </label>

        <input
          id="bookingId"
          type="number"
          min="1"
          placeholder="Example: 4008"
          value={bookingId}
          onChange={(e) => {
            setBookingId(e.target.value);
            setRequestMessage("");
          }}
          style={{
            ...inputStyle,
            maxWidth: "300px",
          }}
        />

        <label
  style={{
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    marginTop: "15px",
    marginBottom: "15px"
  }}
>
  <input
    type="checkbox"
    checked={autoFallbackEnabled}
    onChange={(e) =>
      setAutoFallbackEnabled(e.target.checked)
    }
  />

  <span>
    <strong>
      Automatically find another translator
    </strong>

    <small style={{ display: "block", marginTop: "5px" }}>
      If my selected translator rejects or does not
      respond within 10 minutes, I agree to send a
      request to another available translator.
      The new translator must accept first.
    </small>
  </span>
</label>

        <p style={{ fontSize: "13px" }}>
          You can find your Booking ID in the{" "}
          <Link href="/bookings">
            Booking Dashboard
          </Link>.
        </p>

        {requestMessage && (
          <p
            role="status"
            style={{
              color: requestSuccess
                ? "green"
                : "red",
              fontWeight: "bold",
            }}
          >
            {requestMessage}
          </p>
        )}
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          marginBottom: "25px",
        }}
      >
        <div>
          <label htmlFor="travelDate">
            <strong>Travel Date:</strong>
          </label>

          <input
            id="travelDate"
            type="date"
            value={travelDate}
            onChange={(e) =>
              setTravelDate(e.target.value)
            }
            style={{
              ...inputStyle,
              minWidth: "200px",
            }}
          />
        </div>

        <div>
          <label htmlFor="language">
            <strong>Language:</strong>
          </label>

          <select
            id="language"
            value={language}
            onChange={(e) =>
              setLanguage(e.target.value)
            }
            style={{
              ...inputStyle,
              minWidth: "200px",
            }}
          >
            <option value="">All Languages</option>

            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!travelDate && (
        <p>
          Please select a travel date to view
          available translators.
        </p>
      )}

      {loading && <p>Loading translators...</p>}

      {error && (
        <p style={{ color: "red" }}>{error}</p>
      )}

      {travelDate && !loading && !error && (
        <>
          <h3>
            Available Translators:{" "}
            {availableTranslators.length}
          </h3>

          <label
            style={{
              display: "block",
              marginBottom: "20px",
            }}
          >
            <input
              type="checkbox"
              checked={showUnavailable}
              onChange={(e) =>
                setShowUnavailable(e.target.checked)
              }
            />{" "}
            Show unavailable translators too
          </label>

          {displayedTranslators.length === 0 ? (
            <p>
              No translators found for the selected
              date and language.
            </p>
          ) : (
            <div className="tour-grid">
              {displayedTranslators.map(
                (translator) => {
                  const available =
                    isAvailable(translator);

                  return (
                    <div
                      key={translator.id}
                      className="tour-card"
                    >
                      <h3>{translator.name}</h3>

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
                        <strong>Status:</strong>{" "}
                        <strong
                          style={{
                            color: available
                              ? "green"
                              : "red",
                          }}
                        >
                          {available
                            ? "Available"
                            : "Unavailable"}
                        </strong>
                      </p>

                      <button
                        type="button"
                        disabled={
                          !available ||
                          sendingId !== null
                        }
                        onClick={() =>
                          requestTranslator(
                            translator.id
                          )
                        }
                        style={{
                          padding: "12px",
                          width: "100%",
                          marginTop: "10px",
                          backgroundColor: available
                            ? "#166534"
                            : "#9ca3af",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor:
                            available &&
                            sendingId === null
                              ? "pointer"
                              : "not-allowed",
                        }}
                      >
                        {sendingId === translator.id
                          ? "Sending Request..."
                          : available
                          ? "Request Translator"
                          : "Unavailable"}
                      </button>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
