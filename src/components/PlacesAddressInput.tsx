"use client";

import { useEffect, useRef, useState } from "react";

type PlacesAddressInputProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: { name: string; address: string }) => void;
  placeholder?: string;
};

type GoogleAutocomplete = {
  addListener: (eventName: "place_changed", handler: () => void) => { remove: () => void };
  getPlace: () => {
    name?: string;
    formatted_address?: string;
  };
};

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            options: {
              fields: string[];
              types: string[];
            }
          ) => GoogleAutocomplete;
        };
      };
    };
  }
}

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
let googleMapsScriptPromise: Promise<void> | null = null;

export function PlacesAddressInput({ id, name, value, onChange, onPlaceSelected, placeholder }: PlacesAddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "manual">(
    googleMapsApiKey ? "loading" : "manual"
  );

  useEffect(() => {
    onChangeRef.current = onChange;
    onPlaceSelectedRef.current = onPlaceSelected;
  }, [onChange, onPlaceSelected]);

  useEffect(() => {
    if (!googleMapsApiKey || !inputRef.current) {
      setStatus("manual");
      return;
    }

    let listener: { remove: () => void } | null = null;
    let cancelled = false;

    loadGoogleMapsPlaces()
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places?.Autocomplete) {
          return;
        }

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["name", "formatted_address"],
          types: ["address"]
        });

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const address = place.formatted_address?.trim() || inputRef.current?.value.trim() || "";
          const name = place.name?.trim() || address;

          if (address) {
            onChangeRef.current(address);
            onPlaceSelectedRef.current?.({ name, address });
          }
        });

        setStatus("ready");
      })
      .catch(() => {
        setStatus("manual");
      });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, []);

  return (
    <div className="place-input-wrap">
      <input
        id={id}
        name={name}
        ref={inputRef}
        placeholder={placeholder ?? "Dirección"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="street-address"
      />
      <small className="google-maps-hint">
        {status === "ready" ? "Autocompletado por Google Maps" : "Introduce la dirección manualmente"}
      </small>
    </div>
  );
}

function loadGoogleMapsPlaces(): Promise<void> {
  if (window.google?.maps?.places?.Autocomplete) {
    return Promise.resolve();
  }

  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps-places]");

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps script failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: googleMapsApiKey ?? "",
      libraries: "places",
      loading: "async"
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsPlaces = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Google Maps script failed")), { once: true });
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}
