
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import LogoutButton from "./components/LogoutButton";

const API = "http://127.0.0.1:5000";

export default function Home() {
  const router = useRouter();

  const [tours, setTours] = useState([]);
  const [user, setUser] = useState(null);
  const [checkingLogin, setCheckingLogin] = useState(true);
  const [loadingTours, setLoadingTours] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      try {
        const [toursResponse, sessionResponse] =
          await Promise.all([
            fetch(`${API}/api/tours`, {
              cache: "no-store"
            }),
            fetch(`${API}/api/me`, {
              credentials: "include",
              cache: "no-store"
            })
          ]);

        if (!toursResponse.ok) {
          throw new Error("Failed to load tours");
        }

        const toursData = await toursResponse.json();

        if (active) {
          setTours(toursData);
        }

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();

          if (active) {
            setUser(sessionData.user || null);
          }
        }

      } catch (error) {
        if (active) {
          setError(error.message);
        }
      } finally {
        if (active) {
          setCheckingLogin(false);
          setLoadingTours(false);
        }
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, []);

  const role = String(user?.role || "").toLowerCase();

  function openBookingDashboard() {
    if (!user) {
      router.push("/login?next=%2Fbookings");
      return;
    }

    if (role !== "customer") {
      router.push("/driver-dashboard");
      return;
    }

    router.push("/bookings");
  }

  function openDriverDashboard() {
    if (!user) {
      router.push("/login?next=%2Fdriver-dashboard");
      return;
    }

    if (role !== "driver") {
      router.push("/bookings");
      return;
    }

    router.push("/driver-dashboard");
  }

  return (
    <main
      style={{
        padding: "40px",
        fontFamily: "Arial"
      }}
    >
      {/* Login / Register / Logout */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "12px",
          marginBottom: "25px",
          flexWrap: "wrap"
        }}
      >
        {!checkingLogin && !user && (
          <>
            <Link
              href="/login"
              style={{
                padding: "10px 20px",
                backgroundColor: "#166534",
                color: "white",
                textDecoration: "none",
                borderRadius: "6px"
              }}
            >
              Login
            </Link>

            <Link
              href="/register"
              style={{
                padding: "10px 20px",
                backgroundColor: "#2563eb",
                color: "white",
                textDecoration: "none",
                borderRadius: "6px"
              }}
            >
              Register
            </Link>
          </>
        )}

        {!checkingLogin && user && (
          <>
            <span>
              Welcome, <strong>{user.name}</strong>
            </span>

            <LogoutButton />
          </>
        )}
      </div>

      {/* Navigation */}
      <header className="navbar">
        <h2>Smart Tour</h2>

        <nav>
          <Link href="/">Home</Link>

          <a href="#tours">Tours</a>

          <Link href="/drivers">Drivers</Link>

          {!checkingLogin && role !== "driver" && (
            <button
              type="button"
              onClick={openBookingDashboard}
              style={navButtonStyle}
            >
              Booking Dashboard
            </button>
          )}

          {!checkingLogin && role === "driver" && (
            <button
              type="button"
              onClick={openDriverDashboard}
              style={navButtonStyle}
            >
              Driver Dashboard
            </button>
          )}
        </nav>
      </header>

      <h1>Welcome to Smart Tour Sri Lanka</h1>

      <p>Explore beautiful destinations in Sri Lanka!</p>

      <h2 id="tours">Our Tour Packages</h2>

      {loadingTours && <p>Loading tours...</p>}

      {error && (
        <p style={{ color: "red" }}>
          Error: {error}
        </p>
      )}

      {!loadingTours && !error && tours.length === 0 && (
        <p>No tour packages available.</p>
      )}

      {/* Tour Cards */}
      <div className="tour-grid">
        {tours.map((tour) => (
          <div
            key={tour.id}
            className="tour-card"
          >
            <Image
              src={`/images/${String(
                tour.location || ""
              ).toLowerCase()}.jpg`}
              alt={tour.name}
              width={600}
              height={400}
              className="tour-image"
            />

            <h3>{tour.name}</h3>

            <p>Location: {tour.location}</p>

            <p>
              Price: Rs.{" "}
              {Number(tour.price).toLocaleString()}
            </p>

            <Link
              href={`/tours/${tour.id}`}
              className="details-btn"
            >
              View Details
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}

const navButtonStyle = {
  border: "none",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  padding: "0"
};
