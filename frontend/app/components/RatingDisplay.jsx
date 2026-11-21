
"use client";

import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:5000";

export default function RatingDisplay({ type, personId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) {
      setData(null);
      setLoading(false);
      return;
    }

    let active = true;

    async function loadRatings() {
      try {
        const response = await fetch(
          `${API_URL}/api/reviews/${type}/${personId}`
        );

        if (!response.ok) {
          throw new Error("Failed to load ratings");
        }

        const result = await response.json();

        if (active) {
          setData(result);
        }
      } catch (error) {
        console.error("Rating error:", error);
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    setLoading(true);
    loadRatings();

    return () => {
      active = false;
    };
  }, [type, personId]);

  if (loading) {
    return <p>Loading ratings...</p>;
  }

  if (!data || data.totalReviews === 0) {
    return (
      <p style={{ color: "#6b7280" }}>
        No reviews yet
      </p>
    );
  }

  return (
    <div style={{ marginTop: "12px" }}>
      <p style={{ color: "#ca8a04", fontWeight: "bold" }}>
        ★ {Number(data.averageRating).toFixed(1)} / 5
        <span style={{ color: "#6b7280", marginLeft: "8px" }}>
          ({data.totalReviews} reviews)
        </span>
      </p>

      <details style={{ marginTop: "8px" }}>
        <summary style={{ cursor: "pointer" }}>
          View Customer Reviews
        </summary>

        {data.reviews.map((review) => (
          <div
            key={review.id}
            style={{
              borderBottom: "1px solid #e5e7eb",
              padding: "10px 0"
            }}
          >
            <p style={{ color: "#ca8a04" }}>
              {"★".repeat(review.rating)}
              {"☆".repeat(5 - review.rating)}
            </p>

            <p>{review.comment || "No comment provided"}</p>
          </div>
        ))}
      </details>
    </div>
  );
}
