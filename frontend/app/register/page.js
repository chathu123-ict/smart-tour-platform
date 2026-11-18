
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = "http://127.0.0.1:5000";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
          role: "Customer"
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Registration failed");
      }

      alert("Customer registration successful!");
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
      <Link href="/">← Back to Home</Link>

      <div style={{
        maxWidth: "450px",
        margin: "40px auto",
        padding: "30px",
        borderRadius: "12px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
      }}>
        <h1>Customer Registration</h1>
        <p>Create your Smart Tour account</p>

        <form onSubmit={handleRegister}>
          <label>Full Name</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />

          <label>Email</label>
          <input
            type="email"
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={150}
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
            backgroundColor: "#166534",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}>
            {loading ? "Registering..." : "Register as Customer"}
          </button>
        </form>

        {message && <p style={{ color: "red" }}>{message}</p>}

        
<p>
  Are you a Driver or Translator?{" "}
  <Link href="/register/driver">
    Register Here
  </Link>
</p>


        <p>
          Already have an account?{" "}
          <Link href="/login">Login Here</Link>
        </p>
      </div>
    </main>
  );
}
