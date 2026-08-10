import { ImageResponse } from "next/og";

export const alt = "Samvriti.Space — Priyanka Varma | Counselling Psychologist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#2c3a2e",
          fontFamily: "Georgia, serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(138, 158, 140, 0.12)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "60px",
          }}
        >
          <div style={{ fontSize: 52, fontWeight: 700, color: "#f7f3ed", marginBottom: 8 }}>
            Samvriti.Space
          </div>
          <div style={{ fontSize: 22, color: "rgba(247,243,237,0.55)", marginBottom: 32 }}>
            A space to feel seen, heard, and supported.
          </div>
          <div style={{ width: 60, height: 2, background: "#c17f5e", marginBottom: 32 }} />
          <div style={{ fontSize: 26, fontWeight: 600, color: "#f7f3ed", marginBottom: 10 }}>
            Priyanka Varma
          </div>
          <div style={{ fontSize: 16, color: "rgba(247,243,237,0.5)" }}>
            Counselling Psychologist & Academic Mentor
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #8a9e8c, #c17f5e, #8a9e8c)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
