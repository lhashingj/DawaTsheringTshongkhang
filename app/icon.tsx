import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#1755b8",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          border: "2.5px solid #c9a227",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 12,
            fontWeight: 900,
            fontFamily: "Arial Black, Arial, sans-serif",
            letterSpacing: "-0.5px",
          }}
        >
          DTT
        </span>
      </div>
    ),
    { ...size }
  );
}
