
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = "http://127.0.0.1:5000";

export default function BookingForm({ tourId }) {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Load logged-in customer details
  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const response = await fetch(`${API}/api/me`, {
          credentials: "include",
          cache: "no-store"
        });

        if (response.status === 401) {
          router.replace(
            `/login?next=${encodeURIComponent(
              `/tours/${tourId}`
            )}`
          );
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to verify login");
        }

        const data = await response.json();

        if (!data.user) {
          router.replace(
            `/login?next=${encodeURIComponent(
              `/tours/${tourId}`
            )}`
          );
          return;
        }

        if (
          String(data.user.role).toLowerCase() !== "customer"
        ) {
          router.replace("/driver-dashboard");
          return;
        }

        if (active) {
          setUser(data.user);
        }

      } catch (error) {
        if (active) {
          setMessage("Error: " + error.message);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, [router, tourId]);

  // Submit booking
  async function handleSubmit(event) {
    event.preventDefault();

    if (!user || loading) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const booking = {
      tourId,
      travelDate: formData.get("travelDate"),
      people: Number(formData.get("people"))
    };

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(booking)
      });

      if (response.status === 401) {
        router.replace(
          `/login?next=${encodeURIComponent(
            `/tours/${tourId}`
          )}`
        );
        return;
      }

      const result = await response.json();

      if (response.status === 403) {
        throw new Error(
          "Only customers can make bookings"
        );
      }

      if (!response.ok) {
        throw new Error(
          result.message || "Booking failed"
        );
      }

      // Booking successfully saved
      form.reset();

      // Redirect to Booking Dashboard
      const bookingId = result.booking?.id;

      if (bookingId) {
        router.push(
          `/bookings?newBooking=${encodeURIComponent(bookingId)}`
        );
      } else {
        router.push("/bookings?success=1");
      }

      router.refresh();

    } catch (error) {
      setMessage("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return <p>Loading customer details...</p>;
  }

  if (!user) {
    return (
      <p style={{ color: "#dc2626" }}>
        {message || "Checking login..."}
      </p>
    );
  }

  return (
    <section id="booking" style={{ marginTop: "40px" }}>
      <h2>Book Your Tour</h2>

      <form
        onSubmit={handleSubmit}
        className="booking-form"
      >
        <label>Full Name</label>

        <input
          type="text"
          value={user.name || ""}
          readOnly
          style={readOnlyStyle}
        />

        <label>Email Address</label>

        <input
          type="email"
          value={user.email || ""}
          readOnly
          style={readOnlyStyle}
        />

        <label>Travel Date</label>

        <input
          type="date"
          name="travelDate"
          min={new Date().toLocaleDateString("en-CA")}
          required
        />

        <label>Number of People</label>

        <input
          type="number"
          name="people"
          min="1"
          defaultValue="1"
          required
        />

        <button type="submit" disabled={loading}>
          {loading
            ? "Submitting..."
            : "Submit Booking Request"}
        </button>
      </form>

      {message && (
        <p
          style={{
            marginTop: "15px",
            color: "#dc2626"
          }}
        >
          {message}
        </p>
      )}
    </section>
  );
}

const readOnlyStyle = {
  backgroundColor: "#e8f0fe",
  color: "#111827",
  cursor: "not-allowed"
};
