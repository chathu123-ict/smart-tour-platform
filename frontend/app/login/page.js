
"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const API = "http://127.0.0.1:5000";

// Default dashboard based on user role
function dashboardFor(role) {
  const value = String(role || "").toLowerCase();

  if (value === "admin") {
    return "/admin";
  }

  if (value === "customer") {
    return "/bookings";
  }

  if (value === "driver") {
    return "/driver-dashboard";
  }

  if (value === "translator") {
    return "/translator-dashboard";
  }

  return "/";
}

// Redirect after login
function redirectFor(role, next) {
  const value = String(role || "").toLowerCase();

  // ADMIN
  if (value === "admin") {
    return "/admin";
  }

  // CUSTOMER
  if (value === "customer") {
    // Return to Booking Dashboard
    if (next === "/bookings") {
      return "/bookings";
    }

    // Return to selected Tour Details Page
    if (/^\/tours\/\d+$/.test(next || "")) {
      return next;
    }

    return "/bookings";
  }

  // DRIVER
  if (value === "driver") {
    return "/driver-dashboard";
  }

  // TRANSLATOR
  if (value === "translator") {
    return "/translator-dashboard";
  }

  return dashboardFor(role);
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check whether the user is already logged in
  useEffect(() => {
    let active = true;

    async function checkLogin() {
      try {
        const response = await fetch(
          `${API}/api/me`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (active && data.user) {
          router.replace(
            redirectFor(data.user.role, next)
          );
        }
      } catch (error) {
        console.error(
          "Session check error:",
          error
        );
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    checkLogin();

    return () => {
      active = false;
    };
  }, [router, next]);

  // Handle login
  async function handleLogin(event) {
    event.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API}/api/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            email: email.trim(),
            password
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Login failed"
        );
      }

      // Verify session after successful login
      const sessionResponse = await fetch(
        `${API}/api/me`,
        {
          credentials: "include",
          cache: "no-store"
        }
      );

      if (!sessionResponse.ok) {
        throw new Error(
          "Session verification failed"
        );
      }

      const sessionData =
        await sessionResponse.json();

      const user = sessionData.user;

      if (!user) {
        throw new Error(
          "User session not found"
        );
      }

      setPassword("");

      // Redirect to correct dashboard
      const destination = redirectFor(
        user.role,
        next
      );

      router.replace(destination);
      router.refresh();

    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        padding: "40px 20px",
        fontFamily: "Arial",
        minHeight: "100vh"
      }}
    >
      <Link href="/">
        ← Back to Home
      </Link>

      <div
        style={{
          maxWidth: "450px",
          margin: "40px auto",
          padding: "30px",
          borderRadius: "12px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
        }}
      >
        <h1 style={{ textAlign: "center" }}>
          Welcome Back
        </h1>

        <p style={{ textAlign: "center" }}>
          Login to Smart Tour Platform
        </p>

        {checking ? (
          <p style={{ textAlign: "center" }}>
            Checking login...
          </p>
        ) : (
          <>
            <form onSubmit={handleLogin}>
              <label htmlFor="loginEmail">
                Email Address
              </label>

              <input
                id="loginEmail"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="Enter your email"
                required
                style={inputStyle}
              />

              <label htmlFor="loginPassword">
                Password
              </label>

              <input
                id="loginPassword"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter your password"
                required
                style={inputStyle}
              />

              <button
                type="submit"
                disabled={loading}
                style={buttonStyle}
              >
                {loading
                  ? "Logging in..."
                  : "Login"}
              </button>
            </form>

            {message && (
              <p
                role="alert"
                style={{
                  color: "red",
                  textAlign: "center"
                }}
              >
                {message}
              </p>
            )}

            <p
              style={{
                textAlign: "center",
                marginTop: "25px"
              }}
            >
              Don't have an account?{" "}
              <Link href="/register">
                Register Here
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

// Suspense boundary for useSearchParams
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <p style={{ padding: "40px" }}>
          Loading login page...
        </p>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginTop: "8px",
  marginBottom: "18px",
  border: "1px solid #ccc",
  borderRadius: "6px",
  fontSize: "15px",
  boxSizing: "border-box"
};

const buttonStyle = {
  width: "100%",
  padding: "12px",
  backgroundColor: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "16px"
};
