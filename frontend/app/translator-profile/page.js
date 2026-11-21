
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "../components/AuthGuard";

const API = "http://127.0.0.1:5000";


const LANGUAGE_OPTIONS = [
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

const emptyProfile = {
  name: "",
  languages: "",
  feePerDay: "",
  available: true
};

function TranslatorProfilePage() {
  const [profile, setProfile] = useState(emptyProfile);
  const [savedProfile, setSavedProfile] = useState(emptyProfile);

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
          `${API}/api/translator-profile`,
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

        const loadedProfile = {
          name: data.name || "",
          languages: data.languages || "",
          feePerDay: String(data.feePerDay ?? ""),
          available: Boolean(data.available)
        };

        if (active) {
          setProfile(loadedProfile);
          setSavedProfile(loadedProfile);
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


function toggleLanguage(language) {
  setProfile((previous) => {
    const selected = previous.languages
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const updated = selected.includes(language)
      ? selected.filter((item) => item !== language)
      : [...selected, language];

    return {
      ...previous,
      languages: LANGUAGE_OPTIONS
        .filter((item) => updated.includes(item))
        .join(", ")
    };
  });
}


  function cancelEdit() {
    setProfile({ ...savedProfile });
    setEditing(false);
    setError("");
    setMessage("");
  }

  async function saveProfile(event) {
    event.preventDefault();



const selectedLanguages = profile.languages
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

if (selectedLanguages.length === 0) {
  setError("Please select at least one language");
  return;
}


    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API}/api/translator-profile`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: profile.name,
            languages: profile.languages,
            feePerDay: profile.feePerDay,
            available: profile.available
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to save profile"
        );
      }

      const updatedProfile = {
        name: data.translator.name,
        languages: data.translator.languages,
        feePerDay: String(data.translator.feePerDay),
        available: Boolean(data.translator.available)
      };

      setProfile(updatedProfile);
      setSavedProfile(updatedProfile);

      setEditing(false);
      setMessage("Profile updated successfully!");
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
      <Link href="/translator-dashboard">
        ← Back to Translator Dashboard
      </Link>

      <h1>My Translator Profile</h1>

      <p>
        Manage your personal information, languages,
        daily fee and availability.
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
            {/* Translator Name */}
            <label htmlFor="translatorName">
              <strong>Translator Name</strong>
            </label>

            <input
              id="translatorName"
              type="text"
              name="name"
              required
              maxLength={100}
              value={profile.name}
              onChange={handleChange}
              disabled={!editing || saving}
              style={inputStyle}
            />

            
{/* Languages */}
<div style={{ marginBottom: "20px" }}>
  <label>
    <strong>Languages</strong>
  </label>

  <details
    style={{
      marginTop: "8px",
      border: "1px solid #ccc",
      borderRadius: "6px",
      padding: "12px",
      backgroundColor: "white"
    }}
  >
    <summary
      style={{
        cursor: editing ? "pointer" : "default",
        fontWeight: "500"
      }}
    >
      {profile.languages || "Select Languages"}
    </summary>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "12px",
        marginTop: "15px"
      }}
    >
      {LANGUAGE_OPTIONS.map((language) => {
        const selected = profile.languages
          .split(",")
          .map((item) => item.trim())
          .includes(language);

        return (
          <label
            key={language}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <input
              type="checkbox"
              checked={selected}
              disabled={!editing || saving}
              onChange={() => toggleLanguage(language)}
            />

            {language}
          </label>
        );
      })}
    </div>
  </details>

  <p
    style={{
      fontSize: "13px",
      color: "#666"
    }}
  >
    Select all languages you can translate.
  </p>
</div>


            {/* Daily Fee */}
            <label htmlFor="feePerDay">
              <strong>Daily Fee (LKR)</strong>
            </label>

            <input
              id="feePerDay"
              type="number"
              name="feePerDay"
              min="0"
              max="99999999.99"
              step="0.01"
              required
              value={profile.feePerDay}
              onChange={handleChange}
              disabled={!editing || saving}
              style={inputStyle}
            />

            {/* Availability */}
            <div
              style={{
                padding: "18px",
                backgroundColor: "white",
                borderRadius: "8px",
                marginBottom: "25px"
              }}
            >
              <label
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  cursor: editing
                    ? "pointer"
                    : "default"
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

                <strong>
                  Available for Translation Requests
                </strong>
              </label>

              <p
                style={{
                  fontSize: "13px",
                  color: "#666",
                  marginBottom: 0
                }}
              >
                Turn this off when you cannot accept
                new translation requests.
                Existing accepted requests are not cancelled.
              </p>
            </div>

            {/* Action Buttons */}
            {!editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setMessage("");
                  setError("");
                }}
                style={{
                  padding: "12px 25px",
                  backgroundColor: "#166534",
                  color: "white",
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
                    padding: "12px 25px",
                    backgroundColor: "#166534",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: saving
                      ? "not-allowed"
                      : "pointer"
                  }}
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={cancelEdit}
                  style={{
                    padding: "12px 25px",
                    backgroundColor: "#e5e7eb",
                    border: "1px solid #ccc",
                    borderRadius: "6px",
                    cursor: "pointer"
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

export default function ProtectedTranslatorProfile() {
  return (
    <AuthGuard role="translator">
      <TranslatorProfilePage />
    </AuthGuard>
  );
}
