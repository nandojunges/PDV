// src/components/Button.jsx
import React, { useMemo } from "react";

export default function Button({
  children,
  onClick,
  disabled = false,
  variant = "default", // default | primary | danger | ghost
  small = false,
  type = "button",
  className = "",
  style,
  title,
  ...rest
}) {
  const styles = useMemo(() => {
    const base = {
      appearance: "none",
      WebkitAppearance: "none",
      border: "1px solid transparent",
      borderRadius: 12,
      height: small ? 34 : 42,
      padding: small ? "0 10px" : "0 14px",
      fontSize: small ? 13 : 14,
      fontWeight: 800,
      lineHeight: 1,
      cursor: disabled ? "not-allowed" : "pointer",
      userSelect: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      whiteSpace: "nowrap",
      pointerEvents: "auto",
      opacity: disabled ? 0.55 : 1,
      transform: "translateY(0px)",
      transition:
        "transform 0.06s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease, color 0.18s ease, opacity 0.18s ease",
      boxShadow: disabled ? "none" : "0 1px 2px rgba(0,0,0,.06)",
      outline: "none",
    };

    const variants = {
      default: {
        background: "#f8fafc",
        borderColor: "#e2e8f0",
        color: "#0f172a",
      },
      primary: {
        background: "#2563eb",
        borderColor: "#2563eb",
        color: "#ffffff",
      },
      danger: {
        background: "#fee2e2",
        borderColor: "#fecaca",
        color: "#991b1b",
      },
      ghost: {
        background: "transparent",
        borderColor: "#e2e8f0",
        color: "#0f172a",
        boxShadow: "none",
      },
    };

    return { ...base, ...(variants[variant] || variants.default) };
  }, [variant, small, disabled]);

  function handleClick(e) {
    if (disabled) return;
    onClick?.(e);
  }

  function handleMouseDown(e) {
    if (disabled) return;
    e.currentTarget.style.transform = "translateY(1px)";
  }

  function handleMouseUp(e) {
    e.currentTarget.style.transform = "translateY(0px)";
  }

  function handleMouseLeave(e) {
    e.currentTarget.style.transform = "translateY(0px)";
  }

  function handleMouseEnter(e) {
    if (disabled) return;

    // hover refinado por variant
    if (variant === "primary") {
      e.currentTarget.style.background = "#1d4ed8";
      e.currentTarget.style.borderColor = "#1d4ed8";
      e.currentTarget.style.boxShadow = "0 10px 22px rgba(37,99,235,.22)";
      return;
    }
    if (variant === "danger") {
      e.currentTarget.style.background = "#fecaca";
      e.currentTarget.style.borderColor = "#fca5a5";
      e.currentTarget.style.boxShadow = "0 8px 18px rgba(239,68,68,.18)";
      return;
    }
    if (variant === "ghost") {
      e.currentTarget.style.background = "#f8fafc";
      e.currentTarget.style.borderColor = "#cbd5e1";
      e.currentTarget.style.boxShadow = "0 6px 16px rgba(15,23,42,.06)";
      return;
    }
    // default
    e.currentTarget.style.background = "#f1f5f9";
    e.currentTarget.style.borderColor = "#cbd5e1";
    e.currentTarget.style.boxShadow = "0 6px 16px rgba(15,23,42,.08)";
  }

  function handleFocus(e) {
    // focus visível (teclado)
    e.currentTarget.style.boxShadow =
      "0 0 0 3px rgba(37,99,235,.18), 0 1px 2px rgba(0,0,0,.06)";
  }

  function handleBlur(e) {
    // volta ao normal (sem destruir estilo do variant)
    // reset parcial seguro:
    e.currentTarget.style.transform = "translateY(0px)";
    if (disabled) {
      e.currentTarget.style.boxShadow = "none";
      return;
    }
    if (variant === "ghost") {
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.background = "transparent";
      e.currentTarget.style.borderColor = "#e2e8f0";
      return;
    }
    e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,.06)";

    if (variant === "primary") {
      e.currentTarget.style.background = "#2563eb";
      e.currentTarget.style.borderColor = "#2563eb";
      return;
    }
    if (variant === "danger") {
      e.currentTarget.style.background = "#fee2e2";
      e.currentTarget.style.borderColor = "#fecaca";
      return;
    }
    // default
    e.currentTarget.style.background = "#f8fafc";
    e.currentTarget.style.borderColor = "#e2e8f0";
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled}
      className={className}
      style={{ ...styles, ...style }}
      title={title}
      onMouseEnter={handleMouseEnter}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...rest}
    >
      {children}
    </button>
  );
}
