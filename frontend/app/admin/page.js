
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = "http://127.0.0.1:5000";

export default function AdminDashboard() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState("");
  const [logoutError, setLogoutError] = useState("");

  // Load Admin Dashboard
  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const meResponse = await fetch(
          `${API}/api/me`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

        if (meResponse.status === 401) {
          router.replace("/login");
          return;
        }

        if (!meResponse.ok) {
          throw new Error("Failed to check login.");
        }

        const meData = await meResponse.json();
        const currentUser = meData.user;

        if (
          String(currentUser?.role).toLowerCase() !==
          "admin"
        ) {
          throw new Error(
            "Access denied. Admin account required."
          );
        }

        const statsResponse = await fetch(
          `${API}/api/admin/stats`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

        const statsData = await statsResponse.json();

        if (!statsResponse.ok) {
          throw new Error(
            statsData.message ||
            "Failed to load dashboard."
          );
        }

        if (active) {
          setUser(currentUser);
          setStats(statsData);
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

    loadDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  // Admin Logout
  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      const response = await fetch(
        `${API}/api/logout`,
        {
          method: "POST",
          credentials: "include"
        }
      );

      if (!response.ok) {
        throw new Error("Logout failed. Please try again.");
      }

      // Clear Admin Dashboard data
      setUser(null);
      setStats(null);

      // Redirect to Login Page
      window.location.replace("/login");

    } catch (err) {
      setLogoutError(err.message);
      setLoggingOut(false);
    }
  }

  const cards = stats
    ? [
        {
          title: "Customers",
          value: stats.totalCustomers,
          icon: "👥"
        },
        {
          title: "Drivers",
          value: stats.totalDrivers,
          icon: "🚗"
        },
        {
          title: "Translators",
          value: stats.totalTranslators,
          icon: "🌐"
        },
        {
          title: "Tours",
          value: stats.totalTours,
          icon: "🏝️"
        },
        {
          title: "Total Bookings",
          value: stats.totalBookings,
          icon: "📅"
        },
        {
          title: "Pending Bookings",
          value: stats.pendingBookings,
          icon: "⏳"
        },
        {
          title: "Cancelled Bookings",
          value: stats.cancelledBookings,
          icon: "❌"
        },
        {
          title: "Customer Reviews",
          value: stats.totalReviews,
          icon: "⭐"
        }
      ]
    : [];

  return (
    <main
      style={{
        maxWidth: "1100px",
        margin: "30px auto",
        padding: "20px",
        fontFamily: "Arial"
      }}
    >
      {loading && (
        <p>Loading Admin Dashboard...</p>
      )}

      {error && (
        <div>
          <h2 style={{ color: "red" }}>
            {error}
          </h2>

          <Link href="/login">
            Go to Login
          </Link>
        </div>
      )}

      {logoutError && (
        <p
          role="alert"
          style={{
            color: "red",
            marginBottom: "20px"
          }}
        >
          {logoutError}
        </p>
      )}

      {!loading && !error && user && stats && (
        <>
          {/* ADMIN DASHBOARD HEADER */}
          <div
            style={{
              backgroundColor: "#166534",
              color: "white",
              padding: "25px",
              borderRadius: "12px",
              marginBottom: "25px"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "15px"
              }}
            >
              <h1 style={{ margin: 0 }}>
                Smart Tour Admin Dashboard
              </h1>

              {/* LOGOUT BUTTON */}
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                style={{
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: "none",
                  padding: "12px 22px",
                  borderRadius: "7px",
                  cursor: loggingOut
                    ? "not-allowed"
                    : "pointer",
                  fontSize: "15px",
                  fontWeight: "bold"
                }}
              >
                {loggingOut
                  ? "Logging out..."
                  : "Logout"}
              </button>
            </div>

            <p style={{ marginTop: "20px" }}>
              Welcome, <strong>{user.name}</strong>!
            </p>

            <p>
              Manage your tour booking platform.
            </p>
          </div>

          {/* PLATFORM OVERVIEW */}
          <h2>Platform Overview</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "18px"
            }}
          >
            {cards.map((card) => (
              <div
                key={card.title}
                style={{
                  backgroundColor: "#f9fafb",
                  padding: "22px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px"
                }}
              >
                <div
                  style={{
                    fontSize: "30px",
                    marginBottom: "8px"
                  }}
                >
                  {card.icon}
                </div>

                <h3>{card.title}</h3>

                <p
                  style={{
                    fontSize: "30px",
                    fontWeight: "bold",
                    color: "#166534",
                    marginBottom: 0
                  }}
                >
                  {card.value ?? 0}
                </p>
              </div>
            ))}
          </div>

          {/* ADMIN MANAGEMENT */}
          <h2 style={{ marginTop: "35px" }}>
            Management
          </h2>

          <Link
            href="/admin/tours"
            style={{
              display: "inline-block",
              padding: "14px 24px",
              backgroundColor: "#166534",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "bold"
            }}
          >
            Manage Tour Packages
          </Link>
        </>
      )}
    </main>
  );
}
