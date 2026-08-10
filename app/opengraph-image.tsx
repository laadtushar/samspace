import { ImageResponse } from "next/og";

export const alt = "Samvriti.Space — Priyanka Varma | Counselling Psychologist & Academic Mentor";
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
        {/* Decorative circles */}
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
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "rgba(193, 127, 94, 0.08)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "60px",
            position: "relative",
          }}
        >
          {/* Leaf icon */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "rgba(138, 158, 140, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 28,
              fontSize: 32,
            }}
          >
            🌿
          </div>

          {/* Brand */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: "#f7f3ed",
              lineHeight: 1.1,
              marginBottom: 8,
            }}
          >
            Samvriti.Space
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 22,
              color: "rgba(247, 243, 237, 0.55)",
              marginBottom: 32,
              letterSpacing: 2,
            }}
          >
            A space to feel seen, heard, and supported.
          </div>

          {/* Divider */}
          <div
            style={{
              width: 60,
              height: 2,
              background: "#c17f5e",
              marginBottom: 32,
              borderRadius: 2,
            }}
          />

          {/* Name */}
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: "#f7f3ed",
              marginBottom: 10,
            }}
          >
            Priyanka Varma
          </div>

          {/* Role */}
          <div
            style={{
              fontSize: 16,
              color: "rgba(247, 243, 237, 0.5)",
              marginBottom: 24,
            }}
          >
            Counselling Psychologist & Academic Mentor
          </div>

          {/* Credentials */}
          <div
            style={{
              display: "flex",
              gap: 12,
            }}
          >
            {["M.Sc. Clinical Psychology", "UGC NET-JRF", "GATE Qualified"].map(
              (c) => (
                <div
                  key={c}
                  style={{
                    fontSize: 13,
                    color: "rgba(247, 243, 237, 0.7)",
                    background: "rgba(247, 243, 237, 0.08)",
                    border: "1px solid rgba(247, 243, 237, 0.12)",
                    borderRadius: 20,
                    padding: "6px 16px",
                  }}
                >
                  {c}
                </div>
              )
            )}
          </div>
        </div>

        {/* Bottom bar */}
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
