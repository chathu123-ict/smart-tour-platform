
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { districts } from "../data/districts";

const API = "http://127.0.0.1:5000";

export default function BookingForm({ tourId }) {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [tripType, setTripType] = useState("round-trip");

  const [pickupDistrict, setPickupDistrict] = useState("");

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
            `/login?next=${encodeURIComponent(`/tours/${tourId}`)}`
          );
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to verify login");
        }

        const data = await response.json();

        if (!data.user) {
          router.replace(
            `/login?next=${encodeURIComponent(`/tours/${tourId}`)}`
          );
          return;
        }

        if (String(data.user.role).toLowerCase() !== "customer") {
          router.replace("/login");
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

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user || loading) return;

    const formData = new FormData(event.currentTarget);

    const pickup = pickupLocation.trim();
    const dropoff = dropoffLocation.trim();

    if (!pickup || !dropoff) {
      setMessage("Please enter pickup and drop-off locations.");
      return;
    }

    if (pickup.length > 255 || dropoff.length > 255) {
      setMessage("Location names must be under 256 characters.");
      return;
    }

    const booking = {
      tourId,
      travelDate: formData.get("travelDate"),
      people: Number(formData.get("people")),
      pickupLocation: pickup,
      dropoffLocation: dropoff,
      tripType,
      pickupDistrict 
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
          `/login?next=${encodeURIComponent(`/tours/${tourId}`)}`
        );
        return;
      }

      const result = await response.json();

      if (response.status === 403) {
        throw new Error("Only customers can make bookings");
      }

      if (!response.ok) {
        throw new Error(result.message || "Booking failed");
      }

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

      <div
        style={{
          backgroundColor: "#eff6ff",
          border: "1px solid #93c5fd",
          borderRadius: "8px",
          padding: "15px",
          marginBottom: "20px"
        }}
      >
        <strong>Important Pricing Information</strong>

        <p style={{ marginBottom: 0 }}>
          Tour package prices are base fees only.
          Final prices depend on your pickup location,
          journey distance, selected driver and optional
          translator service.
          Your final price will be calculated before payment.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="booking-form">
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

        <label>Trip Type</label>

        <select
          value={tripType}
          onChange={(event) => {
            const value = event.target.value;
            setTripType(value);

            if (value === "round-trip") {
              setDropoffLocation(pickupLocation);
            }
          }}
          required
        >
          <option value="round-trip">
            Round Trip (Going and Returning)
          </option>
          <option value="one-way">
            One-Way Trip
          </option>
        </select>


        <label>Pickup District</label>

<select
  value={pickupDistrict}
  onChange={(event) => setPickupDistrict(event.target.value)}
  required
>
  <option value="">Select your district</option>

  {districts.map((district) => (
    <option key={district} value={district}>
      {district}
    </option>
  ))}
</select>



        <label>Customer Pickup Location</label>
        <input
          type="text"
          placeholder="Example: Colombo Fort, Colombo"
          value={pickupLocation}
          maxLength={255}
          onChange={(event) =>
            setPickupLocation(event.target.value)
          }
          required
        />

        <label>Customer Drop-off Location</label>
        <input
          type="text"
          placeholder={
            tripType === "one-way"
              ? "Example: Sigiriya, Matale"
              : "Example: Colombo Fort, Colombo"
          }
          value={dropoffLocation}
          maxLength={255}
          onChange={(event) =>
            setDropoffLocation(event.target.value)
          }
          required
        />

        {tripType === "round-trip" && (
          <button
            type="button"
            onClick={() =>
              setDropoffLocation(pickupLocation)
            }
            style={{
              padding: "8px 12px",
              backgroundColor: "#e5e7eb",
              color: "#111827",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            Same as Pickup Location
          </button>
        )}

        <p style={{ fontSize: "13px", color: "#6b7280" }}>
          {tripType === "one-way"
            ? "Your journey ends at the drop-off location. Driver return charges may still apply."
            : "The driver will take you to the tour destination and then to your selected drop-off location."}
        </p>

        <div
          style={{
            backgroundColor: "#fff7ed",
            border: "1px solid #fdba74",
            padding: "12px",
            borderRadius: "8px"
          }}
        >
          <strong>Day Tour Policy</strong>
          <p style={{ marginBottom: 0 }}>
            This platform currently supports day tours only.
            The full journey must be completed within 24 hours.
            Route duration will be verified before payment.
          </p>
        </div>

        <button type="submit" disabled={loading}>
          {loading
            ? "Submitting..."
            : "Submit Booking Request"}
        </button>
      </form>

      {message && (
        <p
          role="status"
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
