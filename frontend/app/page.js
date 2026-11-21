
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import LogoutButton from "./components/LogoutButton";

const API = "http://127.0.0.1:5000";

export default function Home() {
  const [tours, setTours] = useState([]);
  const [user, setUser] = useState(null);
  const [checkingLogin, setCheckingLogin] = useState(true);
  const [loadingTours, setLoadingTours] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      // Load tour packages
      try {
        const toursResponse = await fetch(
          `${API}/api/tours`,
          {
            cache: "no-store"
          }
        );

        if (!toursResponse.ok) {
          throw new Error("Failed to load tours");
        }

        const toursData = await toursResponse.json();

        if (active) {
          setTours(toursData);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoadingTours(false);
        }
      }

      // Check logged-in user and role
      try {
        const sessionResponse = await fetch(
          `${API}/api/me`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

        if (sessionResponse.ok) {
          const sessionData =
            await sessionResponse.json();

          if (active) {
            setUser(sessionData.user || null);
          }
        } else {
          if (active) {
            setUser(null);
          }
        }
      } catch (err) {
        console.error("Session check error:", err);

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setCheckingLogin(false);
        }
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, []);

  // Normalize role
  const role = String(user?.role || "")
    .trim()
    .toLowerCase();

  const isCustomer = role === "customer";
  const isDriver = role === "driver";
  const isTranslator = role === "translator";
  const isGuest = !user;

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
        {!checkingLogin && isGuest && (
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
              Welcome,{" "}
              <strong>{user.name}</strong>
              {" "}
              ({user.role})
            </span>

            <LogoutButton />
          </>
        )}
      </div>

      {/* Navigation */}
      <header className="navbar">
        <h2>Smart Tour</h2>

        <nav>
          {/* Everyone */}
          <Link href="/">
            Home
          </Link>

          <a href="#tours">
            Tours
          </a>

          {/* Customer and Guest */}
          {!checkingLogin &&
            (isCustomer || isGuest) && (
              <>
                <Link href="/drivers">
                  Find Drivers
                </Link>

                <Link href="/translators">
                  Find Translators
                </Link>
              </>
            )}

          {/* Customer Booking Dashboard */}
          {!checkingLogin && isCustomer && (
            <Link href="/bookings">
              Booking Dashboard
            </Link>
          )}

          {/* Guest - Login before bookings */}
          {!checkingLogin && isGuest && (
            <Link href="/login?next=%2Fbookings">
              Booking Dashboard
            </Link>
          )}

          {/* Driver Dashboard */}
          {!checkingLogin && isDriver && (
            <Link href="/driver-dashboard">
              Driver Dashboard
            </Link>
          )}

          {/* Translator Dashboard */}
          {!checkingLogin && isTranslator && (
            <Link href="/translator-dashboard">
              Translator Dashboard
            </Link>
          )}
        </nav>
      </header>

      {/* Home Content */}
      <h1>
        Welcome to Smart Tour Sri Lanka
      </h1>

      <p>
        Explore beautiful destinations in Sri Lanka!
      </p>

      <h2 id="tours">
        Our Tour Packages
      </h2>

      {loadingTours && (
        <p>Loading tours...</p>
      )}

      {error && (
        <p style={{ color: "red" }}>
          Error: {error}
        </p>
      )}

      {!loadingTours &&
        !error &&
        tours.length === 0 && (
          <p>
            No tour packages available.
          </p>
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

            <h3>
              {tour.name}
            </h3>

            <p>
              Location: {tour.location}
            </p>

            <p>
              Price: Rs.{" "}
              {Number(
                tour.price
              ).toLocaleString()}
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
