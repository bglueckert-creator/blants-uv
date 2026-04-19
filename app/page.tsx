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

function formatDayLabel(date: Date) {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getDateKey(date: Date) {
  return date.toDateString();
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
  const [location, setLocation] = useState("Consulting the sun gods...");
  const [currentHour, setCurrentHour] = useState<number | null>(null);
  const [activePoint, setActivePoint] = useState<any | null>(null);
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);
  const [allDayData, setAllDayData] = useState<Record<string, any[]>>({});
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [chartStatus, setChartStatus] = useState("Loading UV curve...");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(true);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [searchingLocations, setSearchingLocations] = useState(false);

  const loadUvForLocation = async (
    latitude: number,
    longitude: number,
    options?: { customLocationLabel?: string; useCurrentLocation?: boolean }
  ) => {
    setCoords({ latitude, longitude });
    setIsUsingCurrentLocation(options?.useCurrentLocation ?? false);
    setSelectedDayOffset(0);

    const uvRes = await fetch(
      `https://currentuvindex.com/api/v1/uvi?latitude=${latitude}&longitude=${longitude}`
    );
    const uvData = await uvRes.json();

    setUvi(uvData.now.uvi);
    setCurrentHour(new Date().getHours());

    const history = Array.isArray(uvData?.history) ? uvData.history : [];
    const future = Array.isArray(uvData?.forecast) ? uvData.forecast : [];
    const combined = [...history, ...future];

    const grouped: Record<string, any[]> = {};

    combined
      .filter((d: any) => d?.time)
      .forEach((d: any) => {
        const dt = new Date(d.time);
        const key = getDateKey(dt);

        if (!grouped[key]) grouped[key] = [];

        grouped[key].push({
          dayKey: key,
          hour24: dt.getHours(),
          hourLabel: formatHourLabel(d.time),
          uvi: Number(d.uvi ?? 0),
        });
      });

    const normalized: Record<string, any[]> = {};

    Object.entries(grouped).forEach(([key, points]) => {
      const uniqueByHour = Array.from(
        new Map(points.map((d: any) => [d.hour24, d])).values()
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
              dayKey: key,
              hour24: h,
              hourLabel: hourLabelFromNumber(h),
              uvi: 0,
            }
          );
        }

        normalized[key] = expanded;
      } else {
        normalized[key] = uniqueByHour;
      }
    });

    const sortedDates = Object.keys(normalized).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    setAllDayData(normalized);
    setAvailableDates(sortedDates);
    setChartStatus(sortedDates.length ? "" : "No UV data available.");

    if (options?.customLocationLabel) {
      setLocation(`You are frying in ${options.customLocationLabel}`);
      return;
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

  const loadCurrentLocation = async () => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await loadUvForLocation(latitude, longitude, { useCurrentLocation: true });
      },
      () => setLocation("Location access denied")
    );
  };

  const searchLocations = async () => {
    if (!locationQuery.trim()) return;
    setSearchingLocations(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          locationQuery.trim()
        )}&count=8&language=en&format=json`
      );
      const data = await res.json();
      setLocationResults(data.results || []);
    } catch {
      setLocationResults([]);
    } finally {
      setSearchingLocations(false);
    }
  };

  useEffect(() => {
    loadCurrentLocation();
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

  const todayBase = new Date();
  todayBase.setHours(0, 0, 0, 0);

  const selectedDate = useMemo(() => {
    const d = new Date(todayBase);
    d.setDate(d.getDate() + selectedDayOffset);
    return d;
  }, [selectedDayOffset]);

  const selectedDateKey = getDateKey(selectedDate);
  const forecast = allDayData[selectedDateKey] || [];

  const tier = uvi !== null ? getTier(uvi) : null;
  const backgroundColor = tier?.bg || "#fffdf7";

  const currentMarker = useMemo(() => {
    const isToday = selectedDayOffset === 0;
    if (!isToday || currentHour === null || forecast.length === 0) return undefined;

    const firstHour = forecast[0]?.hour24;
    const lastHour = forecast[forecast.length - 1]?.hour24;
    if (firstHour === undefined || lastHour === undefined) return undefined;

    const clampedHour = Math.max(firstHour, Math.min(currentHour, lastHour));
    return hourLabelFromNumber(clampedHour);
  }, [currentHour, forecast, selectedDayOffset]);

  const minOffset = useMemo(() => {
    if (!availableDates.length) return 0;
    const first = new Date(availableDates[0]);
    first.setHours(0, 0, 0, 0);
    return Math.round((first.getTime() - todayBase.getTime()) / 86400000);
  }, [availableDates]);

  const maxOffset = useMemo(() => {
    if (!availableDates.length) return 0;
    const last = new Date(availableDates[availableDates.length - 1]);
    last.setHours(0, 0, 0, 0);
    return Math.round((last.getTime() - todayBase.getTime()) / 86400000);
  }, [availableDates]);

  const canGoPrev = selectedDayOffset > minOffset;
  const canGoNext = selectedDayOffset < maxOffset;

  const handleShare = () => {
    const shareText = `${
      location.replace("You are frying in ", "") || "Someone"
    } is currently ${tier?.label || "having a sun moment"} at UV ${
      uvi?.toFixed(1) ?? "--"
    } ☀️`;

    const body = encodeURIComponent(`${shareText} ${window.location.href}`);
    window.location.href = `sms:&body=${body}`;
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

        <h1
          style={{
            fontSize: 64,
            marginTop: 4,
            marginBottom: 0,
            letterSpacing: 1,
            lineHeight: 0.95,
          }}
        >
          BLANT'S UV
        </h1>

        <p
          style={{
            marginTop: -2,
            marginBottom: 16,
            fontSize: 32,
            letterSpacing: 1,
            lineHeight: 0.95,
          }}
        >
          SUN FREAK FORECAST
        </p>

        {uvi === null ? (
          <p style={{ marginTop: 50, fontSize: 24 }}>Consulting the sun gods...</p>
        ) : (
          <>
            <div
              style={{
                fontSize: 200,
                lineHeight: 0.9,
                marginTop: 4,
                textShadow: "0 4px 14px rgba(0,0,0,0.12)",
              }}
            >
              {uvi.toFixed(1)}
            </div>
            <div style={{ fontSize: 30, marginTop: 6 }}>{tier?.label}</div>
          </>
        )}

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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <button
              disabled={!canGoPrev}
              onClick={() => setSelectedDayOffset((p) => p - 1)}
              style={{
                opacity: canGoPrev ? 1 : 0.3,
                fontSize: 18,
                background: "none",
                border: "none",
                cursor: canGoPrev ? "pointer" : "default",
              }}
            >
              ◀
            </button>

            <div style={{ fontSize: 16 }}>{formatDayLabel(selectedDate)}</div>

            <button
              disabled={!canGoNext}
              onClick={() => setSelectedDayOffset((p) => p + 1)}
              style={{
                opacity: canGoNext ? 1 : 0.3,
                fontSize: 18,
                background: "none",
                border: "none",
                cursor: canGoNext ? "pointer" : "default",
              }}
            >
              ▶
            </button>
          </div>

          {forecast.length > 0 ? (
            <>
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
                    <XAxis
                      dataKey="hourLabel"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                    />
                    <YAxis
                      domain={[0, 12]}
                      tick={{ fontSize: 11 }}
                      width={24}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {currentMarker && (
                      <ReferenceLine
                        x={currentMarker}
                        stroke="#777"
                        strokeDasharray="4 4"
                        ifOverflow="extendDomain"
                      />
                    )}

                    <Line
                      type="monotone"
                      dataKey="uvi"
                      stroke="#111"
                      strokeWidth={3}
                      dot={{ r: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {activePoint && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    textAlign: "left",
                    color: "#333",
                  }}
                >
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
            </>
          ) : (
            <div
              style={{
                height: 168,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                color: "#555",
              }}
            >
              {chartStatus}
            </div>
          )}
        </div>

        <div style={{ marginTop: 8, fontSize: 17, color: "#333" }}>{location}</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            width: "100%",
            marginTop: 8,
          }}
        >
          <button
            onClick={() => setShowLocationSearch((s) => !s)}
            style={{
              border: "none",
              borderRadius: 14,
              padding: "9px 12px",
              fontSize: 16,
              background: "rgba(0,0,0,0.06)",
              cursor: "pointer",
            }}
          >
            Specify Location
          </button>

          <button
            onClick={loadCurrentLocation}
            disabled={isUsingCurrentLocation}
            style={{
              border: "none",
              borderRadius: 14,
              padding: "9px 12px",
              fontSize: 16,
              background: isUsingCurrentLocation ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.06)",
              opacity: isUsingCurrentLocation ? 0.5 : 1,
              cursor: isUsingCurrentLocation ? "default" : "pointer",
            }}
          >
            Current Location
          </button>
        </div>

        {showLocationSearch && (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 18,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(255,255,255,0.78)",
              backdropFilter: "blur(6px)",
              boxShadow: "0 12px 28px rgba(0,0,0,0.06)",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 16, marginBottom: 8 }}>Search for a location</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchLocations();
                }}
                placeholder="Miami, Rockaway, 11224..."
                style={{
                  flex: 1,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  padding: "10px 12px",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <button
                onClick={searchLocations}
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontSize: 14,
                  background: "rgba(0,0,0,0.08)",
                  cursor: "pointer",
                }}
              >
                Search
              </button>
            </div>

            {searchingLocations && (
              <div style={{ marginTop: 10, fontSize: 14, color: "#555" }}>Searching...</div>
            )}

            {!searchingLocations && locationResults.length > 0 && (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {locationResults.map((result) => {
                  const label = [result.name, result.admin1, result.country]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <button
                      key={`${result.latitude}-${result.longitude}-${label}`}
                      onClick={async () => {
                        await loadUvForLocation(result.latitude, result.longitude, {
                          customLocationLabel: label,
                          useCurrentLocation: false,
                        });
                        setShowLocationSearch(false);
                        setLocationQuery(label);
                        setLocationResults([]);
                      }}
                      style={{
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 12,
                        padding: "10px 12px",
                        fontSize: 14,
                        textAlign: "left",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
