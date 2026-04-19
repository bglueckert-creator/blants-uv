"use client";

import { useEffect, useMemo, useState } from "react";
import { Bebas_Neue } from "next/font/google";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400" });

const tiers = [
  { min: 0, max: 1.9, label: "MOISTURIZED 😌", bg: "#eef7ff", theme: "#8ec5ff" },
  { min: 2, max: 3.9, label: "GLOWING 😎", bg: "#fff7cc", theme: "#ffd54d" },
  { min: 4, max: 5.9, label: "TOASTY ☀️", bg: "#ffe3bf", theme: "#ffb56b" },
  { min: 6, max: 7.9, label: "SIZZLING 🔥", bg: "#ffc48f", theme: "#ff944d" },
  { min: 8, max: 9.9, label: "SEARING ☀️🔥", bg: "#ff9e7a", theme: "#ff6b57" },
  { min: 10, max: 100, label: "CRIPSY 🥵", bg: "#ff7ca8", theme: "#ff4f8b" },
];

function getTier(uvi: number) {
  return tiers.find((t) => uvi >= t.min && uvi <= t.max) || tiers[0];
}

function formatHourLabel(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: "numeric",
  });
}

function hourLabelFromNumber(hour24: number) {
  const dt = new Date();
  dt.setHours(hour24, 0, 0, 0);
  return dt.toLocaleTimeString([], { hour: "numeric" });
}

function formatLocationName(data: any) {
  const a = data?.address || {};
  return (
    a.city ||
    a.town ||
    a.village ||
    a.hamlet ||
    a.suburb ||
    a.county ||
    data?.name ||
    "your current location"
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        background: "rgba(17,17,17,0.92)",
        color: "white",
        padding: "8px 10px",
        borderRadius: 10,
        fontSize: 14,
        lineHeight: 1.1,
        boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
      }}
    >
      <div>{label}</div>
      <div style={{ marginTop: 4 }}>UV {Number(payload[0].value).toFixed(1)}</div>
    </div>
  );
}

