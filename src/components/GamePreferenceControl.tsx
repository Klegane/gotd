"use client";

import React, { useRef } from "react";

export type PreferenceState = "favorite" | "vetoed";

type GamePreferenceControlProps = {
  idPrefix?: string;
  preference: PreferenceState | null;
  onChange: (preference: PreferenceState | null) => void;
  disabled?: boolean;
};

export function GamePreferenceControl({ idPrefix, preference, onChange, disabled = false }: GamePreferenceControlProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const optionsId = idPrefix ? `${idPrefix}-preference-options` : undefined;

  function selectPreference(nextPreference: PreferenceState | null) {
    onChange(nextPreference);
    menuRef.current?.removeAttribute("open");
  }

  return (
    <div id={idPrefix ? `${idPrefix}-preference-control` : undefined} className="preference-control">
      <GamePreferenceBadge id={idPrefix ? `${idPrefix}-preference-badge` : undefined} preference={preference} />
      <details id={idPrefix ? `${idPrefix}-preference-menu` : undefined} className="preference-menu" ref={menuRef}>
        <summary
          id={idPrefix ? `${idPrefix}-preference-button` : undefined}
          className="tiny-button preference-menu-button"
          aria-disabled={disabled}
          aria-controls={optionsId}
          aria-label="Editar preferencia del juego"
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
            }
          }}
        >
          <span>Opciones</span>
          <span aria-hidden="true">▾</span>
        </summary>
        <div id={optionsId} className="preference-menu-options">
          <button
            id={idPrefix ? `${idPrefix}-favorite-button` : undefined}
            type="button"
            className={preference === "favorite" ? "active" : ""}
            onClick={() => selectPreference("favorite")}
            disabled={disabled}
          >
            <span aria-hidden="true">★</span>
            Favorito
          </button>
          <button
            id={idPrefix ? `${idPrefix}-veto-button` : undefined}
            type="button"
            className={preference === "vetoed" ? "active" : ""}
            onClick={() => selectPreference("vetoed")}
            disabled={disabled}
          >
            <span aria-hidden="true">!</span>
            Veto
          </button>
          <button
            id={idPrefix ? `${idPrefix}-clear-preference-button` : undefined}
            type="button"
            onClick={() => selectPreference(null)}
            disabled={disabled || !preference}
          >
            Sin marca
          </button>
        </div>
      </details>
    </div>
  );
}

export function GamePreferenceBadge({ id, preference }: { id?: string; preference: PreferenceState | null }) {
  if (preference === "favorite") {
    return (
      <span id={id} className="preference-badge favorite">
        <span aria-hidden="true">★</span>
        Favorito
      </span>
    );
  }

  if (preference === "vetoed") {
    return (
      <span id={id} className="preference-badge vetoed">
        <span aria-hidden="true">!</span>
        Vetado
      </span>
    );
  }

  return null;
}
