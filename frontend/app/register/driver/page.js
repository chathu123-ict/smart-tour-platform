
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { districts } from "../../data/districts";

const API = "http://127.0.0.1:5000";

const languageOptions = [
  "English",
  "Sinhala",
  "Tamil",
  "Japanese",
  "Chinese",
  "French",
  "German",
  "Hindi",
  "Korean",
  "Arabic",
  "Spanish",
  "Russian"
];

export default function DriverRegisterPage() {
  const router = useRouter();

  const [role, setRole] = useState("Driver");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Driver details
  const [vehicle, setVehicle] = useState("");
  const [location, setLocation] = useState("");
  const [district, setDistrict] = useState("");

  // Translator details
  const [languages, setLanguages] = useState([]);
  const [otherLanguage, setOtherLanguage] = useState("");
  const [feePerDay, setFeePerDay] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Select or remove language
  function toggleLanguage(language) {
    setLanguages((previous) => {
      if (previous.includes(language)) {
        return previous.filter((item) => item !== language);
      }

      return [...previous, language];
    });
  }

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

    const data = {
      name: name.trim(),
      email: email.trim(),
      password,
      role
    };

    // Driver registration details
    if (role === "Driver") {
  if (
    !vehicle.trim() ||
    !location.trim() ||
    !districts.includes(district)
  ) {
    setMessage("Vehicle, location and district are required");
    return;
  }

  data.vehicle = vehicle.trim();
  data.location = location.trim();
  data.district = district;
}

    // Translator registration details
    if (role === "Translator") {
      const selectedLanguages = [...languages];

      if (otherLanguage.trim()) {
        selectedLanguages.push(otherLanguage.trim());
      }

      if (selectedLanguages.length === 0) {
        setMessage("Select at least one language");
        return;
      }

      const feeText = feePerDay.trim();

      if (
        !/^\d+(\.\d{1,2})?$/.test(feeText) ||
        Number(feeText) > 99999999.99
      ) {
        setMessage("Enter a valid daily fee");
        return;
      }

      const languageText = selectedLanguages.join(", ");

      if (languageText.length > 300) {
        setMessage("Too many languages entered");
        return;
      }

      data.languages = languageText;
      data.feePerDay = Number(feeText);
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Registration failed"
        );
      }

      const registeredUser = result.user || result;

      // Verify correct account type
      if (
        String(registeredUser.role || "").toLowerCase() !==
        role.toLowerCase()
      ) {
        throw new Error(
          "Registration response has an incorrect role"
        );
      }

      if (role === "Driver" && !registeredUser.driverId) {
        throw new Error(
          "Driver profile was not confirmed"
        );
      }

      if (
        role === "Translator" &&
        !registeredUser.translatorId
      ) {
        throw new Error(
          "Translator profile was not confirmed"
        );
      }

      alert(`${role} registration successful! Please login.`);

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
    <main
      style={{
        padding: "40px 20px",
        fontFamily: "Arial"
      }}
    >
      <Link href="/register"
      
      style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 20px",
    backgroundColor: "#166534",
    color: "white",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "14px",
    marginBottom: "20px"
  }}
>
        ← Back to Registration
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
        <h1>{role} Registration</h1>

        <p>Join Smart Tour as a {role}</p>

        <form onSubmit={handleRegister}>

          {/* Account type */}
          <label>Register As</label>

          <select
            style={inputStyle}
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setMessage("");
            }}
          >
            <option value="Driver">Driver</option>
            <option value="Translator">Translator</option>
          </select>

          {/* Common details */}
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

          {/* Driver-specific fields */}
          {role === "Driver" && (
            <div>
              <h3>Driver Details</h3>

              <label>Vehicle Model</label>
              <input
                style={inputStyle}
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="Example: Toyota Prius"
                required
                maxLength={100}
              />

              <label>Location</label>
              <input
                style={inputStyle}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Example: Kandy"
                required
                maxLength={100}
              />


              <label>Driver Base District</label>

<select
  style={inputStyle}
  value={district}
  onChange={(e) => setDistrict(e.target.value)}
  required={role === "Driver"}
>
  <option value="">Select your district</option>

  {districts.map((item) => (
    <option key={item} value={item}>
      {item}
    </option>
  ))}
</select>



            </div>
          )}

          {/* Translator-specific fields */}
          {role === "Translator" && (
            <div>
              <h3>Translator Details</h3>

              <p>Select Languages You Can Speak</p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "20px"
                }}
              >
                {languageOptions.map((language) => (
                  <label key={language}>
                    <input
                      type="checkbox"
                      checked={languages.includes(language)}
                      onChange={() => toggleLanguage(language)}
                    />
                    {" "}{language}
                  </label>
                ))}
              </div>

              <label>Other Language (Optional)</label>
              <input
                style={inputStyle}
                value={otherLanguage}
                onChange={(e) => setOtherLanguage(e.target.value)}
                placeholder="Enter another language"
                maxLength={100}
              />

              <label>Daily Fee (LKR)</label>
              <input
                type="number"
                style={inputStyle}
                value={feePerDay}
                onChange={(e) => setFeePerDay(e.target.value)}
                placeholder="Example: 5000"
                min="0"
                max="99999999.99"
                step="0.01"
                required
              />

              <p>
                <strong>Selected Languages:</strong>{" "}
                {[...languages, otherLanguage.trim()]
                  .filter(Boolean)
                  .join(", ") || "None"}
              </p>
            </div>
          )}

          {/* Password */}
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

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor:
                role === "Driver" ? "#2563eb" : "#166534",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "wait" : "pointer"
            }}
          >
            {loading
              ? "Registering..."
              : `Register as ${role}`}
          </button>

        </form>

        {message && (
          <p style={{ color: "#dc2626" }}>
            {message}
          </p>
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