export default function Home() {
  const [uvi, setUvi] = useState<number | null>(null);
  const [forecast, setForecast] = useState<any[]>([]);
  const [location, setLocation] = useState("Consulting the sun gods...");
  const [currentHour, setCurrentHour] = useState<number | null>(null);
  const [activePoint, setActivePoint] = useState<any | null>(null);

  const loadUvForLocation = async (latitude: number, longitude: number) => {
    const uvRes = await fetch(
      `https://currentuvindex.com/api/v1/uvi?latitude=${latitude}&longitude=${longitude}`
    );
    const uvData = await uvRes.json();

    setUvi(uvData.now.uvi);
    setCurrentHour(new Date().getHours());

    const today = new Date().toDateString();
    const history = Array.isArray(uvData?.history) ? uvData.history : [];
    const future = Array.isArray(uvData?.forecast) ? uvData.forecast : [];
    const combined = [...history, ...future];

    const todayPoints = combined
      .filter((d: any) => d?.time)
      .map((d: any) => {
        const dt = new Date(d.time);
        return {
          dayString: dt.toDateString(),
          hour24: dt.getHours(),
          hourLabel: formatHourLabel(d.time),
          uvi: Number(d.uvi ?? 0),
        };
      })
      .filter((d: any) => d.dayString === today);

    const uniqueByHour = Array.from(
      new Map(todayPoints.map((d: any) => [d.hour24, d])).values()
    ).sort((a: any, b: any) => a.hour24 - b.hour24);

    const positiveHours = uniqueByHour
      .filter((d: any) => d.uvi > 0)
      .map((d: any) => d.hour24);

    if (positiveHours.length > 0) {
      const startHour = Math.max(0, Math.min(...positiveHours) - 1);
      const endHour = Math.min(23, Math.max(...positiveHours) + 1);
      const hourMap = new Map(uniqueByHour.map((d: any) => [d.hour24, d]));
      const expanded = [];

      for (let h = startHour; h <= endHour; h++) {
        const existing = hourMap.get(h);
        expanded.push(
          existing || {
            hour24: h,
            hourLabel: hourLabelFromNumber(h),
            uvi: 0,
          }
        );
      }

      setForecast(expanded);
    } else {
      setForecast(uniqueByHour);
    }

    try {
      const locRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
        { headers: { "Accept-Language": "en" } }
      );
      const locData = await locRes.json();
      setLocation(`You are frying in ${formatLocationName(locData)}`);
    } catch {
      setLocation("You are frying in your current location");
    }
  };

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await loadUvForLocation(latitude, longitude);
      },
      () => setLocation("Location access denied")
    );
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const themeColor = uvi !== null ? getTier(uvi).theme : "#ffd54d";
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = themeColor;
  }, [uvi]);

  const tier = uvi !== null ? getTier(uvi) : null;
  const backgroundColor = tier?.bg || "#fffdf7";

  const currentMarker = useMemo(() => {
    if (currentHour === null || forecast.length === 0) return undefined;
    const firstHour = forecast[0]?.hour24;
    const lastHour = forecast[forecast.length - 1]?.hour24;
    if (firstHour === undefined || lastHour === undefined) return undefined;
    const clampedHour = Math.max(firstHour, Math.min(currentHour, lastHour));
    return hourLabelFromNumber(clampedHour);
  }, [currentHour, forecast]);

  const handleShare = async () => {
    const shareText = `${location.replace("You are frying in ", "") || "Someone"} is currently ${tier?.label || "having a sun moment"} at UV ${uvi?.toFixed(1) ?? "--"} ☀️`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "BLANTS UV", text: shareText, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
        alert("Copied share text to clipboard ☀️");
      }
    } catch {}
  };

  return (
    <div
      className={bebas.className}
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        background: backgroundColor,
        transition: "background 300ms ease",
        padding: "20px 16px 28px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 390, textAlign: "center" }}>
        <div style={{ fontSize: 42, lineHeight: 1, marginTop: 4 }}>☀️</div>
        <h1 style={{ fontSize: 64, marginTop: 4, marginBottom: 0, letterSpacing: 1, lineHeight: 0.95 }}>
          BLANTS UV
        </h1>
        <p style={{ marginTop: -2, marginBottom: 16, fontSize: 32, letterSpacing: 1, lineHeight: 0.95 }}>
          SUN FREAK FORECAST
        </p>

        {uvi === null ? (
          <p style={{ marginTop: 50, fontSize: 24 }}>Consulting the sun gods...</p>
        ) : (
          <>
            <div
              style={{ fontSize: 200, lineHeight: 0.9, marginTop: 4, textShadow: "0 4px 14px rgba(0,0,0,0.12)" }}
            >
              {uvi.toFixed(1)}
            </div>
            <div style={{ fontSize: 30, marginTop: 6 }}>{tier?.label}</div>
          </>
        )}

        {forecast.length > 0 && (
          <div
            style={{
              marginTop: 18,
              padding: 12,
              borderRadius: 18,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(255,255,255,0.78)",
              backdropFilter: "blur(6px)",
              boxShadow: "0 12px 28px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 16, textAlign: "left", marginBottom: 8, letterSpacing: 0.3 }}>
              TODAY’S UV CURVE
            </div>
            <div style={{ height: 168 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={forecast}
                  margin={{ top: 10, right: 4, left: -18, bottom: 0 }}
                  onClick={(state: any) => {
                    if (state?.activePayload?.[0]?.payload) {
                      setActivePoint(state.activePayload[0].payload);
                    }
                  }}
                >
                  <XAxis dataKey="hourLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
                  <YAxis domain={[0, 12]} tick={{ fontSize: 11 }} width={24} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />

                  {currentMarker && (
                    <ReferenceLine x={currentMarker} stroke="#777" strokeDasharray="4 4" ifOverflow="extendDomain" />
                  )}

                  <Line type="monotone" dataKey="uvi" stroke="#111" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {activePoint && (
              <div style={{ marginTop: 8, fontSize: 14, textAlign: "left", color: "#333" }}>
                {activePoint.hourLabel} · UV {Number(activePoint.uvi).toFixed(1)}
              </div>
            )}

            <button
              onClick={handleShare}
              style={{
                marginTop: 10,
                width: "100%",
                border: "none",
                borderRadius: 14,
                padding: "10px 8px",
                fontSize: 18,
                background: "rgba(0,0,0,0.06)",
                cursor: "pointer",
              }}
            >
              ☀️ SHARE MY UV
            </button>
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 15, color: "#333" }}>{location}</div>
      </div>
    </div>
  );
}
