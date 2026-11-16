
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = "http://127.0.0.1:5000";

export default function DriverRegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [location, setLocation] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must contain at least 8 characters");
      return;
    }

    if (!vehicle.trim() || !location.trim()) {
      setMessage("Vehicle and location are required");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role: "Driver",
          vehicle: vehicle.trim(),
          location: location.trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Registration failed");
      }

      // Do not treat a customer account as a driver registration
      const registeredUser = result.user || result;

      if (
        String(registeredUser.role || "").toLowerCase() !== "driver" ||
        !registeredUser.driverId
      ) {
        throw new Error(
          "Registration response did not confirm a driver profile. Check backend."
        );
      }

      alert("Driver registration successful! Please login.");
      router.replace("/login");

    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "12px",
    marginTop: "8px",
    marginBottom: "15px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    boxSizing: "border-box"
  };

  return (
    <main style={{ padding: "40px 20px", fontFamily: "Arial" }}>
      <Link href="/register">← Back to Registration</Link>

      <div style={{
        maxWidth: "450px",
        margin: "40px auto",
        padding: "30px",
        borderRadius: "12px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
      }}>
        <h1>Driver Registration</h1>
        <p>Join Smart Tour as a Driver</p>

        <form onSubmit={handleRegister}>
          <label>Full Name</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />

          <label>Email Address</label>
          <input
            type="email"
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={150}
          />

          <label>Vehicle Model</label>
          <input
            style={inputStyle}
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="Example: Toyota Prius"
            required
          />

          <label>Location</label>
          <input
            style={inputStyle}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Example: Kandy"
            required
          />

          <label>Password</label>
          <input
            type="password"
            style={inputStyle}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />

          <label>Confirm Password</label>
          <input
            type="password"
            style={inputStyle}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading} style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}>
            {loading ? "Registering..." : "Register as Driver"}
          </button>
        </form>

        {message && (
          <p style={{ color: "#dc2626" }}>{message}</p>
        )}

        <p>
          Register as Customer?{" "}
          <Link href="/register">Click Here</Link>
        </p>

        <p>
          Already have an account?{" "}
          <Link href="/login">Login Here</Link>
        </p>
      </div>
    </main>
  );
}
