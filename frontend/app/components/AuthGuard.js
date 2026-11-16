
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const API = "http://127.0.0.1:5000";

export default function AuthGuard({ children, role }) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const response = await fetch(`${API}/api/me`, {
          credentials: "include",
          cache: "no-store"
        });

        if (response.status === 401) {
          router.replace(
            `/login?next=${encodeURIComponent(pathname)}`
          );
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to check login");
        }

        const data = await response.json();
        const userRole = String(
          data.user?.role || ""
        ).toLowerCase();

        if (role && userRole !== role.toLowerCase()) {
          router.replace(
            userRole === "driver"
              ? "/driver-dashboard"
              : "/bookings"
          );
          return;
        }

        if (active) {
          setAllowed(true);
        }

      } catch (error) {
        console.error("Auth Check Error:", error);

        // Do not treat a network failure as a logout
        if (active) {
          setAllowed(false);
          setLoading(false);
        }
        return;
      }

      if (active) {
        setLoading(false);
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, [router, pathname, role]);

  if (loading) {
    return <p style={{ padding: "30px" }}>
      Checking login...
    </p>;
  }

  if (!allowed) {
    return <p style={{ padding: "30px" }}>
      Unable to verify your login. Please try again.
    </p>;
  }

  return children;
}
