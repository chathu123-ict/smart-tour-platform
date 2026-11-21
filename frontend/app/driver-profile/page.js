
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "../components/AuthGuard";

const API = "http://127.0.0.1:5000";

function DriverProfilePage() {
  const [profile, setProfile] = useState({
    name: "",
    vehicle: "",
    location: "",
    available: true
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch(
          `${API}/api/driver-profile`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load profile"
          );
        }

        if (active) {
          setProfile({
            name: data.name || "",
            vehicle: data.vehicle || "",
            location: data.location || "",
            available: Boolean(data.available)
          });
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  async function saveProfile(event) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API}/api/driver-profile`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(profile)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update profile"
        );
      }

      setProfile({
        name: data.driver.name,
        vehicle: data.driver.vehicle,
        location: data.driver.location,
        available: Boolean(data.driver.available)
      });

      setMessage("Profile updated successfully!");
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "12px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    marginTop: "7px",
    marginBottom: "18px",
    boxSizing: "border-box"
  };

  return (
    <main
      style={{
        maxWidth: "700px",
        margin: "30px auto",
        padding: "20px",
        fontFamily: "Arial"
      }}
    >
      <Link href="/driver-dashboard">
        ← Back to Driver Dashboard
      </Link>

      <h1>My Driver Profile</h1>

      <p>
        Manage your personal information and availability.
      </p>

      {loading && <p>Loading profile...</p>}

      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}

      {message && (
        <p role="status" style={{ color: "green" }}>
          {message}
        </p>
      )}

      {!loading && profile.name && (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "25px",
            marginTop: "25px",
            backgroundColor: "#f9fafb"
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            {profile.name}
          </h2>

          <p>
            Current Status:{" "}
            <strong
              style={{
                color: profile.available
                  ? "green"
                  : "red"
              }}
            >
              {profile.available
                ? "Available"
                : "Unavailable"}
            </strong>
          </p>

          <form onSubmit={saveProfile}>
            <label htmlFor="driverName">
              <strong>Driver Name</strong>
            </label>

            <input
              id="driverName"
              name="name"
              type="text"
              maxLength={100}
              required
              value={profile.name}
              onChange={handleChange}
              disabled={!editing || saving}
              style={inputStyle}
            />

            <label htmlFor="vehicle">
              <strong>Vehicle</strong>
            </label>

            <input
              id="vehicle"
              name="vehicle"
              type="text"
              maxLength={100}
              required
              value={profile.vehicle}
              onChange={handleChange}
              disabled={!editing || saving}
              style={inputStyle}
            />

            <label htmlFor="location">
              <strong>Location</strong>
            </label>

            <input
              id="location"
              name="location"
              type="text"
              maxLength={100}
              required
              value={profile.location}
              onChange={handleChange}
              disabled={!editing || saving}
              style={inputStyle}
            />

            <div
              style={{
                marginBottom: "25px",
                padding: "15px",
                backgroundColor: "#fff",
                borderRadius: "8px"
              }}
            >
              <label
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center"
                }}
              >
                <input
                  type="checkbox"
                  checked={profile.available}
                  disabled={!editing || saving}
                  onChange={(event) =>
                    setProfile((previous) => ({
                      ...previous,
                      available: event.target.checked
                    }))
                  }
                />

                <strong>Available for Tour Requests</strong>
              </label>

              <p
                style={{
                  fontSize: "13px",
                  color: "#666"
                }}
              >
                Turn this off when you are not available
                for new tour requests.
              </p>
            </div>

            {!editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setMessage("");
                }}
                style={{
                  backgroundColor: "#166534",
                  color: "white",
                  padding: "12px 25px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Edit Profile
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: "10px"
                }}
              >
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    backgroundColor: "#166534",
                    color: "white",
                    padding: "12px 25px",
                    border: "none",
                    borderRadius: "6px"
                  }}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false);
                    setMessage("");
                    setError("");
                    // Reload the saved profile
                    window.location.reload();
                  }}
                  style={{
                    padding: "12px 25px",
                    border: "1px solid #ccc",
                    borderRadius: "6px"
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </main>
  );
}

export default function ProtectedDriverProfile() {
  return (
    <AuthGuard role="driver">
      <DriverProfilePage />
    </AuthGuard>
  );
}
