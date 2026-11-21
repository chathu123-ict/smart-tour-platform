
"use client";

import { useState } from "react";

const API_URL = "http://127.0.0.1:5000";

export default function ReviewForm({
  bookingId,
  reviewerType,
  onSubmitted
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submitReview(e) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/reviews`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bookingId,
          reviewerType,
          rating,
          comment
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Failed to submit review"
        );
      }

      setSubmitted(true);
      setMessage("Review submitted successfully!");
      onSubmitted?.();
    } catch (err) {
      setMessage("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        marginTop: "15px",
        padding: "15px",
        border: "1px solid #d1d5db",
        borderRadius: "8px"
      }}
    >
      <h4>Rate Your {reviewerType}</h4>

      {submitted ? (
        <p style={{ color: "green" }}>
          Thank you for your review!
        </p>
      ) : (
        <form onSubmit={submitReview}>
          <label htmlFor={`rating-${bookingId}-${reviewerType}`}>
            Rating
          </label>

          <select
            id={`rating-${bookingId}-${reviewerType}`}
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            style={{
              display: "block",
              padding: "8px",
              margin: "10px 0"
            }}
          >
            <option value={5}>★★★★★ (5)</option>
            <option value={4}>★★★★☆ (4)</option>
            <option value={3}>★★★☆☆ (3)</option>
            <option value={2}>★★☆☆☆ (2)</option>
            <option value={1}>★☆☆☆☆ (1)</option>
          </select>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write your experience (optional)"
            maxLength={1000}
            rows={3}
            style={{
              width: "100%",
              padding: "8px",
              marginBottom: "10px"
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 16px",
              backgroundColor: "#166534",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            {loading ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      )}

      {message && (
        <p
          role="status"
          style={{
            color: message.startsWith("Error")
              ? "#b91c1c"
              : "#15803d"
          }}
        >
          {message}
        </p>
      )}
    </section>
  );
}
